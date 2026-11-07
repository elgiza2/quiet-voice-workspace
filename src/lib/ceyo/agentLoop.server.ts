import { getCerebrasKeys } from "@/lib/keys/cerebrasKey";
import { getProviderKey } from "@/lib/keys/providerKey";
/** @doc Bot reply loop: Cerebras streams the answer and may call web tools (Browserbase) several times before it finishes. */
const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions";
/** Cheapest + fastest model on Cerebras. */
const MODEL = "gpt-oss-120b";
const MAX_STEPS = 8;

export type LoopEvent = Record<string, unknown> & { id: string; type: string };
type Msg = { role: string; content?: string | null; tool_calls?: any[]; tool_call_id?: string; name?: string };

const tools = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for fresh information. Returns titles, links and snippets.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_url",
      description: "Open a web page in a real cloud browser and return its readable text.",
      parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
    },
  },
];

async function bbFetch(url: string): Promise<string> {
  const key = await getProviderKey("browserbase");
  if (!key) throw new Error("Browser is not configured");
  const r = await fetch("https://api.browserbase.com/v1/fetch", {
    method: "POST",
    headers: { "X-BB-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!r.ok) throw new Error(`Browser failed (${r.status})`);
  const j: any = await r.json();
  return String(j.content ?? "");
}

const strip = (html: string) =>
  html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

async function runTool(name: string, args: any): Promise<string> {
  if (name === "web_search") {
    const html = await bbFetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(String(args.query ?? "")));
    const out: string[] = [];
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && out.length < 8) {
      let link = m[1];
      const u = /uddg=([^&]+)/.exec(link);
      if (u) link = decodeURIComponent(u[1]);
      out.push(`- ${strip(m[2])}\n  ${link}\n  ${strip(m[3])}`);
    }
    return out.join("\n") || "No results.";
  }
  if (name === "read_url") {
    const url = String(args.url ?? "");
    if (!/^https?:\/\//.test(url)) return "Invalid URL.";
    return strip(await bbFetch(url)).slice(0, 12000) || "Empty page.";
  }
  return "Unknown tool.";
}

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal.addEventListener("abort", () => { clearTimeout(t); reject(signal.reason); }, { once: true });
});
let keyCursor = 0;

/**
 * Sends one model request. On the per-minute limit (429) it rotates to the next key
 * (CEREBRAS_API_KEY may hold several, comma separated) and otherwise waits the
 * provider's Retry-After before trying again, so the reply continues instead of failing.
 */
export async function cerebrasRequest(keys: string[], body: string, signal: AbortSignal, maxWaitMs = 90_000): Promise<Response> {
  let waited = 0;
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    const key = keys[keyCursor % keys.length];
    const res = await fetch(CEREBRAS_URL, { method: "POST", signal, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body });
    if (res.status !== 429 && res.status !== 503) return res;
    await res.body?.cancel().catch(() => {});
    keyCursor++;
    if (keys.length > 1 && attempt < keys.length - 1) continue;
    const after = Number(res.headers.get("retry-after"));
    const wait = Math.min(Number.isFinite(after) && after > 0 ? after * 1000 + 250 : 2000 * (attempt + 1), 30_000);
    if (waited + wait > maxWaitMs) throw new Error("I'm a bit overloaded right now, give me a minute and send it again.");
    waited += wait;
    await sleep(wait, signal);
  }
}

