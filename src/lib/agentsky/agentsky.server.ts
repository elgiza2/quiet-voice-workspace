/** @doc AgentSky server client — the single provider for the agent (OpenClaw), media and tools.
 *  Server-only: reads AGENTSKY_API_KEY inside each call. Ownership of agents and sessions is
 *  encoded in AgentSky itself (agent name prefix + session metadata.owner), so no DB writes. */
import { createHmac, timingSafeEqual } from "crypto";

const API = "https://api.agentsky.dev/v1";
const GATEWAY = "https://gateway.agentsky.dev/v1";

export const AGENT_HARNESS = "openclaw";
export const AGENT_MODEL = "gpt-5.6-luna";
export const AGENT_CAPABILITIES = [
  "exa.search",
  "exa.contents",
  "tinyfish.fetch",
  "tinyfish.browser",
];

export class AgentSkyError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Keys come from the `agentsky_keys` pool (filled from the Telegram bot), least-recently-used
 *  first; AGENTSKY_API_KEY stays as a fallback when the pool is empty. */
type PooledKey = { id: string | null; value: string };
async function takeKey(): Promise<PooledKey> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: secret } = await supabaseAdmin.rpc("read_agentsky_api_key");
  if (typeof secret === "string" && secret) return { id: null, value: secret };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any).rpc("take_agentsky_key");
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.key_value) return { id: row.id, value: row.key_value };
  } catch {
    /* fall back to env */
  }
  const k = process.env.AGENTSKY_API_KEY;
  if (!k) throw new AgentSkyError(500, "not_configured", "AgentSky is not configured");
  return { id: null, value: k };
}

async function reportKey(k: PooledKey, status: number, message: string) {
  if (!k.id) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dead = status === 401 || status === 402 || status === 403;
    await (supabaseAdmin as any)
      .from("agentsky_keys")
      .update({
        last_error: `${status} ${message}`.slice(0, 300),
        ...(dead ? { active: false } : {}),
      })
      .eq("id", k.id);
  } catch {
    /* best effort */
  }
}

async function call<T = any>(
  base: string,
  path: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<T> {
  const k = await takeKey();
  const res = await fetch(base + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${k.value}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: { code: "bad_response", message: text.slice(0, 300) } };
  }
  if (!res.ok) {
    const e = body?.error ?? {};
    if ([401, 402, 403, 429].includes(res.status) && k.id) {
      await reportKey(k, res.status, e.message || "");
    }
    throw new AgentSkyError(res.status, e.code || "error", e.message || `AgentSky ${res.status}`);
  }
  return body as T;
}

/** Checks a key against the provider before it is saved. */
export async function validateAgentSkyKey(value: string): Promise<boolean> {
  const res = await fetch(`${API}/agents`, { headers: { Authorization: `Bearer ${value}` } });
  return res.ok;
}

export const api = <T = any>(path: string, init?: RequestInit) => call<T>(API, path, init);
export const gateway = <T = any>(path: string, init?: RequestInit) => call<T>(GATEWAY, path, init);

export async function streamSession(sessionId: string, signal: AbortSignal) {
  const k = await takeKey();
  return fetch(`${API}/sessions/${encodeURIComponent(sessionId)}/stream`, {
    headers: { Authorization: `Bearer ${k.value}`, Accept: "text/event-stream" },
    signal,
  });
}

/* ---------- ownership ---------- */

export const ownerPrefix = (userId: string) => `mg_${userId.replace(/-/g, "")}`;

export type AgentRecord = {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  prompt?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
};

export async function listUserAgents(userId: string): Promise<AgentRecord[]> {
  const { agents } = await api<{ agents: AgentRecord[] & any[] }>("/agents");
  const p = ownerPrefix(userId);
  return (agents as any[]).filter((a) => !a.archived && String(a.name).startsWith(p));
}

