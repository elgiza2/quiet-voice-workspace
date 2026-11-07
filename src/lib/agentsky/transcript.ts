/** @doc Turns raw AgentSky session events into a clean transcript: user bubbles and agent turns
 *  made of steps (thinking, searches, clicks…), answer text and interactive cards. */
import type { RawEvent } from "./client";
import { agentProposalSchema, type AgentProposal } from "./agentProposal";
import type { ServiceAction } from "@/components/chat/widgets/ServiceActionWidget";

export type StepKind = "thought" | "search" | "read" | "browse" | "image" | "video" | "helper" | "command" | "edit" | "ask" | "task" | "plan" | "tool" | "python" | "code" | "file" | "memory" | "email" | "calendar" | "map" | "data";
export type Step = {
  id: string;
  kind: StepKind;
  label: string;
  detail?: string;
  status: "active" | "done" | "error";
};

export type MediaPayload = { type: "megsy.media"; kind: "image" | "video"; runId: string; token: string; status: string; urls: string[]; model: string; prompt: string };
export type VideoProposal = { type: "megsy.video_proposal"; prompt: string; aspect: string; duration: number };

export type Card =
  | { kind: "agent-proposal"; id: string; proposal: AgentProposal }
  | { kind: "media"; id: string; media: MediaPayload }
  | { kind: "video"; id: string; proposal: VideoProposal }
  | { kind: "question"; id: string; question: string; options: string[]; allowFreeText: boolean; answered: boolean }
  | { kind: "task"; id: string; title: string; dueAt: string | null; taskKind: string }
  | { kind: "plan"; id: string; title: string; steps: { title: string; status: string }[] }
  | { kind: "file"; id: string; name: string; url?: string; content?: string; mime?: string; size?: number }
  | { kind: "service-action"; id: string; data: ServiceAction }
  | { kind: "widget"; id: string; name: string; data: Record<string, unknown> };

/** Deliverable files the agent writes in its workspace and the user should be able to download. */
const DELIVERABLE = /\.(md|txt|csv|tsv|json|html?|xml|ya?ml|py|js|ts|tsx|jsx|css|sql|sh|svg)$/i;
const MAX_INLINE = 400_000;

export type UserTurn = { type: "user"; id: string; text: string; images: string[]; at?: string; voiceOrigin?: "recording"; recordingId?: string };
export type AgentTurn = {
  type: "agent";
  id: string;
  steps: Step[];
  text: string;
  cards: Card[];
  running: boolean;
  stopped: boolean;
  error: string | null;
};
export type Turn = UserTurn | AgentTurn;

/* ---------- text hygiene: nothing internal reaches the user ---------- */

const INTERNAL_LINES = /^\s*(NO_REPLY|HEARTBEAT_OK|\[\[reply_to[^\]]*\]\]|<\/?(system|tool|thinking)[^>]*>)\s*$/gim;

export function cleanText(s: string): string {
  return (s || "")
    .replace(/<!--megsy:[\s\S]*?-->/g, "")
    .replace(/\[\[\s*(TASK|ALARM|GOAL|APPROVAL|reply_to)[^\]]*\]\]/gi, "")
    .replace(/<(system-reminder|system|internal)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(INTERNAL_LINES, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function userText(content: any[] | undefined): { text: string; images: string[] } {
  const text: string[] = [];
  const images: string[] = [];
  for (const c of content ?? []) {
    if (c?.type === "text") text.push(c.text);
    if (c?.type === "image" && c.source?.type === "url") images.push(c.source.url);
  }
  return { text: text.join("\n"), images };
}

/* ---------- tool → human step ---------- */

/** First real string among candidate values. Arrays and nested objects are walked, so an
 *  object argument can never degrade into the useless "[object Object]" in the UI. */
export function firstText(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) {
      const s = firstText(...v);
      if (s) return s;
    } else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const s = firstText(o.query, o.q, o.text, o.name, o.title, o.prompt, o.url, o.value, o.label);
      if (s) return s;
    }
  }
  return "";
}

