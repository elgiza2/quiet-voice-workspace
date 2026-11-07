// The one fixed image model: GPT Image 2 on Runway (dev API), lowest quality.
// Served by media-video under body.kind === "image".
import { noteKeyAttempt, noteKeyFail, noteKeyOk, providerError, vaultKeys } from "./_shared/keyVault.ts";

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

async function generate(key: string, prompt: string, aspect: string | undefined, refs: string[]) {
  const body: Record<string, unknown> = {
    model: "gpt_image_2",
    promptText: prompt,
    ratio: ratio(aspect),
    quality: "low",
    outputCount: 1,
  };
  if (refs.length) body.referenceImages = refs.slice(0, 16).map((uri) => ({ uri }));
  const headers = {
    Authorization: `Bearer ${key}`,
    "X-Runway-Version": "2024-11-06",
    "Content-Type": "application/json",
  };
  const create = await fetch("https://api.dev.runwayml.com/v1/text_to_image", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await create.text();
  if (!create.ok) {
    const error = new Error(providerError(create.status, text));
    (error as any).providerStatus = create.status;
    throw error;
  }
  const task = JSON.parse(text);
  if (!task?.id) throw new Error("Image task returned no id");
  const deadline = Date.now() + 140_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${task.id}`, { headers });
    const status: any = await res.json().catch(() => null);
    const state = String(status?.status ?? "").toUpperCase();
    if (state === "SUCCEEDED") {
      const url = firstImage(status?.output ?? status);
      if (!url) throw new Error("Image finished without a URL");
      return url;
    }
    if (["FAILED", "CANCELED", "CANCELLED"].includes(state))
      throw new Error(`Image task ${state}: ${String(status?.failure ?? "").slice(0, 300)}`);
  }
  throw new Error("Image generation timed out");
}

export async function handleImage(
  db: any,
  userId: string,
  body: any,
  out: (b: unknown, s?: number) => Response,
) {
  const prompt = String(body?.prompt ?? "").trim();
  if (!prompt) return out({ error: true, message: "prompt is required" }, 400);
  const { data: paidPlan, error: planError } = await db.rpc("has_paid_plan", {
    p_user_id: userId,
  });
  if (planError) return out({ error: true, message: "Could not verify subscription." }, 503);
  if (paidPlan !== true) {
    return out(
      { error: true, paywall: true, message: "Free images are available through Wan only (up to 5 per day)." },
      402,
    );
  }
  const rawRefs = body?.reference_image_urls ?? body?.reference_image_url ?? body?.image_url;
  const refs = (Array.isArray(rawRefs) ? rawRefs : rawRefs ? [rawRefs] : [])
    .map((x: unknown) => String(x))
    .filter((x: string) => /^https?:\/\//.test(x));
  const keys = await vaultKeys("runway");
  if (!keys.length) return out({ error: true, message: "No active Runway keys are configured." }, 503);
  const cost = 2;
  const opKey = String(body?.request_id || crypto.randomUUID());
  const spent = await db.rpc("charge_credits_once", {
    p_operation_key: opKey,
    p_user_id: userId,
    p_amount: cost,
    p_action_type: "image_generation",
    p_description: "Megsy image",
  });
  if (spent.error || spent.data?.success === false) {
    return out(
      { error: true, paywall: true, required_credits: cost, message: "You need 2 credits to create an image." },
      402,
    );
  }
  let lastError = "Image generation failed";
  for (const key of keys) {
    await noteKeyAttempt(key);
    try {
      const url = await generate(key.key, prompt, body?.aspect_ratio, refs);
      await noteKeyOk(key);
      return out({ image_url: url, image_urls: [url], url, provider: "runway", model_slug: "runway-gpt-image-2", credits_charged: cost });
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
      const status = Number((error as any)?.providerStatus || 500);
      await noteKeyFail(key, lastError, status);
      if (status === 400) break;
    }
  }
  await db.rpc("refund_credits_once", { p_operation_key: opKey, p_reason: "Refund for failed image" });
  return out({ error: true, message: lastError }, 502);
}
