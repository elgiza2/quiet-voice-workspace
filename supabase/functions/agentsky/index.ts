import { createClient } from "npm:@supabase/supabase-js@2";
import { AsyncLocalStorage } from "node:async_hooks";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PUBLISHABLE_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
const API = "https://api.agentsky.dev/v1";
const GATEWAY = "https://gateway.agentsky.dev/v1";
const AGENT_HARNESS = "openclaw";
const AGENT_MODEL = "gpt-5.6-luna";
const CAPABILITIES = ["exa.search", "exa.contents", "tinyfish.fetch", "tinyfish.browser"];
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/agentsky`;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Cache-Control": "no-store",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
const rpcError = (code: string, message: string) => ({ error: { code, message } });
const ownerPrefix = (uid: string) => `mg_${uid.replace(/-/g, "")}`;
const basePrompt = `You are Ceyo, an autonomous assistant in the Ceyo app. Reply in the user's language. Use exa.search/exa.contents and tinyfish.fetch/tinyfish.browser for live research; open and cross-check sources. Use the megsy MCP tools for app actions. When the user asks to create an image or video, call generate_image or generate_video; never claim you cannot make media. Media access is controlled by the app's subscription checks. Use ask_user only when a real choice is required, megsy_card for structured data, and show_service_result for connected-app results. Never expose internal tool calls, tokens, or secrets.`;

type Key = { id: string | null; value: string };
class ProviderError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function bytesToB64Url(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SERVICE_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
  );
  return bytesToB64Url(sig).slice(0, 32);
}
async function verify(value: string, sig: string) {
  if (!sig || sig.length !== 32) return false;
  const expected = await sign(value);
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ (sig.charCodeAt(i) || 0);
  return diff === 0;
}
async function mcpToken(uid: string) {
  const bucket = 30 * 24 * 60 * 60;
  const exp = (Math.floor(Date.now() / 1000 / bucket) + 4) * bucket;
  return `${uid}.${exp}.${await sign(`mcp:${uid}:${exp}`)}`;
}
async function statusToken(runId: string) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  return `${exp}.${await sign(`status:${runId}:${exp}`)}`;
}
async function mediaUrl(runId: string, index: number) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const sig = await sign(`media:${runId}:${index}:${exp}`);
  return `${EDGE_FUNCTION_URL}?route=media&runId=${encodeURIComponent(runId)}&index=${index}&s=${exp}.${encodeURIComponent(sig)}`;
}

async function requireUser(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || !SERVICE_KEY || !SUPABASE_URL) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error || !data.user ? null : { user: data.user, token };
}
async function takeKey(): Promise<Key> {
  try {
    const { data, error } = await admin.rpc("take_agentsky_key");
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.key_value) return { id: row.id || null, value: String(row.key_value) };
    }
  } catch {
    /* use the server secret only as an explicitly configured fallback */
  }
  const fallback = Deno.env.get("AGENTSKY_API_KEY");
  if (fallback) return { id: null, value: fallback };
  throw new ProviderError(500, "not_configured", "AgentSky key pool is empty");
}
async function reportKey(key: Key, status: number, message: string) {
  if (!key.id) return;
  try {
    const dead = status === 401 || status === 402 || status === 403;
    await admin
      .from("agentsky_keys")
      .update({
        last_error: `${status} ${message}`.slice(0, 300),
        ...(dead ? { active: false } : {}),
      })
      .eq("id", key.id);
  } catch {
    /* reporting is best effort */
  }
}
async function provider<T = any>(
  base: string,
  path: string,
  init: RequestInit = {},
  attempt = 0,
  pinned?: Key,
): Promise<T> {
  // Pin one key per request: rotating keys mid-request mixes AgentSky
  // workspaces (list from key A, detail via key B => "unknown agent").
  const key = pinned || (await takeKey());
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${key.value}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(base + path, { ...init, headers });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: { code: "bad_response", message: text.slice(0, 300) } };
  }
  if (!response.ok) {
    const err = body?.error || {};
    if ([401, 402, 403, 429].includes(response.status) && key.id && !pinned) {
      await reportKey(key, response.status, err.message || "");
      if (attempt < 2) return provider<T>(base, path, init, attempt + 1, undefined);
    }
    throw new ProviderError(
      response.status,
      err.code || "provider_error",
      err.message || `AgentSky ${response.status}`,
    );
  }
  return body as T;
}
// Per-request client: one pinned key for every AgentSky call in the request.
function requestClients(key: Key) {
  return {
    api: <T = any>(path: string, init?: RequestInit) => provider<T>(API, path, init, 0, key),
    gateway: <T = any>(path: string, init?: RequestInit) =>
      provider<T>(GATEWAY, path, init, 0, key),
    key,
  };
}
type Ctx = ReturnType<typeof requestClients>;
// Per-request storage: a module global was reset by concurrent requests.
const ctxStore = new AsyncLocalStorage<Ctx>();
const currentCtx = () => {
  const ctx = ctxStore.getStore();
  if (!ctx) throw new ProviderError(500, "server_error", "AgentSky context is missing.");
  return ctx;
};
const api = <T = any>(path: string, init?: RequestInit) => currentCtx().api<T>(path, init);
const gateway = <T = any>(path: string, init?: RequestInit) =>
  currentCtx().gateway<T>(path, init);
async function withKey<T>(fn: () => Promise<T>): Promise<T> {
  const c = requestClients(await takeKey());
  return await ctxStore.run(c, fn);
}

async function userTier(uid: string): Promise<"free" | "pro"> {
  try {
    const { data, error } = await admin.rpc("has_paid_plan", { p_user_id: uid });
    return !error && data === true ? "pro" : "free";
  } catch {
    return "free";
  }
}
async function userClient(token: string) {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function creditBalance(token: string) {
  try {
    const { data, error } = await (await userClient(token)).rpc("get_credit_overview");
    return !error && data?.success === true ? Number(data.credits || 0) : null;
  } catch {
    return null;
  }
}
async function openTurn(token: string, sid: string, chars: number) {
  try {
    return (
      await (
        await userClient(token)
      ).rpc("open_own_usage_turn", {
        p_session: sid,
        p_input_chars: Math.round(chars),
        p_model_tier: "cheap",
        p_machine: "small",
      })
    ).data as string | null;
  } catch {
    return null;
  }
}
async function latestOpenTurn(token: string, sid: string) {
  try {
    const { data } = await (
      await userClient(token)
    )
      .from("usage_turns")
      .select("id")
      .eq("session_id", sid)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id || null;
  } catch {
    return null;
  }
}
async function settleTurn(token: string, id: string, chars: number, seconds: number) {
  try {
    await (
      await userClient(token)
    ).rpc("settle_own_usage_turn", {
      p_turn_id: id,
      p_output_chars: Math.round(chars),
      p_awake_seconds: seconds,
    });
  } catch {
    /* best effort */
  }
}
async function chargeKnown(token: string, cost: number, action: string, description: string) {
  const credits = Math.max(1, Math.ceil(cost * 1000));
  try {
    const { data, error } = await (
      await userClient(token)
    ).rpc("charge_own_credits", { p_cost: credits, p_action: action, p_description: description });
    return !error && data?.success === true
      ? { ok: true, credits: Number(data.charged || credits) }
      : { ok: false, credits };
  } catch {
    return { ok: false, credits };
  }
}

function agentView(a: any) {
  return {
    id: a.id,
    name: a.displayName || a.name,
    description:
      a.description && !String(a.description).startsWith("OpenClaw ·") ? a.description : "",
    color: a.metadata?.color || "aurora",
    prompt: a.metadata?.userPrompt || "",
    isDefault: String(a.name).endsWith("_default"),
    createdAt: a.createdAt || "",
  };
}
function agentSpec(
  uid: string,
  displayName: string,
  kind: "default" | "custom",
  prompt = "",
  color = "aurora",
  name?: string,
  template?: any,
) {
  const suffix = kind === "default" ? "_default" : `_${crypto.randomUUID().slice(0, 6)}`;
  const ownerName = name || `${ownerPrefix(uid)}${suffix}`;
  return {
    name: ownerName.slice(0, 60),
    displayName: displayName.slice(0, 60),
    description: "",
    agentType: template?.agentType || AGENT_HARNESS,
    llm: template?.llm || AGENT_MODEL,
    prompt: `${basePrompt}${prompt ? `\n\nYour persona and job:\n${prompt}` : ""}`.slice(0, 100000),
    capabilities: CAPABILITIES,
    mcpServers: [
      {
        type: "url",
        name: "megsy",
        url: `${EDGE_FUNCTION_URL}?route=tools&token=${encodeURIComponent(uid)}.${"TOKEN"}`,
      },
    ],
    metadata: {
      owner: uid,
      kind,
      color,
      userPrompt: prompt,
      ...(template ? { templateId: template.id } : {}),
    },
  };
}
async function agentSpecFor(
  uid: string,
  displayName: string,
  kind: "default" | "custom",
  prompt = "",
  color = "aurora",
  name?: string,
  template?: any,
) {
  const spec = agentSpec(uid, displayName, kind, prompt, color, name, template);
  spec.mcpServers[0].url = `${EDGE_FUNCTION_URL}?route=tools&token=${encodeURIComponent(await mcpToken(uid))}`;
  return spec;
}
async function listUserAgents(uid: string) {
  const { agents = [] } = await api<{ agents: any[] }>("/agents");
  const p = ownerPrefix(uid);
  return agents.filter((a: any) => !a.archived && String(a.name).startsWith(p));
}
async function listTemplates() {
  const { agents = [] } = await api<{ agents: any[] }>("/agents");
  const seen = new Set<string>();
  return agents.filter((a: any) => {
    if (a.archived || !String(a.name).startsWith("Chat · ")) return false;
    const k = `${a.agentType}:${a.llm}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