/** Tool args arrive as a plain object, a JSON string, or wrapped one level down
 *  (`{ id: "openclaw:core:web_search", args: { … } }`). Normalise all three shapes. */
export function normalizeArgs(raw: unknown): Record<string, any> {
  let a: any = raw;
  if (typeof a === "string") {
    try {
      a = JSON.parse(a);
    } catch {
      return {};
    }
  }
  if (!a || typeof a !== "object" || Array.isArray(a)) return {};
  const inner = a.args ?? a.arguments ?? a.parameters ?? a.input;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    // A wrapper call keeps the real arguments one level down; merge them over the wrapper.
    if (["id", "name", "tool", "tool_name", "vendor", "server"].some((k) => k in a)) a = { ...a, ...inner };
  }
  return a;
}

const short = (s: unknown, n = 70) => {
  const t = (s && typeof s === "object" ? firstText(s) : String(s ?? "")).replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};
const host = (u: unknown) => {
  try {
    return new URL(String(u)).hostname.replace(/^www\./, "");
  } catch {
    return short(u, 40);
  }
};
const base = (name: string) => name.toLowerCase().replace(/^.*?(__|\.|:)/, "");

export type Lang = "en" | "ar";
const L = {
  en: {
    searched: (q: string) => (q ? `Searched for “${q}”` : "Searched the web"),
    read: (h: string) => `Read ${h}`,
    opened: (h: string) => `Opened ${h}`,
    clicked: (t: string) => (t ? `Clicked “${t}”` : "Clicked on the page"),
    typed: (t: string) => (t ? `Typed “${t}”` : "Typed on the page"),
    looked: "Looked at the page",
    scrolled: "Scrolled the page",
    image: "Created an image",
    video: "Prepared a video",
    helper: (t: string) => (t ? `Started a helper: ${t}` : "Started a helper agent"),
    command: "Ran a command",
    edit: (f: string) => (f ? `Edited ${f}` : "Edited a file"),
    ask: "Asked you a question",
    task: (t: string) => `Added a task: ${t}`,
    plan: "Updated the plan",
    tool: (n: string) => `Used ${n}`,
    python: "Ran Python", code: "Wrote code", file: (f: string) => (f ? `Opened ${f}` : "Read a file"),
    memory: "Checked memory", email: "Worked on email", calendar: "Checked the calendar", map: "Looked up a place", data: "Analyzed data",
    thinking: "Thinking",
    thought: "Thought it through",
  },
  ar: {
    searched: (q: string) => (q ? `بحث عن «${q}»` : "بحث في الويب"),
    read: (h: string) => `قرأ ${h}`,
    opened: (h: string) => `فتح ${h}`,
    clicked: (t: string) => (t ? `ضغط على «${t}»` : "ضغط على الصفحة"),
    typed: (t: string) => (t ? `كتب «${t}»` : "كتب في الصفحة"),
    looked: "بص على الصفحة",
    scrolled: "نزل في الصفحة",
    image: "عمل صورة",
    video: "جهز فيديو",
    helper: (t: string) => (t ? `شغّل مساعد: ${t}` : "شغّل وكيل مساعد"),
    command: "شغّل أمر",
    edit: (f: string) => (f ? `عدّل ${f}` : "عدّل ملف"),
    ask: "سألك سؤال",
    task: (t: string) => `ضاف مهمة: ${t}`,
    plan: "حدّث الخطة",
    tool: (n: string) => `استخدم ${n}`,
    python: "شغّل بايثون", code: "كتب كود", file: (f: string) => (f ? `فتح ${f}` : "قرأ ملف"),
    memory: "راجع الذاكرة", email: "اشتغل على الإيميل", calendar: "راجع التقويم", map: "دور على مكان", data: "حلّل بيانات",
    thinking: "بيفكر",
    thought: "فكّر في الموضوع",
  },
};

