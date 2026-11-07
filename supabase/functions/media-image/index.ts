import { createClient } from "npm:@supabase/supabase-js@2";
import {
  noteKeyAttempt,
  noteKeyFail,
  noteKeyOk,
  providerError,
  vaultKeys,
} from "../media-video/_shared/keyVault.ts";

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

// Lowest quality tier (cheapest Runway credits).
function ratio(aspect?: string) {
  if (aspect === "9:16") return "1088:1920";
  if (aspect === "16:9") return "1920:1088";
  if (aspect === "3:4") return "1440:1920";
  if (aspect === "4:3") return "1920:1440";
  return "1920:1920";
}
function firstImage(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) return null;
  if (typeof value === "string" && /^https?:\/\/\S+/.test(value)) return value;
  if (Array.isArray(value))
    for (const item of value) {
      const hit = firstImage(item, depth + 1);
      if (hit) return hit;
    }
  if (typeof value === "object")
    for (const item of Object.values(value as Record<string, unknown>)) {
      const hit = firstImage(item, depth + 1);
      if (hit) return hit;
    }
  return null;
}

async function generateRunway(
  key: string,
  prompt: string,
  model: string,
  aspect: string | undefined,
  refs: string[],
) {
  const body: Record<string, unknown> = {
    model,
    promptText: prompt,
    ratio: ratio(aspect),
    quality: "low",
    outputCount: 1,
  };
  if (refs.length) body.referenceImages = refs.slice(0, 16).map((uri) => ({ uri }));
  const create = await fetch("https://api.dev.runwayml.com/v1/text_to_image", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "X-Runway-Version": "2024-11-06",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const createText = await create.text();
  if (!create.ok) {
    const error = new Error(providerError(create.status, createText));
    (error as any).providerStatus = create.status;
    throw error;
  }
  const task = JSON.parse(createText);
  if (!task?.id) throw new Error("Runway image returned no task id");
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${task.id}`, {
      headers: { Authorization: `Bearer ${key}`, "X-Runway-Version": "2024-11-06" },
    });
    const status: any = await statusResponse.json().catch(() => null);
    const state = String(status?.status ?? "").toUpperCase();
    if (state === "SUCCEEDED") {
      const url = firstImage(status?.output ?? status);
      if (!url) throw new Error("Runway image completed without an image URL");
      return url;
    }
    if (["FAILED", "CANCELED", "CANCELLED"].includes(state))
      throw new Error(`Runway image task ${state}: ${JSON.stringify(status).slice(0, 400)}`);
  }
  throw new Error("Runway image timed out waiting for output");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !serviceKey || !token) return out({ error: true, message: "sign in required" }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return out({ error: true, message: "invalid session" }, 401);
  const { data: paid } = await admin.rpc("has_paid_plan", { p_user_id: auth.user.id });
  if (paid !== true) {
    return out({ error: true, paywall: true, message: "الصور المجانية بتتولد عبر Wan فقط، بحد أقصى 5 صور يوميًا." }, 402);
  }
  let body: any;
  try {
    body = await request.json();
  } catch {
    return out({ error: true, message: "invalid json" }, 400);
  }
  const prompt = String(body?.prompt ?? "").trim();
  if (!prompt) return out({ error: true, message: "prompt is required" }, 400);
  // One fixed image model for the whole app: GPT Image 2 on Runway, low quality.
  const slug = "runway-gpt-image-2";
  const rawRefs = body?.reference_image_urls ?? body?.reference_image_url ?? body?.image_url;
  const refs = (Array.isArray(rawRefs) ? rawRefs : rawRefs ? [rawRefs] : [])
    .map((item) => String(item))
    .filter((item) => /^https?:\/\//.test(item));

  const keys = await vaultKeys("runway");
  if (!keys.length)
    return out({ error: true, message: "No active Runway keys are configured." }, 503);
  const model = "gpt_image_2";
  let lastError = "Runway image failed";
  for (const key of keys) {
    await noteKeyAttempt(key);
    try {
      const url = await generateRunway(key.key, prompt, model, body?.aspect_ratio, refs);
      await noteKeyOk(key);
      return out({
        image_url: url,
        image_urls: [url],
        url,
        provider: "runway",
        model_slug: slug,
        attempted_keys: keys.indexOf(key) + 1,
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Runway image failed";
      await noteKeyFail(key, lastError, Number((error as any)?.providerStatus || 500));
    }
  }
  return out({ error: true, message: lastError, attempted_keys: keys.length }, 502);
});
