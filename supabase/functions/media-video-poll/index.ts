import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Keep the poller's key lookup inside this function's deployment bundle.
// Supabase bundles each function separately and cannot resolve a sibling's files.
type VaultKey = { id: string; key: string; table: "service_keys" | "provider_api_keys" };
async function vaultKeys(provider: string): Promise<VaultKey[]> {
  const keys: VaultKey[] = [];
  const { data: encrypted } = await db.from("service_keys")
    .select("id,key_cipher,key_iv").eq("provider", provider).eq("status", "active").limit(25);
  const secret = Deno.env.get("KEY_VAULT_SECRET")?.trim();
  if (secret) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    const aes = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["decrypt"]);
    for (const row of encrypted ?? []) {
      try {
        const plaintext = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: Uint8Array.from(atob(row.key_iv), (c) => c.charCodeAt(0)) },
          aes, Uint8Array.from(atob(row.key_cipher), (c) => c.charCodeAt(0)),
        );
        keys.push({ id: row.id, key: new TextDecoder().decode(plaintext), table: "service_keys" });
      } catch { /* Ignore keys that cannot be decrypted. */ }
    }
  }
  const { data: legacy } = await db.from("provider_api_keys")
    .select("id,api_key").eq("provider", provider).eq("status", "active").limit(25);
  for (const row of legacy ?? []) {
    if (row.api_key) keys.push({ id: row.id, key: row.api_key, table: "provider_api_keys" });
  }
  return keys;
}
async function noteKeyOk(key: VaultKey) {
  await db.from(key.table).update({ last_used_at: new Date().toISOString() }).eq("id", key.id);
}
async function noteKeyFail(key: VaultKey, message: string, status: number) {
  const patch = status === 401 || status === 403
    ? { status: "depleted", last_error: message.slice(0, 400) }
    : { last_error: message.slice(0, 400) };
  await db.from(key.table).update(patch).eq("id", key.id);
}
function providerError(status: number, body: string) {
  return `Runway ${status}: ${body.slice(0, 400)}`;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const out = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function firstVideoUrl(value: unknown, depth = 0): string | null {
  if (depth > 8 || value == null) return null;
  if (typeof value === "string")
    return /^https?:\/\/\S+/.test(value) && /\.(mp4|webm|mov)(\?\S*)?$/i.test(value) ? value : null;
  if (Array.isArray(value))
    for (const item of value) {
      const hit = firstVideoUrl(item, depth + 1);
      if (hit) return hit;
    }
  if (typeof value === "object")
    for (const item of Object.values(value as Record<string, unknown>)) {
      const hit = firstVideoUrl(item, depth + 1);
      if (hit) return hit;
    }
  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await db.auth.getUser(token) : ({ data: { user: null } } as any);
  if (!auth?.user) return out({ status: "failed", error: "Sign in to poll this video job." }, 401);
  const body = await request.json().catch(() => ({}));
  const jobId = String(body?.job_id || "");
  if (!jobId) return out({ status: "failed", error: "job_id is required" }, 400);

  const { data: job, error: jobError } = await db
    .from("pending_video_jobs")
    .select(
      "id,user_id,provider,generation_id,api_key_id,status,video_url,error,refunded,credits_charged,model_slug",
    )
    .eq("id", jobId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (jobError || !job) return out({ status: "failed", error: "Video job not found." }, 404);
  if (job.status === "completed" && job.video_url)
    return out({ status: "completed", video_url: job.video_url });
  if (job.status === "failed")
    return out({ status: "failed", error: job.error || "Video job failed." });
  if (job.provider === "wavespeed") return pollWave(job, auth.user.id);
  if (job.provider !== "runway")
    return out({ status: "failed", error: "Only Runway video jobs are supported." }, 400);

  const keys = await vaultKeys("runway");
  const key = keys.find((item) => item.id === job.api_key_id) || keys[0];
  if (!key) return out({ status: "failed", error: "Runway API key is not configured." }, 503);
  try {
    const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${job.generation_id}`, {
      headers: { Authorization: `Bearer ${key.key}`, "X-Runway-Version": "2024-11-06" },
    });
    const payload: any = await response.json().catch(() => null);
    if (!response.ok) {
      const errorText = JSON.stringify(payload ?? {});
      await noteKeyFail(key, providerError(response.status, errorText), response.status);
      return out({ status: "processing" });
    }
    const status = String(payload?.status || "").toLowerCase();
    if (["succeeded", "completed", "complete", "success"].includes(status)) {
      const videoUrl = firstVideoUrl(payload?.output ?? payload);
      if (!videoUrl) throw new Error("Runway completed without a video URL");
      await db
        .from("pending_video_jobs")
        .update({ status: "completed", video_url: videoUrl, updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("user_id", auth.user.id);
      await noteKeyOk(key);
      return out({ status: "completed", video_url: videoUrl });
    }
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      const message = String(payload?.failure || payload?.error || "Runway video task failed");
      await db
        .from("pending_video_jobs")
        .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("user_id", auth.user.id);
      if (!job.refunded) {
        await db.rpc("grant_user_credits", {
          p_user_id: auth.user.id,
          p_amount: Number(job.credits_charged || 0),
          p_action_type: "video_generation_refund",
          p_description: `Refund for failed ${job.model_slug} task`,
        });
        await db
          .from("pending_video_jobs")
          .update({ refunded: true })
          .eq("id", job.id)
          .eq("user_id", auth.user.id)
          .eq("refunded", false);
      }
      await noteKeyFail(key, message, 400);
      return out({ status: "failed", error: message });
    }
    const progress = Number(payload?.progress ?? payload?.percent ?? 0);
    return out({ status: "processing", progress: Number.isFinite(progress) ? progress : 0 });
  } catch (error) {
    return out({
      status: "processing",
      error: error instanceof Error ? error.message : "Runway polling failed",
    });
  }
});

async function pollWave(job: any, userId: string) {
  const keys = await vaultKeys("wavespeed");
  const key = keys.find((item) => item.id === job.api_key_id) || keys[0];
  if (!key) return out({ status: "failed", error: "WaveSpeed API key is not configured." }, 503);
  try {
    const response = await fetch(
      `https://api.wavespeed.ai/api/v3/predictions/${job.generation_id}/result`,
      { headers: { Authorization: `Bearer ${key.key}` } },
    );
    const payload: any = await response.json().catch(() => null);
    if (!response.ok) return out({ status: "processing" });
    const data = payload?.data ?? payload;
    const status = String(data?.status || "").toLowerCase();
    if (["completed", "succeeded", "success"].includes(status)) {
      const first = Array.isArray(data?.outputs) ? data.outputs[0] : null;
      const videoUrl = firstVideoUrl(data?.outputs ?? data) || (typeof first === "string" ? first : null);
      if (!videoUrl) throw new Error("WaveSpeed completed without a video URL");
      await db
        .from("pending_video_jobs")
        .update({ status: "completed", video_url: videoUrl, updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("user_id", userId);
      return out({ status: "completed", video_url: videoUrl });
    }
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      const message = String(data?.error || "WaveSpeed video task failed");
      await db
        .from("pending_video_jobs")
        .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("user_id", userId);
      if (!job.refunded && Number(job.credits_charged || 0) > 0) {
        await db.rpc("grant_user_credits", {
          p_user_id: userId,
          p_amount: Number(job.credits_charged || 0),
          p_action_type: "video_generation_refund",
          p_description: `Refund for failed ${job.model_slug} task`,
        });
        await db
          .from("pending_video_jobs")
          .update({ refunded: true })
          .eq("id", job.id)
          .eq("user_id", userId)
          .eq("refunded", false);
      }
      return out({ status: "failed", error: message });
    }
    return out({ status: "processing" });
  } catch (error) {
    return out({
      status: "processing",
      error: error instanceof Error ? error.message : "WaveSpeed polling failed",
    });
  }
}