export function describeTool(name: string, args: any, lang: Lang): { kind: StepKind; label: string } {
  const t = L[lang];
  const n = base(name);
  const a = normalizeArgs(args);
  if (n.includes("generate_image") || n === "image_generate") return { kind: "image", label: t.image };
  if (n.includes("generate_video")) return { kind: "video", label: t.video };
  if (n.includes("ask_user")) return { kind: "ask", label: t.ask };
  if (n.includes("create_task")) return { kind: "task", label: t.task(short(firstText(a.title, a.name, a.task), 50)) };
  if (n.includes("update_plan")) return { kind: "plan", label: t.plan };
  if (n.includes("spawn") || n.includes("subagent") || n.includes("sessions_send") || n.includes("helper"))
    return { kind: "helper", label: t.helper(short(firstText(a.task, a.label, a.message, a.prompt), 60)) };
  if (n.includes("search"))
    return {
      kind: "search",
      label: t.searched(short(firstText(a.query, a.q, a.queries, a.search_query, a.keywords, a.term), 60)),
    };
  if (n.includes("fetch") || n.includes("contents") || n.includes("read_url") || n === "web_fetch")
    return { kind: "read", label: t.read(host(firstText(a.url, a.urls, a.ids))) };
  if (n.includes("browser") || n.includes("navigate") || n.includes("click")) {
    const act = firstText(a.action, a.kind, n).toLowerCase();
    if (act.includes("click"))
      return { kind: "browse", label: t.clicked(short(firstText(a.text, a.element, a.ref, a.selector), 40)) };
    if (act.includes("type") || act.includes("fill")) return { kind: "browse", label: t.typed(short(firstText(a.text, a.value), 40)) };
    if (act.includes("scroll")) return { kind: "browse", label: t.scrolled };
    if (act.includes("snapshot") || act.includes("screenshot")) return { kind: "browse", label: t.looked };
    return { kind: "browse", label: t.opened(host(firstText(a.url, a.targetUrl, a.target_url))) };
  }
  if (n.includes("python") || n.includes("code_interpreter") || n.includes("jupyter") || (n === "exec" && /python/i.test(firstText(a.command, a.cmd)))) return { kind: "python", label: t.python };
  if (n.includes("memory") || n.includes("recall")) return { kind: "memory", label: t.memory };
  if (n.includes("mail") || n.includes("gmail")) return { kind: "email", label: t.email };
  if (n.includes("calendar") || n.includes("event")) return { kind: "calendar", label: t.calendar };
  if (n.includes("map") || n.includes("place") || n.includes("location")) return { kind: "map", label: t.map };
  if (n.includes("sql") || n.includes("csv") || n.includes("sheet") || n.includes("chart")) return { kind: "data", label: t.data };
  if (n === "read" || n.includes("read_file") || n.includes("view") || n === "ls" || n.includes("glob") || n.includes("grep"))
    return { kind: "file", label: t.file(short(firstText(a.path, a.file_path, a.pattern).split("/").pop(), 40)) };
  if (n.includes("code") || n.includes("sandbox") || n.includes("deploy") || n.includes("build")) return { kind: "code", label: t.code };
  if (n === "exec" || n.includes("bash") || n.includes("shell") || n === "process") {
    const cmd = firstText(a.command, a.cmd);
    // A shell command that is really a web search reads as a search, not as a mystery command.
    const q = cmd.match(/web\.search\s+query=(?:"([^"]+)"|'([^']+)'|([^\s]+))/i);
    if (q) return { kind: "search", label: t.searched(short(q[1] || q[2] || q[3], 60)) };
    // The agent titles its own commands in plain words — that title is the most
    // useful thing we can tell the user, so prefer it over a generic label.
    const title = firstText(a.title, a.name);
    if (title) return { kind: "command", label: short(title, 80) };
    if (cmd) return { kind: "command", label: short(cmd, 80) };
    return { kind: "command", label: t.command };
  }
  if (n.includes("write") || n.includes("edit") || n.includes("apply_patch"))
    return { kind: "edit", label: t.edit(short(firstText(a.path, a.file_path).split("/").pop(), 40)) };
  return { kind: "tool", label: t.tool(n.replace(/[_-]+/g, " ")) };
}