/** Runs the loop and emits transcript events; returns the final answer text. */
export async function runAgentLoop(
  system: string,
  history: Msg[],
  emit: (e: LoopEvent) => void,
  signal: AbortSignal,
  /** New user messages sent while the bot is working; they steer the same run. */
  poll: () => Promise<string[]> = async () => [],
  opts: { maxSteps?: number; extra?: { def: object; name: string; run: (args: any) => Promise<string> }; extras?: { def: object; name: string; run: (args: any) => Promise<string> }[] } = {},
): Promise<string> {
  const extras = [...(opts.extras || []), ...(opts.extra ? [opts.extra] : [])];
  const allTools = [...tools, ...extras.map((extra) => extra.def)];
  const maxSteps = opts.maxSteps ?? MAX_STEPS;
  const keys = (await getCerebrasKeys()).map((k) => k.api_key);
  if (!keys.length) throw new Error("AI is not configured");
  const messages: Msg[] = [{ role: "system", content: system }, ...history];
  let answer = "";
  const turn = crypto.randomUUID().slice(0, 8);

  for (let step = 0; step < maxSteps; step++) {
    signal.throwIfAborted();
    const res = await cerebrasRequest(keys, JSON.stringify({ model: MODEL, messages, tools: allTools, stream: true, reasoning_effort: "low" }), signal);
    if (!res.ok || !res.body) throw new Error(`AI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    const calls: { id: string; name: string; args: string }[] = [];
    const sid = `${turn}-${step}`;
    let n = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        let j: any;
        try { j = JSON.parse(data); } catch { continue; }
        const d = j.choices?.[0]?.delta ?? {};
        if (d.reasoning) emit({ id: `${sid}-r${n++}`, type: "agent.reasoning", part: { type: "reasoning", text: d.reasoning, stream_id: `${sid}-r` } });
        if (d.content) {
          text += d.content;
          emit({ id: `${sid}-t${n++}`, type: "agent.message", parts: [{ type: "text", text: d.content, stream_id: `${sid}-t` }] });
        }
        for (const tc of d.tool_calls ?? []) {
          const k = tc.index ?? 0;
          calls[k] ??= { id: tc.id || `${sid}-c${k}`, name: "", args: "" };
          if (tc.id) calls[k].id = tc.id;
          if (tc.function?.name) calls[k].name += tc.function.name;
          if (tc.function?.arguments) calls[k].args += tc.function.arguments;
        }
      }
    }
    answer += (answer && text ? "\n\n" : "") + text;
    const real = calls.filter(Boolean);
    const steer = await poll();
    if (!real.length) {
      if (!steer.length) {
        if (!text.trim()) throw new Error("The agent did not complete an answer. No success was recorded.");
        return answer;
      }
      if (text) messages.push({ role: "assistant", content: text });
      for (const t of steer) messages.push({ role: "user", content: t });
      continue;
    }
    messages.push({
      role: "assistant",
      content: text || null,
      tool_calls: real.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args || "{}" } })),
    });
    let redirected = false;
    for (let index = 0; index < real.length; index++) {
      const c = real[index];
      signal.throwIfAborted();
      const updates = index === 0 && steer.length ? steer : await poll();
      if (updates.length) {
        for (const pending of real.slice(index)) messages.push({ role: "tool", tool_call_id: pending.id, content: "Not executed: new user instructions arrived. Reconsider before any action." });
        for (const update of updates) messages.push({ role: "user", content: update });
        redirected = true;
        break;
      }
      let args: any = {};
      try { args = JSON.parse(c.args || "{}"); } catch { /* keep empty */ }
      emit({ id: `${c.id}-call`, type: "agent.tool_use", part: { type: "tool_call", call_id: c.id, tool_name: c.name, args } });
      let result: string;
      let status = "ok";
      try { const extra = extras.find((extra) => extra.name === c.name); result = extra ? await extra.run(args) : await runTool(c.name, args); } catch (e) { result = e instanceof Error ? e.message : "Tool failed"; status = "error"; }
      emit({ id: `${c.id}-res`, type: "agent.tool_result", part: { type: "tool_result", call_id: c.id, tool_name: c.name, status, result: result.slice(0, 30000) } });
      messages.push({ role: "tool", tool_call_id: c.id, content: result });
      if (status === "ok" && (c.name === "ask_user" || c.name === "connect_app" || c.name === "request_integration_action")) return answer;
    }
    if (redirected) continue;
  }
  throw new Error("The task reached its step limit before completing. Saved tool results remain available; ask to continue.");
}