async function getOwnedAgent(uid: string, id: string) {
  const { agent } = await api<{ agent: any }>(`/agents/${encodeURIComponent(id)}`);
  if (!String(agent?.name || "").startsWith(ownerPrefix(uid)) || agent.archived)
    throw new ProviderError(404, "not_found", "Agent not found");
  return agent;
}
async function getOwnedSession(uid: string, id: string) {
  const { session } = await api<{ session: any }>(`/sessions/${encodeURIComponent(id)}`);
  if (session?.metadata?.owner !== uid) throw new ProviderError(404, "not_found", "Not found");
  return session;
}
async function ensureDefaultAgent(uid: string) {
  const agents = await listUserAgents(uid);
  const found = agents.find((a: any) => String(a.name).endsWith("_default"));
  const spec = await agentSpecFor(uid, "Ceyo", "default");
  if (!found) {
    try {
      const { agent } = await api<{ agent: any }>("/agents", {
        method: "POST",
        headers: { "Idempotency-Key": `default-agent-edge-v1-${uid}` },
        body: JSON.stringify(spec),
      });
      return agent;
    } catch (e) {
      // An older app version may have claimed the legacy idempotency key with a
      // different MCP URL format. Reuse the existing default agent and migrate it.
      if (
        e instanceof ProviderError &&
        (e.status === 409 || /idempotency/i.test(`${e.code} ${e.message}`))
      ) {
        const again = (await listUserAgents(uid)).find((a: any) =>
          String(a.name).endsWith("_default"),
        );
        if (again) {
          const { agent } = await api<{ agent: any }>(`/agents/${encodeURIComponent(again.id)}`);
          await api(`/agents/${encodeURIComponent(again.id)}`, {
            method: "PATCH",
            body: JSON.stringify({
              mcpServers: spec.mcpServers,
              prompt: `${basePrompt}\n\n<!--megsy-edge-mcp-v1-->`,
              capabilities: CAPABILITIES,
            }),
          });
          return { ...agent, mcpServers: spec.mcpServers };
        }
      }
      throw e;
    }
  }
  // The list may reference a stale agent that the provider already removed
  // ("unknown agent" on fetch). Recreate it instead of failing bootstrap.
  let current: any = null;
  try {
    const { agent } = await api<{ agent: any }>(`/agents/${encodeURIComponent(found.id)}`);
    current = agent;
  } catch (e) {
    if (
      e instanceof ProviderError &&
      (e.status === 404 || /unknown agent|not[_\s-]?found/i.test(`${e.code} ${e.message}`))
    ) {
      const { agent } = await api<{ agent: any }>("/agents", {
        method: "POST",
        headers: { "Idempotency-Key": `default-agent-edge-v2-${uid}-${Date.now()}` },
        body: JSON.stringify(spec),
      });
      return agent;
    }
    throw e;
  }
  const agent = current;
  const servers = JSON.stringify(agent.mcpServers || []);
  const desired = JSON.stringify(spec.mcpServers);
  if (servers !== desired || !String(agent.prompt || "").includes("megsy-edge-mcp-v1")) {
    await api(`/agents/${encodeURIComponent(found.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        mcpServers: spec.mcpServers,
        prompt: `${basePrompt}\n\n<!--megsy-edge-mcp-v1-->`,
        capabilities: CAPABILITIES,
      }),
    });
  }
  return agent;
}
async function ensureHiggsfield(uid: string) {
  const name = `${ownerPrefix(uid)}_higgsfield`;
  const owned = await listUserAgents(uid);
  const existing = owned.find((a: any) => a.name === name);
  const { agents = [] } = await api<{ agents: any[] }>("/agents");
  const template = agents.find(
    (a: any) => !a.archived && ["Hypit", "Chat · Hypit"].includes(a.name),
  );
  if (!template && !existing)
    throw new ProviderError(
      503,
      "hypit_unavailable",
      "The media agent is not available at the provider.",
    );
  const spec = await agentSpecFor(
    uid,
    "higgsfield",
    "custom",
    "You are the media specialist. Use generate_image or generate_video for media requests. Do not claim image or video generation is unavailable.",
    "sun",
    name,
    template,
  );
  if (existing) {
    const { agent } = await api<{ agent: any }>(`/agents/${encodeURIComponent(existing.id)}`);
    if (JSON.stringify(agent.mcpServers || []) !== JSON.stringify(spec.mcpServers))
      await api(`/agents/${encodeURIComponent(existing.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ mcpServers: spec.mcpServers, capabilities: CAPABILITIES }),
      });
    return existing;
  }
  const { agent } = await api<{ agent: any }>("/agents", {
    method: "POST",
    headers: { "Idempotency-Key": name },
    body: JSON.stringify({
      ...spec,
      agentType: template.agentType,
      llm: template.llm,
      metadata: { owner: uid, kind: "media", color: "sun", templateId: template.id },
    }),
  });
  return agent;
}
async function resolveAgent(uid: string, requested?: string) {
  if (requested === "higgsfield") return ensureHiggsfield(uid);
  if (requested?.startsWith("template:")) {
    const template = (await listTemplates()).find((a: any) => `template:${a.id}` === requested);
    if (!template) throw new ProviderError(404, "not_found", "Agent not found");
    const name = `${ownerPrefix(uid)}_tpl_${template.id}`.slice(0, 60);
    const existing = (await listUserAgents(uid)).find((a: any) => a.name === name);
    if (existing) return existing;
    const spec = await agentSpecFor(
      uid,
      String(template.name).replace(/^Chat · /, ""),
      "custom",
      "",
      "ocean",
      name,
      template,
    );
    const { agent } = await api<{ agent: any }>("/agents", {
      method: "POST",
      headers: { "Idempotency-Key": name },
      body: JSON.stringify({
        ...spec,
        metadata: { owner: uid, kind: "custom", templateId: requested, color: "ocean" },
      }),
    });
    return agent;
  }
  if (requested) return getOwnedAgent(uid, requested);
  return ensureDefaultAgent(uid);
}
function fallbackAgents() {
  return [
    {
      id: "megsy-default",
      name: "Ceyo",
      description: "Primary assistant",
      color: "aurora",
      prompt: "",
      isDefault: true,
      createdAt: "",
    },
    ...[
      { name: "Researcher", description: "Live facts and sources", color: "ocean" },
      { name: "Engineer", description: "Code and debugging", color: "mint" },
      { name: "Analyst", description: "Numbers and strategy", color: "rose" },
      { name: "Writer", description: "Copy and documents", color: "ember" },
    ].map((a) => ({
      ...a,
      id: `template:builtin-${a.name.toLowerCase()}`,
      prompt: "",
      isDefault: false,
      isTemplate: true,
      createdAt: "",
    })),
    {
      id: "higgsfield",
      name: "Higgsfield",
      description: "Images & video",
      color: "sun",
      prompt: "",
      isDefault: false,
      isTemplate: true,
      mediaOnly: true,
      createdAt: "",
    },
  ];
}
const mediaModels = (tier: "free" | "pro") => [
  { id: "img-fast", kind: "image", label: "Higgsfield Image", tier: "pro", locked: tier !== "pro" },
  { id: "vid-fast", kind: "video", label: "Higgsfield Video", tier: "pro", locked: tier !== "pro" },
];