function payloadOf(result: any): any | null {
  if (!result) return null;
  if (typeof result === "object" && result.type) return result;
  if (typeof result === "string") { try { const p = JSON.parse(result); if (p?.type) return p; } catch { /* legacy payload */ } }
  if (result.structuredContent?.type) return result.structuredContent;
  const s = typeof result === "string" ? result : JSON.stringify(result);
  const m = s.match(/<!--megsy:([\s\S]*?)-->/);
  if (!m) return null;
  try {
    return JSON.parse(m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  } catch {
    try {
      return JSON.parse(JSON.parse(`"${m[1]}"`));
    } catch {
      return null;
    }
  }
}

function reasoningTitle(text: string, lang: Lang, done: boolean) {
  const bold = text.match(/\*\*([^*]{3,60})\*\*/);
  if (bold) return bold[1].trim();
  return done ? L[lang].thought : L[lang].thinking;
}

/* ---------- builder ---------- */

type Flat =
  | { k: "user"; id: string; text: string; images: string[]; at?: string; voiceOrigin?: "recording"; recordingId?: string }
  | { k: "text"; id: string; stream: string; text: string }
  | { k: "reasoning"; id: string; stream: string; text: string }
  | { k: "call"; id: string; callId: string; name: string; args: any }
  | { k: "result"; id: string; callId: string; name: string; ok: boolean; result: any }
  | { k: "run" }
  | { k: "idle"; reason: string }
  | { k: "interrupt" }
  | { k: "error"; message: string };

function flatten(events: RawEvent[]): Flat[] {
  const out: Flat[] = [];
  const seen = new Set<string>();
  const seenCall = new Set<string>();
  const seenResult = new Set<string>();
  const pushPart = (p: any, evId: string, i: number) => {
    if (!p) return;
    const id = `${evId}:${i}`;
    switch (p.type) {
      case "text":
        if (p.text) out.push({ k: "text", id, stream: String(p.stream_id ?? evId), text: p.text });
        break;
      case "reasoning":
        if (p.text && !p.redacted) out.push({ k: "reasoning", id, stream: String(p.stream_id ?? evId), text: p.text });
        break;
      case "tool_call":
        if (seenCall.has(p.call_id)) break;
        seenCall.add(p.call_id);
        out.push({ k: "call", id, callId: p.call_id, name: p.tool_name, args: p.args ?? {} });
        break;
      case "tool_result":
        if (seenResult.has(p.call_id)) break;
        seenResult.add(p.call_id);
        out.push({ k: "result", id, callId: p.call_id, name: p.tool_name, ok: p.status !== "error", result: p.result });
        break;
      case "error":
        out.push({ k: "error", message: p.message || "Error" });
        break;
    }
  };
  for (const e of events) {
    if (!e?.id || seen.has(e.id)) continue;
    seen.add(e.id);
    switch (e.type) {
      case "user.message": {
        const u = userText(e.content);
        out.push({ k: "user", id: e.id, text: u.text, images: u.images, at: e.at, voiceOrigin: e.voiceOrigin, recordingId: e.recordingId });
        break;
      }
      case "agent.message":
        (e.parts ?? []).forEach((p, i) => pushPart(p, e.id, i));
        break;
      case "agent.reasoning":
      case "agent.tool_use":
      case "agent.tool_result":
        pushPart(e.part, e.id, 0);
        break;
      case "session.status_running":
        out.push({ k: "run" });
        break;
      case "session.status_idle":
        out.push({ k: "idle", reason: e.stop_reason?.type || "end_turn" });
        break;
      case "user.interrupt":
        out.push({ k: "interrupt" });
        break;
      case "session.error":
        out.push({ k: "error", message: (e as any).error?.message || (e as any).message || "Something went wrong" });
        break;
    }
  }
  return out;
}

export function buildTranscript(events: RawEvent[], lang: Lang, running: boolean): Turn[] {
  const turns: Turn[] = [];
  let cur: AgentTurn | null = null;
  const reasoningSteps = new Map<string, Step>();
  const callSteps = new Map<string, Step>();
  const textStreams: string[] = [];
  const textByStream = new Map<string, string>();

  const flushText = () => {
    if (cur) cur.text = cleanText(textStreams.map((s) => textByStream.get(s) || "").join("\n\n"));
  };
  const agent = (): AgentTurn => {
    if (!cur) {
      cur = { type: "agent", id: `a${turns.length}`, steps: [], text: "", cards: [], running: true, stopped: false, error: null };
      textStreams.length = 0;
      textByStream.clear();
      turns.push(cur);
    }
    return cur;
  };
  const close = (stopped = false) => {
    if (!cur) return;
    flushText();
    cur.running = false;
    cur.stopped = cur.stopped || stopped;
    for (const s of cur.steps) if (s.status === "active") s.status = "done";
    for (const s of cur.steps) if (s.kind === "thought") s.label = reasoningTitle(s.detail || "", lang, true);
    cur = null;
  };

  for (const f of flatten(events)) {
    switch (f.k) {
      case "user": {
        // A question card is answered once the user replies after it.
        for (const t of turns)
          if (t.type === "agent") for (const c of t.cards) if (c.kind === "question") c.answered = true;
        if (cur && !(cur as AgentTurn).text && !(cur as AgentTurn).steps.length && !(cur as AgentTurn).cards.length) {
          turns.pop();
          cur = null;
        }
        // A message sent mid-run steers the same run; keep the agent turn open after it.
        const wasRunning = !!cur;
        if (cur) close();
        turns.push({ type: "user", id: f.id, text: f.text, images: f.images, at: f.at, voiceOrigin: f.voiceOrigin, recordingId: f.recordingId });
        if (wasRunning) {
          cur = null;
          agent();
        }
        break;
      }
      case "run":
        agent();
        break;
      case "text": {
        const t = agent();
        if (!textByStream.has(f.stream)) textStreams.push(f.stream);
        textByStream.set(f.stream, (textByStream.get(f.stream) || "") + f.text);
        // narration ends any open thought
        for (const s of t.steps) if (s.kind === "thought" && s.status === "active") { s.status = "done"; s.label = reasoningTitle(s.detail || "", lang, true); }
        flushText();
        break;
      }
      case "reasoning": {
        const t = agent();
        let s = reasoningSteps.get(f.stream);
        if (!s || s.status !== "active") {
          s = { id: f.id, kind: "thought", label: L[lang].thinking, detail: "", status: "active" };
          reasoningSteps.set(f.stream, s);
          t.steps.push(s);
        }
        s.detail = (s.detail || "") + f.text;
        s.label = reasoningTitle(s.detail, lang, false);
        break;
      }
      case "call": {
        const t = agent();
        for (const s of t.steps) if (s.kind === "thought" && s.status === "active") { s.status = "done"; s.label = reasoningTitle(s.detail || "", lang, true); }
        const d = describeTool(f.name, f.args, lang);
        const s: Step = { id: f.id, kind: d.kind, label: d.label, status: "active" };
        callSteps.set(f.callId, s);
        t.steps.push(s);
        const n = base(f.name);
        // One normalised view of the arguments for every card built below, so a
        // wrapped call (`{ id, args:{…} }`) reads exactly like a flat one.
        const ca = normalizeArgs(f.args);
        if (n === "connect_app") t.cards.push({ kind: "widget", id: f.callId, name: "connect_app", data: { apps: [{ id: ca.app, name: ca.app }], title: ca.reason || "Connect an account" } });
        if (n.includes("ask_user"))
          t.cards.push({
            kind: "question",
            id: f.callId,
            question: firstText(ca.question, ca.text, ca.prompt),
            options: (Array.isArray(ca.options) ? ca.options : []).map((o) => firstText(o)).filter(Boolean).slice(0, 8),
            allowFreeText: !!ca.allow_free_text,
            answered: false,
          });
        if (n.includes("create_task"))
          t.cards.push({ kind: "task", id: f.callId, title: firstText(ca.title, ca.name, ca.task), dueAt: ca.due_at || null, taskKind: firstText(ca.kind, ca.task_kind) || "task" });
        if (d.kind === "edit" && !n.includes("edit") && !n.includes("patch")) {
          const path = firstText(ca.path, ca.file_path, ca.filename);
          const content = ca.content ?? ca.contents ?? ca.text;
          const name = path.split("/").pop() || "";
          if (name && typeof content === "string" && content.length <= MAX_INLINE && DELIVERABLE.test(name) && !/(^|\/)(node_modules|\.git|tmp)\//.test(path)) {
            const card: Card = { kind: "file", id: `file:${path}`, name, content, size: content.length };
            const i = t.cards.findIndex((c) => c.id === card.id);
            if (i >= 0) t.cards[i] = card;
            else t.cards.push(card);
          }
        }
        if (n.includes("update_plan")) {
          const plan: Card = { kind: "plan", id: "plan", title: firstText(ca.title, ca.name), steps: Array.isArray(ca.steps) ? ca.steps : [] };
          const i = t.cards.findIndex((c) => c.kind === "plan");
          if (i >= 0) t.cards[i] = plan;
          else t.cards.unshift(plan);
        }
        break;
      }
      case "result": {
        const t = agent();
        const s = callSteps.get(f.callId);
        if (s) s.status = f.ok ? "done" : "error";
        const p = payloadOf(f.result);
        if (p?.type === "ceyo.file" && typeof p.id === "string") {
          t.cards.push({ kind: "file", id: p.id, name: String(p.name || "File") });
        }
        if (p?.type === "megsy.agent_proposal") {
          const proposal = agentProposalSchema.safeParse(p.proposal);
          if (proposal.success) t.cards.push({ kind: "agent-proposal", id: f.callId, proposal: { name: proposal.data.name || "", description: proposal.data.description || "", prompt: proposal.data.prompt || "", color: proposal.data.color || "ocean" } });
        }
        if (p?.type === "megsy.media") t.cards.push({ kind: "media", id: f.callId, media: p });
        if (p?.type === "megsy.file" && p.url) {
          const card: Card = { kind: "file", id: `file:${p.name}`, name: String(p.name), url: String(p.url), mime: p.mime, size: p.size };
          const i = t.cards.findIndex((c) => c.id === card.id);
          if (i >= 0) t.cards[i] = card;
          else t.cards.push(card);
        }
        if (p?.type === "megsy.video_proposal") t.cards.push({ kind: "video", id: f.callId, proposal: p });
        // Any connected service (all 586 of them) reports through one payload, so a
        // single widget renders every integration without per-service code.
        if (p?.type === "megsy.service" && p.service) {
          const card: Card = { kind: "service-action", id: f.callId, data: { ...p, status: f.ok ? "done" : "error" } };
          const i = t.cards.findIndex((c) => c.id === card.id);
          if (i >= 0) t.cards[i] = card;
          else t.cards.push(card);
        }
        // Named widgets let a tool pick an exact card (cart, map, weather, …) while
        // anything unnamed still lands on the universal service card.
        if ((p?.type === "megsy.widget" || p?.type === "ceyo.widget") && p.widget) {
          const card: Card = { kind: "widget", id: f.callId, name: String(p.widget), data: (p.data ?? {}) as Record<string, unknown> };
          const i = t.cards.findIndex((c) => c.id === card.id);
          if (i >= 0) t.cards[i] = card;
          else t.cards.push(card);
        }
        break;
      }
      case "interrupt":
        if (cur) (cur as AgentTurn).stopped = true;
        break;
      case "idle":
        close(false);
        break;
      case "error":
        agent().error = f.message;
        close(false);
        break;
    }
  }
  if (cur) {
    flushText();
    if (!running) close(false);
  }
  return turns;
}

/** What the orb should be doing for a running turn. */
export function orbStateFor(turn: AgentTurn | undefined, running: boolean): "idle" | "thinking" | "tool" | "talking" | "done" | "error" {
  if (!turn) return running ? "thinking" : "idle";
  if (turn.error) return "error";
  if (!running) return "done";
  const active = [...turn.steps].reverse().find((s) => s.status === "active");
  if (active) return active.kind === "thought" ? "thinking" : "tool";
  return turn.text ? "talking" : "thinking";
}