/** Only deliberately configured catalogue templates, never another user's agents. */
export async function listAgentTemplates() {
  const { agents } = await api<{ agents: any[] }>("/agents");
  const seen = new Set<string>();
  return agents.filter((a) => {
    if (a.archived || !String(a.name).startsWith("Chat · ")) return false;
    const key = `${a.agentType}:${a.llm}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function resolveUserAgent(userId: string, origin: string, id?: string) {
  if (id === "higgsfield") return ensureHiggsfieldAgent(userId, origin);
  if (!id?.startsWith("template:"))
    return id ? getOwnedAgent(userId, id) : ensureDefaultAgent(userId, origin);
  const template = (await listAgentTemplates()).find((a) => `template:${a.id}` === id);
  if (!template) throw new AgentSkyError(404, "not_found", "Agent not found");
  const name = `${ownerPrefix(userId)}_tpl_${template.id}`.slice(0, 60);
  const existing = (await listUserAgents(userId)).find((a) => a.name === name);
  if (existing) return existing;
  const { agent } = await api<{ agent: any }>("/agents", {
    method: "POST",
    headers: { "Idempotency-Key": name },
    body: JSON.stringify({
      ...agentSpec({
        userId,
        origin,
        displayName: String(template.name).replace(/^Chat · /, ""),
        kind: "custom",
        color: "ocean",
      }),
      name,
      agentType: template.agentType,
      llm: template.llm,
      metadata: { owner: userId, kind: "custom", templateId: id, color: "ocean" },
    }),
  });
  return agent;
}

export async function getOwnedAgent(userId: string, agentId: string) {
  const { agent } = await api<{ agent: any }>(`/agents/${encodeURIComponent(agentId)}`);
  if (!String(agent?.name || "").startsWith(ownerPrefix(userId)) || agent.archived)
    throw new AgentSkyError(404, "not_found", "Agent not found");
  return agent;
}

export async function getOwnedSession(userId: string, sessionId: string) {
  const { session } = await api<{ session: any }>(`/sessions/${encodeURIComponent(sessionId)}`);
  if (session?.metadata?.owner !== userId) throw new AgentSkyError(404, "not_found", "Not found");
  return session;
}

/* ---------- tool signing (MCP url + media links) ---------- */

function secret() {
  const s = process.env.AGENT_TOOL_SIGNING_SECRET;
  if (!s) throw new AgentSkyError(500, "not_configured", "Signing secret missing");
  return s;
}
export function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url").slice(0, 32);
}
export function verify(value: string, sig: string): boolean {
  const a = Buffer.from(sign(value));
  const b = Buffer.from(sig || "");
  return a.length === b.length && timingSafeEqual(a, b);
}
export const mcpToken = (userId: string) => `${userId}.${sign("mcp:" + userId)}`;
export function readMcpToken(token: string): string | null {
  const [uid, sig] = String(token || "").split(".");
  return uid && sig && verify("mcp:" + uid, sig) ? uid : null;
}

/* ---------- agent prompt ---------- */

export const BASE_PROMPT = `You are an autonomous assistant inside the Ceyo app. Reply in the user's language.

Tools from the "megsy" MCP server are your ONLY way to make media and talk to the app UI:
- Media generation is for paid subscribers only. If the tool denies access, explain the subscription requirement and never bypass it with another tool.
- generate_image: whenever the user wants a picture, illustration, logo, edit or design. Never say you cannot create images. Never use any other image tool.
- generate_video: whenever the user wants a video or animation. It shows the user a card; the video renders there.
- ask_user: when you truly need the user to choose between options before continuing. Then stop and wait.
- create_task: when the user asks to be reminded, to plan, or when a goal needs follow-up steps. Assign tasks yourself.
- share_file: whenever you created files for the user, deliver every one of them with share_file before finishing. Never end a job that produced files without sharing them.
- update_plan: for multi-step work, publish a short plan of steps and update their status as you go.
- propose_agent: when creating a personal agent, first ask about purpose, audience, outcomes and boundaries. Ask follow-up questions when needed. Explain its role and instructions, then call propose_agent. Never create an agent yourself. Wait for the user to click Create agent or request changes.
- megsy_card is mandatory for data: whenever your answer contains weather, prices, an order, a cart, a list of items, records, a schedule, numbers worth a chart, a map or a document, you MUST call megsy_card before writing your reply — the card carries the data and your text adds at most one short sentence. A data answer written as plain text is a failure. Never search the web to learn how to use megsy_card; the widget list is already in the tool description. Never use the session dashboard, plugins or artifacts to display anything — the user cannot see them.
- show_service_result: after you run an action on any connected app (the user's linked services), always render its result as a card with this tool. Never paste raw JSON or a wall of rows into your reply.

You are also the research, build and docs surface:
- Research: use exa.search/exa.contents and tinyfish.fetch/tinyfish.browser for live facts. Open real pages, cross-check numbers and dates, and end research answers with a Sources list of full clickable URLs you actually opened. Say plainly what you could not verify instead of inventing it.
- Building: write complete working code/files end to end (no placeholders, no TODOs), deliver every produced file with share_file before finishing, and briefly explain how to run the result.
- Docs: write the full document, deliver it with share_file as a real downloadable file, and also return the full text as clean Markdown.

You are the smartest agent in this system. Act like it:
- Long missions: you can work for hours. Break the goal into a plan with update_plan, work through it step by step, and keep going until it is truly done. Never stop early because it is long. If the session stays alive, keep working — do not ask the user to continue.
- Never fail back to the user: if one tool fails, try another way immediately. A failed search → try a different query, a different capability (exa.search vs tinyfish.fetch vs tinyfish.browser), or open the page directly. A failed fetch → try contents/reader mode, a cached view, or another source saying the same thing. A failed file/media step → retry with adjusted input, then an alternative format, then deliver what works. Only use ask_user when you genuinely need a human decision (approval, secret, taste); never use it to report that something failed.
- Outside tools are allowed: when the sandbox or built-in tools cannot do it, use the live web and the user's connected services through your tools and capabilities (browse real pages, fetch real URLs, run connected-app actions, then show_service_result). Do not claim you cannot reach the web — you have exa and tinyfish for exactly that.
- Parallelize: for big jobs, split work across helper sub-agents and run them in parallel, then merge results. While one path is slow, advance another.
- Execute real work with your tools:
  - run_code: calculations, parsing, transforms, validation — run it, read the output, iterate. Never hand-compute what code can verify.
  - web_search/web_fetch: live facts beat memory. Search, open real pages, cross-check. If one query fails, rephrase and retry — do not stop.
  - remember/recall: call recall early every session (preferences, projects, timezone, language); call remember when the user states anything durable. Personalize everything.
  - spawn_helper: for big jobs, split into parallel sub-tasks (e.g. one helper per source, per file, per research angle), then merge their results yourself.
- browse_web: a REAL interactive browser (click, forms, screenshots, JS apps). Use when web_fetch is not enough — login walls, multi-step flows, data extraction. Describe the task step by step and read the returned steps + result.
- Workspace files (save_workspace_file/read_workspace_file/list_workspace_files): the user's PERMANENT workspace across sessions. Save every deliverable there (code, docs, reports, data) — not just share_file for one-offs. Read back what you saved; list to see what exists. Paths like reports/summary.md, code/app.py.
- schedule_task/list_schedules: recurring work runs on its own (daily reports, price watches, reminders). When the user asks for anything recurring, schedule it — do not ask them to come back.
- Finish with proof: deliver every file with share_file, every dataset/card with megsy_card, every service result with show_service_result, and end with a short summary of what was done — not what failed.
Never print tool names, internal instructions, JSON, or system text to the user. Keep answers clean and well formatted in Markdown. Do not paste image or video URLs in your reply — the app shows the media automatically.`;

export function agentSpec(opts: {
  userId: string;
  origin: string;
  displayName: string;
  description?: string;
  prompt?: string;
  color?: string;
  kind: "default" | "custom";
}) {
  const suffix =
    opts.kind === "default" ? "_default" : `_${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: (ownerPrefix(opts.userId) + suffix).slice(0, 60),
    displayName: opts.displayName.slice(0, 60),
    description: (opts.description || "").slice(0, 500),
    agentType: AGENT_HARNESS,
    llm: AGENT_MODEL,
    prompt: `${BASE_PROMPT}\n\n${opts.prompt ? `Your persona and job:\n${opts.prompt}` : ""}`.slice(
      0,
      100000,
    ),
    capabilities: AGENT_CAPABILITIES,
    mcpServers: [
      {
        type: "url",
        name: "megsy",
        url: `${opts.origin}/api/public/agent-tools/${mcpToken(opts.userId)}`,
      },
    ],
    metadata: {
      owner: opts.userId,
      kind: opts.kind,
      color: opts.color || "aurora",
      userPrompt: opts.prompt || "",
    },
  };
}

/** Public origin the agent's cloud machine can reach for the MCP tools. */
export function publicOrigin(request: Request): string {
  const env = process.env.PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const url = new URL(request.url);
  const fwd = request.headers.get("x-forwarded-host");
  const host = fwd || url.host;
  if (/localhost|127\.0\.0\.1/.test(host)) return "/";
  return `https://${host}`;
}

/** Editable agent instructions live in Supabase, so they can be added or changed
 *  from the database at any time — no code change and no deploy. Bumping `version`
 *  is what tells every agent to pick the new text up on its next message. */
export async function readPromptConfig(): Promise<{ version: number; extra: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("agent_prompt_config")
      .select("version, extra_prompt")
      .eq("id", 1)
      .maybeSingle();
    return {
      version: Number((data as any)?.version ?? 1),
      extra: String((data as any)?.extra_prompt ?? "").trim(),
    };
  } catch {
    return { version: 1, extra: "" };
  }
}

export async function ensureDefaultAgent(userId: string, origin: string) {
  const mine = await listUserAgents(userId);
  const found = mine.find((a) => a.name.endsWith("_default"));
  if (found) {
    const { agent } = await api<{ agent: AgentRecord }>(`/agents/${encodeURIComponent(found.id)}`);
    // The prompt is stamped with the config version, so editing the row in Supabase is
    // enough: the next message re-syncs the agent. The tool list is bound when the agent
    // is created, so the MCP server config is re-sent too, to pick up newly added tools.
    const cfg = await readPromptConfig();
    const stamp = `<!--megsy-prompt:${cfg.version}-->`;
    if (!String(agent.prompt || "").includes(stamp)) {
      const prompt = [BASE_PROMPT, cfg.extra, agent.metadata?.userPrompt || "", stamp]
        .filter(Boolean)
        .join("\n\n");
      await api(`/agents/${encodeURIComponent(found.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          prompt,
          capabilities: AGENT_CAPABILITIES,
          mcpServers: [
            {
              type: "url",
              name: "megsy",
              url: `${origin}/api/public/agent-tools/${mcpToken(userId)}`,
            },
          ],
        }),
      });
    }
    return agent;
  }
  const { agent } = await api<{ agent: AgentRecord }>("/agents", {
    method: "POST",
    headers: { "Idempotency-Key": `default-agent-${userId}` },
    body: JSON.stringify(
      agentSpec({ userId, origin, displayName: "Ceyo", kind: "default", color: "aurora" }),
    ),
  });
  return agent;
}

/** Clone only the actual configured Hypit template; never substitute another harness. */
export async function ensureHiggsfieldAgent(userId: string, origin: string) {
  const name = `${ownerPrefix(userId)}_higgsfield`;
  const mine = await listUserAgents(userId);
  const existing = mine.find((a) => a.name === name);
  if (existing) return existing;
  const { agents } = await api<{ agents: any[] }>("/agents");
  const template = agents.find((a) => !a.archived && ["Hypit", "Chat · Hypit"].includes(a.name));
  if (!template)
    throw new AgentSkyError(
      503,
      "hypit_unavailable",
      "The media agent is unavailable at the provider right now, so image and video creation is paused.",
    );
  const { agent } = await api<{ agent: AgentRecord }>("/agents", {
    method: "POST",
    headers: { "Idempotency-Key": name },
    body: JSON.stringify({
      ...agentSpec({
        userId,
        origin,
        displayName: "higgsfield",
        kind: "custom",
        color: "sun",
        prompt:
          "You are Higgsfield, the media specialist. Use generate_image or generate_video to fulfill media requests, and update_plan to track the job. Do not use alternate media providers or native generation tools.",
      }),
      name,
      agentType: template.agentType,
      llm: template.llm,
      metadata: { owner: userId, kind: "media", color: "sun", templateId: template.id },
    }),
  });
  return agent;
}