function contentOf(body: any) {
  const text = String(body?.text ?? "").slice(0, 20000);
  const images = Array.isArray(body?.images) ? body.images.slice(0, 6) : [];
  return [
    ...(text ? [{ type: "text", text }] : []),
    ...images
      .filter((u: any) => typeof u === "string" && /^https:\/\//.test(u))
      .map((url: string) => ({ type: "image", source: { type: "url", url } })),
  ];
}
const inputChars = (content: any[]) =>
  content.reduce((n, c) => n + (c.type === "text" ? c.text.length : 0), 0);
function mediaIntent(text: string) {
  return /(?:اعملي|اعمل|ارسم|صمم|ولّد|ولد|أنشئ|انشئ|create|generate|draw|design|animate|make)[\s\S]{0,100}(?:صورة|صوره|صور|فيديو|كليب|image|picture|photo|video|clip)/i.test(
    text,
  );
}
// Wan video takes plain ratios ("16:9"); pixel pairs are rejected as unsupported.
function ratio(a: string) {
  return a === "9:16" ? "9:16" : a === "1:1" ? "1:1" : "16:9";
}
const MODELS = [
  {
    id: "img-fast",
    kind: "image",
    label: "Higgsfield Image",
    tier: "pro",
    provider: "google",
    endpoint: "gemini-3.1-flash-image-preview",
  },
  {
    id: "vid-fast",
    kind: "video",
    label: "Higgsfield Video",
    tier: "pro",
    provider: "wan",
    endpoint: "wan2.7-t2v",
  },
];
function costUsd(kind: "image" | "video", endpoint: string, seconds: number) {
  if (kind === "video")
    return /seedance|byteplus|bytedance/i.test(endpoint)
      ? seconds * 0.1672
      : /minimax/i.test(endpoint)
        ? seconds * 0.088
        : seconds * 0.02684;
  if (/openai|gpt-image|dall/i.test(endpoint)) return 0.2321;
  if (/wan.*pro/i.test(endpoint)) return 0.053625;
  return 0.02145;
}
async function startMedia(
  uid: string,
  token: string | null,
  kind: "image" | "video",
  prompt: string,
  aspect = "1:1",
  duration = 5,
  idempotencyKey = crypto.randomUUID(),
) {
  if ((await userTier(uid)) !== "pro")
    throw new ProviderError(
      402,
      "upgrade_required",
      "Images and video are available on the Pro plan.",
    );
  const model = MODELS.find((m) => m.kind === kind)!;
  const seconds = kind === "video" ? Math.min(Math.max(Number(duration) || 5, 2), 5) : 1;
  // Direct UI requests are charged before the provider run. MCP media calls
  // preserve the existing Pro-only gate; the AgentSky usage ledger settles them.
  if (token) {
    const charge = await chargeKnown(
      token,
      costUsd(kind, model.endpoint, seconds),
      kind === "video" ? "video_generation" : "image_generation",
      `${model.label} · ${kind === "video" ? `${seconds}s` : "1 asset"}`,
    );
    if (!charge.ok)
      throw new ProviderError(
        402,
        "insufficient_credits",
        `This ${kind} needs ${charge.credits} credits. You are out of credits — upgrade your plan to keep going.`,
      );
  }
  return await runMediaOnGateway(uid, kind, prompt, aspect, seconds, idempotencyKey);
}
/** Same body + Idempotency-Key always maps to the same gateway job, so a retry resumes it. */
async function runMediaOnGateway(
  uid: string,
  kind: "image" | "video",
  prompt: string,
  aspect: string,
  seconds: number,
  idempotencyKey: string,
) {
  const model = MODELS.find((m) => m.kind === kind)!;
  const input =
    kind === "image"
      ? { prompt: prompt.slice(0, 5000), aspect_ratio: aspect }
      : {
          prompt: prompt.slice(0, 5000),
          ratio: ratio(aspect),
          duration: seconds,
          resolution: "720P",
        };
  return await gateway<any>("/run", {
    method: "POST",
    headers: { "Idempotency-Key": `${kind}-${uid}-${idempotencyKey}`.slice(0, 120) },
    body: JSON.stringify({ provider: model.provider, endpoint: model.endpoint, input }),
  });
}
async function readRun(runId: string) {
  return gateway<any>(`/runs/${encodeURIComponent(runId)}`);
}
function extractMedia(run: any) {
  const out = run?.output ?? {};
  const media: { value: string; kind: "url" | "b64"; mime: string }[] = [];
  for (const d of out.data ?? [])
    if (d?.b64_json) media.push({ value: d.b64_json, kind: "b64", mime: "image/png" });
  for (const c of out.candidates ?? [])
    for (const p of c?.content?.parts ?? [])
      if (p?.inlineData?.data)
        media.push({
          value: p.inlineData.data,
          kind: "b64",
          mime: p.inlineData.mimeType || "image/png",
        });
  for (const c of out.output?.choices ?? [])
    for (const x of c?.message?.content ?? [])
      if (x?.image) media.push({ value: x.image, kind: "url", mime: "image/png" });
  if (out.video_url) media.push({ value: out.video_url, kind: "url", mime: "video/mp4" });
  return media;
}
async function runState(runId: string) {
  const run = await readRun(runId);
  const items = run.status === "COMPLETED" ? extractMedia(run) : [];
  return {
    runId,
    status: run.status,
    error: run.error?.message,
    urls: await Promise.all(items.map((_, i) => mediaUrl(runId, i))),
  };
}
async function waitRun(runId: string, ms: number) {
  const end = Date.now() + ms;
  let state = await runState(runId);
  while (state.status === "RUNNING" && Date.now() < end) {
    await new Promise((r) => setTimeout(r, 2500));
    state = await runState(runId);
  }
  return state;
}

async function handleApi(request: Request, path: string, user: { user: any; token: string }) {
  const uid = user.user.id;
  const token = user.token;
  const parts = path.split("/").filter(Boolean);
  const method = request.method;
  const body =
    method === "GET" || method === "DELETE" ? null : await request.json().catch(() => ({}));
  if (parts[0] === "bootstrap" && method === "GET") {
    const tier = await userTier(uid);
    try {
      await ensureDefaultAgent(uid);
      const owned = await listUserAgents(uid);
      const details = await Promise.all(
        owned.map((a: any) =>
          api<{ agent: any }>(`/agents/${a.id}`)
            .then((r) => r.agent)
            .catch(() => a),
        ),
      );
      const templates = await listTemplates().catch(() => []);
      const catalog = templates.map((a: any, i: number) => ({
        id: `template:${a.id}`,
        name: String(a.name).replace(/^Chat · /, ""),
        description: a.llm || "",
        color: ["ocean", "mint", "rose", "ember"][i % 4],
        prompt: "",
        isDefault: false,
        isTemplate: true,
        createdAt: a.createdAt || "",
      }));
      const agents = [
        ...details
          .filter((a: any) => !a.metadata?.templateId && a.metadata?.kind !== "media")
          .map(agentView),
        ...catalog,
        {
          id: "higgsfield",
          name: "Higgsfield",
          description: "Images & video",
          color: "sun",
          prompt: "",
          isDefault: false,
          isTemplate: true,
          mediaOnly: true,
          createdAt: "",
        },
      ].sort((a: any, b: any) => Number(b.isDefault) - Number(a.isDefault));
      return json({
        agents,
        tier,
        models: mediaModels(tier),
        offer: { active: false, endsAt: "2026-10-07T00:52:09Z" },
      });
    } catch (e) {
      if (e instanceof ProviderError && (e.code === "not_configured" || e.status >= 500))
        return json({
          agents: fallbackAgents(),
          tier,
          models: mediaModels(tier),
          offer: { active: false, endsAt: "2026-10-07T00:52:09Z" },
        });
      if (
        e instanceof ProviderError &&
        /payment_setup_required|billing|top[\s_-]?up|insufficient/i.test(`${e.code} ${e.message}`)
      )
        return json(
          rpcError(
            "billing_required",
            "The AgentSky key needs billing enabled (credits or auto top-up in Settings → Billing) before agents can be created.",
          ),
          402,
        );
      throw e;
    }
  }
  if (parts[0] === "agents") {
    if (method === "POST" && !parts[1]) {
      const name = String(body?.name || "").trim();
      const description = String(body?.description || "").trim();
      const prompt = String(body?.prompt || "").trim();
      if (
        name.length < 2 ||
        name.length > 40 ||
        description.length > 200 ||
        prompt.length < 10 ||
        prompt.length > 5000
      )
        return json(
          rpcError("invalid_request", "Please provide a valid name, description and instructions."),
          400,
        );
      const spec = await agentSpecFor(
        uid,
        name,
        "custom",
        `${description}\n\n${prompt}`,
        String(body?.color || "aurora"),
      );
      const { agent } = await api<{ agent: any }>("/agents", {
        method: "POST",
        body: JSON.stringify(spec),
      });
      return json({ agent: agentView(agent) }, 201);
    }
    if (parts[1] && method === "PATCH") {
      const name = String(body?.name || "").trim();
      const description = String(body?.description || "").trim();
      const prompt = String(body?.prompt || "").trim();
      const color = String(body?.color || "aurora");
      if (
        name.length < 2 ||
        name.length > 60 ||
        description.length < 10 ||
        description.length > 500 ||
        prompt.length < 20 ||
        prompt.length > 6000 ||
        !["aurora", "ocean", "ember", "mint", "sun", "rose", "mono"].includes(color)
      )
        return json(
          rpcError("invalid_request", "Please provide a valid name, description and instructions."),
          400,
        );
      const a = await getOwnedAgent(uid, parts[1]);
      const basePrompt = String(a.prompt || "").split("\n\nYour persona and job:")[0];
      const { agent } = await api<{ agent: any }>(`/agents/${encodeURIComponent(a.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: name,
          description,
          prompt: `${basePrompt}\n\nYour persona and job:\n${prompt}`.slice(0, 100000),
          metadata: { ...a.metadata, color, userPrompt: prompt },
        }),
      });
      return json({ agent: agentView(agent) });
    }
    if (parts[1] && method === "DELETE") {
      const a = await getOwnedAgent(uid, parts[1]);
      if (String(a.name).endsWith("_default"))
        return json(rpcError("forbidden", "Default agent"), 403);
      await api(`/agents/${a.id}/archive`, { method: "POST", body: "{}" });
      return json({ ok: true });
    }
  }
  if (parts[0] === "sessions") {
    const sid = parts[1];
    if (!sid && method === "GET") {
      const agents = await listUserAgents(uid);
      const lists = await Promise.all(
        agents.map((a: any) =>
          api<{ sessions: any[] }>(`/sessions?agent=${a.id}`)
            .then((r) => r.sessions)
            .catch(() => []),
        ),
      );
      const sessions = lists
        .flat()
        .filter((s: any) => s.metadata?.owner === uid && !s.archived)
        .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map((s: any) => ({
          id: s.id,
          agentId: s.agentId,
          title: s.title || "New chat",
          status: s.status,
          createdAt: s.createdAt,
        }));
      return json({ sessions });
    }
    if (!sid && method === "POST") {
      const requested = typeof body?.agentId === "string" ? body.agentId : undefined;
      const tier = await userTier(uid);
      if (requested === "higgsfield" && tier === "free")
        return json(
          rpcError("upgrade_required", "Images and video are available on the Pro plan."),
          402,
        );
      const defaultAgent = await ensureDefaultAgent(uid);
      if (
        tier === "free" &&
        requested &&
        requested !== defaultAgent.id &&
        !requested.startsWith("template:builtin-")
      )
        return json(
          rpcError("upgrade_required", "Switching agents is available on the Pro plan."),
          402,
        );
      const selected = requested?.startsWith("template:builtin-")
        ? defaultAgent
        : await resolveAgent(uid, requested);
      const content = contentOf(body);
      if (!content.length) return json(rpcError("invalid_request", "Empty message"), 400);
      const balance = await creditBalance(token);
      if (balance !== null && balance <= 0)
        return json(
          rpcError(
            "insufficient_credits",
            "You are out of credits. Upgrade your plan to keep going.",
          ),
          402,
        );
      const title =
        String(body?.text || "New chat")
          .replace(/\s+/g, " ")
          .slice(0, 80) || "New chat";
      const { session } = await api<{ session: any }>("/sessions", {
        method: "POST",
        body: JSON.stringify({
          agent: selected.id,
          title,
          metadata: { owner: uid },
          idleTimeoutSeconds: 43200,
          initial_events: [{ type: "user.message", content }],
        }),
      });
      await openTurn(token, session.id, inputChars(content));
      return json(
        {
          session: { id: session.id, agentId: selected.id, title, status: session.status },
          agent: agentView(selected),
        },
        201,
      );
    }
    if (!sid) return json(rpcError("not_found", "Not found"), 404);
    const session = await getOwnedSession(uid, sid);
    if (!parts[2] && method === "GET")
      return json({
        session: {
          id: session.id,
          agentId: session.agentId,
          title: session.title,
          status: session.status,
        },
      });
    if (!parts[2] && method === "PATCH") {
      await api(`/sessions/${sid}`, {
        method: "PATCH",
        body: JSON.stringify({ title: String(body?.title || "").slice(0, 120) }),
      });
      return json({ ok: true });
    }
    if (!parts[2] && method === "DELETE") {
      await api(`/sessions/${sid}/archive`, { method: "POST", body: "{}" });
      return json({ ok: true });
    }
    if (parts[2] === "events" && method === "GET") {
      const r = await api<{ events: any[] }>(`/sessions/${sid}/events?limit=500`);
      return json({ events: r.events, status: session.status });
    }
    if (parts[2] === "stream" && method === "GET") {
      const turnId = await latestOpenTurn(token, sid);
      // Use the request-pinned key so the stream reads from the same workspace.
      const key = currentCtx().key;
      const upstream = await fetch(`${API}/sessions/${encodeURIComponent(sid)}/stream`, {
        headers: { Authorization: `Bearer ${key.value}`, Accept: "text/event-stream" },
        signal: request.signal,
      });
      if (!upstream.ok || !upstream.body)
        return json(rpcError("stream_failed", `Stream ${upstream.status}`), 502);
      const reader = upstream.body.getReader();
      const encoder = new TextEncoder();
      let chars = 0;
      const started = Date.now();
      let buffer = "";
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              if (turnId) await settleTurn(token, turnId, chars, (Date.now() - started) / 1000);
              controller.close();
              return;
            }
            if (value) {
              buffer += new TextDecoder().decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";
              for (const line of lines)
                if (line.startsWith("data:")) {
                  try {
                    const e = JSON.parse(line.slice(5).trim());
                    if (!String(e?.type || "").includes("user.message"))
                      chars += JSON.stringify(e).length;
                  } catch {
                    /* ignore */
                  }
                }
              controller.enqueue(value);
            }
          } catch (e) {
            controller.error(e);
          }
        },
        async cancel() {
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          if (turnId) await settleTurn(token, turnId, chars, (Date.now() - started) / 1000);
        },
      });
      return new Response(stream, {
        headers: {
          ...cors,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
        },
      });
    }
    if (parts[2] === "messages" && method === "POST") {
      const agent = await getOwnedAgent(uid, session.agentId);
      const tier = await userTier(uid);
      if (agent.metadata?.kind === "media" && tier === "free")
        return json(
          rpcError("upgrade_required", "Images and video are available on the Pro plan."),
          402,
        );
      if (mediaIntent(String(body?.text || "")) && tier === "free")
        return json(
          rpcError("upgrade_required", "Images and video are available on the Pro plan."),
          402,
        );
      const content = contentOf(body);
      if (!content.length) return json(rpcError("invalid_request", "Empty message"), 400);
      const balance = await creditBalance(token);
      if (balance !== null && balance <= 0)
        return json(
          rpcError(
            "insufficient_credits",
            "You are out of credits. Upgrade your plan to keep going.",
          ),
          402,
        );
      await openTurn(token, sid, inputChars(content));
      const r = await api<{ data: any[] }>(`/sessions/${sid}/events`, {
        method: "POST",
        body: JSON.stringify({ events: [{ type: "user.message", content }] }),
      });
      return json({ event: r.data?.[0] ?? null });
    }
    if (parts[2] === "interrupt" && method === "POST")
      return json(await api(`/sessions/${sid}/interrupt`, { method: "POST", body: "{}" }));
    if (parts[2] === "requests" && method === "GET") {
      const r = await api<{ task: any }>(`/tasks/${sid}?by=session`).catch(() => null);
      return json({ requests: r?.task?.requests ?? [], sessions: r?.task?.sessions ?? [] });
    }
  }
  if (parts[0] === "tasks" && method === "GET") {
    const owned = await listUserAgents(uid);
    const ids = new Set(owned.map((a: any) => a.id));
    if (parts[1]) {
      const r = await api<{ task: any }>(`/tasks/${encodeURIComponent(parts[1])}`);
      if (!r.task?.agent_id || !ids.has(r.task.agent_id))
        return json(rpcError("not_found", "Task not found"), 404);
      return json({ sessions: r.task.sessions || [] });
    }
    const { tasks = [] } = await api<{ tasks: any[] }>("/tasks").catch(() => ({ tasks: [] }));
    return json({
      tasks: tasks
        .filter((t: any) => t.agent_id && ids.has(t.agent_id) && !t.archived)
        .map((t: any) => ({
          id: t.id,
          agentId: t.agent_id,
          title: t.title,
          attention: t.attention,
          statusLine: t.status_line,
          openRequests: t.open_request_count,
          helpers: Math.max(0, (t.session_count || 1) - 1),
          lastActivityAt: t.last_activity_at,
        })),
    });
  }
  if (parts[0] === "media" && method === "POST") {
    const kind = body?.kind === "video" ? "video" : "image";
    const prompt = String(body?.prompt || "")
      .trim()
      .slice(0, 5000);
    if (!prompt) return json(rpcError("invalid_request", "Prompt is required"), 400);
    const idemKey = String(body?.idempotencyKey || crypto.randomUUID());
    const started = startMedia(
      uid,
      token,
      kind,
      prompt,
      String(body?.aspect || "1:1"),
      Number(body?.duration) || 5,
      idemKey,
    );
    // The gateway's /run blocks until the video is rendered (minutes), longer than
    // the HTTP proxy allows. Past ~60s we hand back a pending id and finish in the
    // background; media-status resolves it once the real run id is stored.
    const TIMEOUT = Symbol("timeout");
    const first = await Promise.race([
      started,
      new Promise<typeof TIMEOUT>((r) => setTimeout(() => r(TIMEOUT), 60_000)),
    ]);
    let runId: string;
    let status: string;
    if (first === TIMEOUT) {
      runId = `pend_${crypto.randomUUID().replace(/-/g, "")}`;
      status = "RUNNING";
      const seconds = kind === "video" ? Math.min(Math.max(Number(body?.duration) || 5, 2), 5) : 1;
      const { error: kvErr } = await admin.from("app_kv").insert({
        project_id: "00000000-0000-0000-0000-000000000000",
        user_id: uid,
        key: `agentsky_pending:${runId}`,
        value: { job: { kind, prompt, aspect: String(body?.aspect || "1:1"), seconds, idem: idemKey } },
      });
      if (kvErr) console.error("[agentsky] pending insert failed", kvErr.message);
      // Only a real run id is stored here; transport timeouts are left for the
      // status poll to resume, so they never overwrite a resolved result.
      const finish = started
        .then((run: any) =>
          run?.runId
            ? admin
                .from("app_kv")
                .update({ value: { runId: run.runId, status: run.status } })
                .eq("key", `agentsky_pending:${runId}`)
            : null,
        )
        .catch(() => null);
      (globalThis as any).EdgeRuntime?.waitUntil?.(finish);
    } else {
      runId = (first as any).runId;
      status = (first as any).status;
    }
    return json({
      runId,
      token: await statusToken(runId),
      model: kind === "image" ? "Higgsfield Image" : "Higgsfield Video",
      status,
    });
  }
  return json(rpcError("not_found", "Not found"), 404);
}

const TOOLS = [
  {
    name: "generate_image",
    description: "Create an image from a detailed prompt. The image is shown automatically.",
    inputSchema: {
      type: "object",
      properties: { prompt: { type: "string" }, aspect_ratio: { type: "string" } },
      required: ["prompt"],
    },
  },
  {
    name: "generate_video",
    description: "Generate a short video. The user sees a rendering card automatically.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        aspect_ratio: { type: "string" },
        duration: { type: "number" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "ask_user",
    description: "Ask the user a short question and wait for their response.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
        options: { type: "array", items: { type: "string" } },
      },
      required: ["question"],
    },
  },
  {
    name: "megsy_card",
    description: "Show structured data in a UI card.",
    inputSchema: {
      type: "object",
      properties: { widget: { type: "string" }, data: { type: "object" } },
      required: ["widget"],
    },
  },
  {
    name: "show_service_result",
    description: "Render a connected-service result as a card.",
    inputSchema: {
      type: "object",
      properties: {
        service: { type: "string" },
        action: { type: "string" },
        summary: { type: "string" },
        text: { type: "string" },
        url: { type: "string" },
      },
    },
  },
  {
    name: "update_plan",
    description: "Update the visible work plan.",
    inputSchema: {
      type: "object",
      properties: { steps: { type: "array", items: { type: "object" } } },
      required: ["steps"],
    },
  },
  {
    name: "propose_agent",
    description: "Propose a personal agent; do not create it without approval.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        prompt: { type: "string" },
        color: { type: "string" },
      },
      required: ["name", "description", "prompt"],
    },
  },
];
function mcpResult(id: unknown, text: string, payload?: unknown) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: payload ? `${text}\n<!--megsy:${JSON.stringify(payload)}-->` : text,
        },
      ],
      ...(payload ? { structuredContent: payload } : {}),
    },
  };
}
async function handleTool(uid: string, name: string, args: any, callId: string) {
  if (name === "generate_image" || name === "generate_video") {
    const kind = name === "generate_video" ? "video" : "image";
    const prompt = String(args?.prompt || "")
      .trim()
      .slice(0, 5000);
    if (!prompt) return { text: "Missing prompt." };
    const run = await startMedia(
      uid,
      "",
      kind,
      prompt,
      String(args?.aspect_ratio || (kind === "image" ? "1:1" : "16:9")),
      Number(args?.duration) || 5,
      callId,
    );
    const state =
      kind === "image" ? await waitRun(run.runId, 55_000) : { status: run.status, urls: [] };
    const payload = {
      type: "megsy.media",
      kind,
      runId: run.runId,
      token: await statusToken(run.runId),
      status: state.status,
      urls: state.urls,
      model: kind === "image" ? "Higgsfield Image" : "Higgsfield Video",
      prompt,
    };
    return {
      text:
        state.status === "COMPLETED"
          ? `Done — the ${kind} is shown to the user.`
          : `The ${kind} is rendering and will appear automatically.`,
      payload,
    };
  }
  if (name === "ask_user")
    return {
      text: "The question is shown to the user. Stop and wait for the answer.",
      payload: {
        type: "megsy.ask",
        question: String(args?.question || ""),
        options: Array.isArray(args?.options) ? args.options.slice(0, 8) : [],
      },
    };
  if (name === "megsy_card")
    return {
      text: "The data card is shown to the user.",
      payload: { type: "megsy.widget", widget: String(args?.widget || ""), data: args?.data || {} },
    };
  if (name === "show_service_result")
    return {
      text: "The service result is shown as a card.",
      payload: {
        type: "megsy.service",
        service: String(args?.service || "Service"),
        action: String(args?.action || "Action"),
        summary: String(args?.summary || ""),
        url: args?.url,
        result: args?.text ? { text: String(args.text).slice(0, 4000) } : null,
      },
    };
  if (name === "update_plan")
    return {
      text: "Plan updated.",
      payload: {
        type: "megsy.plan",
        steps: Array.isArray(args?.steps) ? args.steps.slice(0, 20) : [],
      },
    };
  if (name === "propose_agent") {
    if (!String(args?.name || "").trim() || !String(args?.prompt || "").trim())
      return { text: "A name and purpose are required." };
    return {
      text: "The proposal and Create agent button are shown. Nothing has been created.",
      payload: {
        type: "megsy.agent_proposal",
        proposal: {
          name: String(args.name).slice(0, 40),
          description: String(args.description || "").slice(0, 200),
          prompt: String(args.prompt).slice(0, 5000),
          color: String(args.color || "aurora"),
        },
      },
    };
  }
  return { text: `Unknown tool ${name}` };
}
async function handleMcp(request: Request, tokenText: string) {
  const [uid, expText, sig] = decodeURIComponent(tokenText).split(".");
  const exp = Number(expText);
  if (
    !uid ||
    !Number.isFinite(exp) ||
    exp < Math.floor(Date.now() / 1000) ||
    !(await verify(`mcp:${uid}:${exp}`, sig))
  )
    return json({ error: "unauthorized" }, 401);
  let msg: any;
  try {
    msg = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  const id = msg?.id;
  if (id === undefined || id === null) return new Response(null, { status: 202, headers: cors });
  if (msg.method === "initialize")
    return json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: msg.params?.protocolVersion || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "megsy", version: "1.1.0" },
      },
    });
  if (msg.method === "ping") return json({ jsonrpc: "2.0", id, result: {} });
  if (msg.method === "tools/list") return json({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
  if (msg.method === "tools/call") {
    const name = String(msg.params?.name || "");
    try {
      const r = await withKey(() => handleTool(uid, name, msg.params?.arguments || {}, String(id)));
      return json(mcpResult(id, r.text, r.payload));
    } catch (e: any) {
      return json({
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [{ type: "text", text: String(e?.message || e).slice(0, 400) }],
        },
      });
    }
  }
  return json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } });
}

async function handlePublic(request: Request, route: string) {
  const params = requestUrl(request).searchParams;
  if (route === "tools" && params.get("token") && request.method === "POST")
    return handleMcp(request, params.get("token") || "");
  if (route === "media-status" && request.method === "GET") {
    const runId = requestUrl(request).searchParams.get("runId") || "";
    const t = requestUrl(request).searchParams.get("t") || "";
    const [expText, sig] = t.split(".");
    const exp = Number(expText);
    if (
      !runId ||
      !Number.isFinite(exp) ||
      exp < Math.floor(Date.now() / 1000) ||
      !(await verify(`status:${runId}:${exp}`, sig))
    )
      return json(rpcError("unauthorized", "Invalid media token"), 403);
    try {
      let realId = runId;
      if (runId.startsWith("pend_")) {
        const { data } = await admin
          .from("app_kv")
          .select("value")
          .eq("key", `agentsky_pending:${runId}`)
          .maybeSingle();
        let v: any = data?.value;
        if (v?.job && !v.runId && !v.error) {
          // Background finisher was cut off by the edge time limit: resume the
          // same gateway job (idempotent) for up to ~40s on this poll.
          const { data: row } = await admin.from("app_kv").select("user_id").eq("key", `agentsky_pending:${runId}`).maybeSingle();
          const j = v.job;
          const res = await withKey(() =>
            Promise.race([
              runMediaOnGateway(row?.user_id || "", j.kind, j.prompt, j.aspect, j.seconds, j.idem)
                .then((r: any) => ({ runId: r.runId, status: r.status }))
                .catch((e: any) => ({ error: String(e?.message || e) })),
              new Promise<null>((r) => setTimeout(() => r(null), 40_000)),
            ]),
          );
          if (res && ((res as any).runId || !/<!DOCTYPE|timeout|timed out|52\d|50[234]/i.test((res as any).error || ""))) {
            v = res;
            await admin.from("app_kv").update({ value: res }).eq("key", `agentsky_pending:${runId}`);
          }
        }
        if (!v || (!v.runId && !v.error)) return json({ runId, status: "RUNNING", urls: [] });
        if (v.error || !v.runId) return json({ runId, status: "FAILED", urls: [], error: v.error || "failed" });
        realId = v.runId;
      }
      // Public route has no user JWT, but provider calls still need a key.
      return json({ ...(await withKey(() => runState(realId))), runId });
    } catch (e: any) {
      return json({ runId, status: "RUNNING", urls: [], error: String(e?.message || e) });
    }
  }
  if (route === "media" && params.get("runId") && params.has("index") && request.method === "GET") {
    const runId = params.get("runId") || "";
    const index = Number(params.get("index"));
    const s = params.get("s") || "";
    const [expText, sig] = s.split(".");
    const exp = Number(expText);
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      !Number.isFinite(exp) ||
      exp < Math.floor(Date.now() / 1000) ||
      !(await verify(`media:${runId}:${index}:${exp}`, sig))
    )
      return new Response("Forbidden", { status: 403, headers: cors });
    const run = await withKey(() => readRun(runId));
    const item = extractMedia(run)[index];
    if (!item) return new Response("Not found", { status: 404, headers: cors });
    if (item.kind === "url") return Response.redirect(item.value, 302);
    const bytes = Uint8Array.from(atob(item.value), (c) => c.charCodeAt(0));
    return new Response(bytes, {
      headers: { ...cors, "Content-Type": item.mime, "Cache-Control": "private, max-age=3600" },
    });
  }
  return json(rpcError("not_found", "Not found"), 404);
}
function requestUrl(request: Request) {
  return new URL(request.url);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!SERVICE_KEY || !SUPABASE_URL)
    return json(rpcError("not_configured", "Supabase Edge Function secrets are missing."), 500);
  try {
    const url = requestUrl(request);
    const routePath = url.searchParams.get("path");
    if (!routePath) return await handlePublic(request, url.searchParams.get("route") || "");
    const user = await requireUser(request);
    if (!user) return json(rpcError("unauthorized", "Please sign in"), 401);
    return await withKey(() => handleApi(request, routePath.replace(/^\/+/, ""), user));
  } catch (e: any) {
    if (e instanceof ProviderError)
      return json(rpcError(e.code, e.message), e.status >= 400 && e.status < 600 ? e.status : 502);
    console.error("[agentsky-edge]", String(e?.message || e).slice(0, 300));
    return json(rpcError("server_error", "Something went wrong. Please try again."), 500);
  }
});
