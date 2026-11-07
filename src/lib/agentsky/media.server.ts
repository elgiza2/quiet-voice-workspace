/** @doc Media generation through the AgentSky run API, split into free and subscriber tiers.
 *  Generated media is never stored by us: a signed /api/public/media link re-reads the run
 *  from AgentSky and streams the bytes, so links keep working without a storage bucket. */
import { AgentSkyError, gateway, sign, verify } from "./agentsky.server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/api/supabaseServerConfig";

export type Tier = "free" | "pro";
export type MediaKind = "image" | "video";

export type MediaModel = {
  id: string;
  kind: MediaKind;
  label: string;
  tier: Tier;
  provider: string;
  endpoint: string;
  build: (p: { prompt: string; aspect: string; duration?: number }) => Record<string, unknown>;
};

const ratio = (a: string, allowed: string[], fallback: string) => (allowed.includes(a) ? a : fallback);

export const MEDIA_MODELS: MediaModel[] = [
  {
    id: "img-fast",
    kind: "image",
    label: "Higgsfield Image",
    tier: "pro",
    provider: "google",
    endpoint: "gemini-3.1-flash-image-preview",
    build: ({ prompt, aspect }) => ({ prompt, aspect_ratio: aspect }),
  },
  {
    id: "vid-fast",
    kind: "video",
    label: "Higgsfield Video",
    tier: "pro",
    provider: "wan",
    endpoint: "wan2.7-t2v",
    build: ({ prompt, aspect, duration }) => ({
      prompt,
      ratio: ratio(aspect, ["16:9", "9:16", "1:1", "4:3", "3:4"], "16:9"),
      duration: Math.min(Math.max(duration ?? 5, 2), 5),
      resolution: "720P",
    }),
  },

];

export function pickModel(kind: MediaKind, tier: Tier, requested?: string | null): MediaModel {
  if (tier === "free") throw new AgentSkyError(402, "upgrade_required", "Images and video are available on the Pro plan.");
  const model = MEDIA_MODELS.find((m) => m.kind === kind);
  if (!model) throw new AgentSkyError(400, "invalid_model", "Media model unavailable");
  return model;
}

export async function userTier(userId: string): Promise<Tier> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/has_paid_plan`, {
      method: "POST",
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_user_id: userId }),
    });
    return (await r.json()) === true ? "pro" : "free";
  } catch {
    return "free";
  }
}

/** Free users get a small daily video allowance; enforced by the database with the user's token. */
export async function consumeFreeVideo(userId: string, userJwt: string): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_agentsky_free_video`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${userJwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_user_id: userId, p_limit: 1 }),
  });
  if (!r.ok) return false;
  return (await r.json()) === true;
}

export type RunState = {
  runId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "TIMED_OUT";
  error?: string;
  urls: string[];
};

export async function startRun(model: MediaModel, input: Record<string, unknown>, idem: string) {
  const run = await gateway<any>("/run", {
    method: "POST",
    headers: { "Idempotency-Key": idem },
    body: JSON.stringify({ provider: model.provider, endpoint: model.endpoint, input }),
  });
  return run;
}

export async function readRun(runId: string) {
  return gateway<any>(`/runs/${encodeURIComponent(runId)}`);
}

/** Extract media from any run shape: data URLs (base64) or remote URLs. */
export function extractMedia(run: any): { kind: "b64" | "url"; value: string; mime: string }[] {
  const o = run?.output ?? {};
  const out: { kind: "b64" | "url"; value: string; mime: string }[] = [];
  for (const d of o.data ?? []) if (d?.b64_json) out.push({ kind: "b64", value: d.b64_json, mime: "image/png" });
  for (const c of o.candidates ?? [])
    for (const p of c?.content?.parts ?? [])
      if (p?.inlineData?.data)
        out.push({ kind: "b64", value: p.inlineData.data, mime: p.inlineData.mimeType || "image/png" });
  for (const ch of o.output?.choices ?? [])
    for (const c of ch?.message?.content ?? []) if (c?.image) out.push({ kind: "url", value: c.image, mime: "image/png" });
  if (o.video_url) out.push({ kind: "url", value: o.video_url, mime: "video/mp4" });
  return out;
}

export function mediaLink(origin: string, runId: string, index: number) {
  const v = `${runId}:${index}`;
  return `${origin}/api/public/media/${encodeURIComponent(runId)}/${index}?s=${sign("media:" + v)}`;
}
export const verifyMediaLink = (runId: string, index: number, s: string) =>
  verify("media:" + `${runId}:${index}`, s);

export function runStatusToken(runId: string) {
  return sign("status:" + runId);
}
export const verifyStatusToken = (runId: string, s: string) => verify("status:" + runId, s);

export async function runState(runId: string, origin: string): Promise<RunState> {
  const run = await readRun(runId);
  const media = run.status === "COMPLETED" ? extractMedia(run) : [];
  return {
    runId,
    status: run.status,
    error: run.error?.message,
    urls: media.map((_, i) => mediaLink(origin, runId, i)),
  };
}

/** Wait briefly for fast runs (images) so the agent can confirm the result. */
export async function waitRun(runId: string, origin: string, ms: number): Promise<RunState> {
  const end = Date.now() + ms;
  let s = await runState(runId, origin);
  while (s.status === "RUNNING" && Date.now() < end) {
    await new Promise((r) => setTimeout(r, 2500));
    s = await runState(runId, origin);
  }
  return s;
}

export function publicModels(tier: Tier) {
  return MEDIA_MODELS.map((m) => ({ id: m.id, kind: m.kind, label: m.label, tier: m.tier, locked: tier === "free" }));
}
