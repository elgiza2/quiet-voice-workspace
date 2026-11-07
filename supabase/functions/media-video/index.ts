import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  keySummary,
  noteKeyAttempt,
  noteKeyFail,
  noteKeyOk,
  providerError,
  vaultKeys,
} from "./_shared/keyVault.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
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

type Rule = { max: number; resolutions: string[]; durations: number[]; cost: number };
const rules: Record<string, Rule> = {
  "runway-gen4.5": { max: 10, resolutions: ["720p", "1080p"], durations: [5, 10], cost: 200 },
  "runway-veo-3.1": { max: 8, resolutions: ["720p", "1080p"], durations: [4, 6, 8], cost: 240 },
  "runway-seedance-2.5": { max: 5, resolutions: ["720p"], durations: [5], cost: 160 },
  "runway-seedance-2.0-mini": {
    max: 10,
    resolutions: ["720p", "1080p"],
    durations: [5, 10],
    cost: 110,
  },
  "runway-minimax-h3": { max: 15, resolutions: ["2k"], durations: [5, 10, 15], cost: 300 },
  "runway-gemini-omni-flash-1.1": { max: 10, resolutions: ["720p"], durations: [5, 10], cost: 180 },
};

// WaveSpeedAI catalogue. `path` is the model path; "/text-to-video" or
// "/image-to-video" is appended unless explicit t2v/i2v paths are given.
type WaveRule = {
  path: string;
  t2v?: string;
  i2v?: string;
  max: number;
  resolution?: string;
  cost: number;
};
const waveRules: Record<string, WaveRule> = {
  "wavespeed-minimax-h3": { path: "wavespeed-ai/minimax-h3", max: 10, resolution: "768p", cost: 200 },
  // Shown to users as "Seedance 2.5".
  "wavespeed-seedance-2.0-mini": { path: "bytedance/seedance-2.0-mini", max: 5, resolution: "720p", cost: 120 },
  "wavespeed-openvideo": { path: "wavespeed-ai/openvideo", max: 10, resolution: "720p", cost: 120 },
  "wavespeed-seedance-1.5-pro": { path: "bytedance/seedance-v1.5-pro", max: 5, resolution: "720p", cost: 140 },
  "wavespeed-hailuo-2.3": {
    path: "minimax/hailuo-2.3",
    t2v: "minimax/hailuo-2.3/t2v-standard",
    i2v: "minimax/hailuo-2.3/i2v-standard",
    max: 6,
    cost: 140,
  },
  "wavespeed-grok-imagine-1.5": { path: "x-ai/grok-imagine-video-1.5", max: 10, cost: 160 },
};

async function createWaveTask(
  key: string,
  rule: WaveRule,
  prompt: string,
  image: string | undefined,
  duration: number,
  aspectRatio: string | undefined,
) {
  const path = image
    ? rule.i2v || `${rule.path}/image-to-video`
    : rule.t2v || `${rule.path}/text-to-video`;
  const body: Record<string, unknown> = { prompt, duration };
  if (rule.resolution) body.resolution = rule.resolution;
  if (image) body.image = image;
  else if (aspectRatio) body.aspect_ratio = aspectRatio;
  const response = await fetch(`https://api.wavespeed.ai/api/v3/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`WaveSpeed ${response.status}: ${text.slice(0, 400)}`);
    (error as any).providerStatus = response.status;
    throw error;
  }
  const result = JSON.parse(text);
  const id = result?.data?.id ?? result?.id;
  if (!id) throw new Error("WaveSpeed returned no task id");
  return String(id);
}

function ratio(aspectRatio?: string) {
  if (aspectRatio === "9:16") return "720:1280";
  if (aspectRatio === "1:1") return "720:720";
  return "1280:720";
}

async function createRunwayTask(
  key: string,
  model: string,
  prompt: string,
  image: string | undefined,
  duration: number,
  aspectRatio: string | undefined,
) {
  const imageToVideo = Boolean(image);
  const body: Record<string, unknown> = {
    model: model.replace(/^runway-/, ""),
    promptText: prompt,
    ratio: ratio(aspectRatio),
    duration,
  };
  if (imageToVideo) body.promptImage = image;
  const response = await fetch(
    `https://api.dev.runwayml.com/v1/${imageToVideo ? "image_to_video" : "text_to_video"}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "X-Runway-Version": "2024-11-06",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(providerError(response.status, text));
    (error as any).providerStatus = response.status;
    throw error;
  }
  const result = JSON.parse(text);
  const id = result.id ?? result.task_id;
  if (!id) throw new Error("Runway returned no task id");
  return String(id);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return out({ error: true, message: "invalid json" }, 400);
  }

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: authData } = token
    ? await db.auth.getUser(token)
    : ({ data: { user: null } } as any);
  const user = authData?.user;
  if (!user)
    return out({ error: true, paywall: true, message: "Sign in to generate videos." }, 401);

  if (body.kind === "image") {
    const { data: paidPlan, error: planError } = await db.rpc("has_paid_plan", {
      p_user_id: user.id,
    });
    if (planError) return out({ error: true, message: "Could not verify subscription." }, 503);
    if (paidPlan !== true) {
      return out({
        error: true,
        paywall: true,
        message: "الصور المجانية بتتولد عبر Wan فقط، بحد أقصى 5 صور يوميًا.",
      }, 402);
    }
    const { handleImage } = await import("./image.ts");
    return handleImage(db, user.id, body, out);
  }
  // The single agent (Browser Use Cloud) lives here too.
  if (body.kind === "agent") {
    const { handleAgent } = await import("./agent.ts");
    return handleAgent(db, user.id, body, out);
  }
  // One fixed 25-credit video price. Subscribers use Seedance; free users use MiniMax.
  const { data: profile } = await db.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  const paid = String(profile?.plan || "free") !== "free";
  const selectedModel = paid ? "wavespeed-seedance-2.0-mini" : "wavespeed-hailuo-2.3";
  return handleWave(user.id, selectedModel, waveRules[selectedModel], body);
  const model = String(body.model_slug || "wavespeed-minimax-h3");
  const rule = rules[model];
  if (!rule) return out({ error: true, message: "Choose a supported Runway video model." }, 400);
  const duration = Number(body.duration || rule.durations[0]);
  const resolution = String(body.resolution || rule.resolutions[0]).toLowerCase();
  if (
    duration > rule.max ||
    !rule.durations.includes(duration) ||
    !rule.resolutions.includes(resolution)
  ) {
    return out(
      {
        error: true,
        message: `${model}: allowed durations ${rule.durations.join(", ")} and resolutions ${rule.resolutions.join(", ")}.`,
      },
      400,
    );
  }
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return out({ error: true, message: "prompt is required" }, 400);

  // Snapshot the full encrypted + legacy pool. Depleted keys are removed from
  // future snapshots, while rate-limited keys are temporarily cooled down.
  const keys = await vaultKeys("runway");
  if (!keys.length)
    return out({ error: true, message: "No active Runway keys are configured." }, 503);

  const quota = await db.rpc("consume_video_quota", {
    _model: model,
    _unlimited: false,
    _user_id: user.id,
  });
  if (quota.error || !quota.data?.allowed)
    return out(
      {
        error: true,
        paywall: true,
        message:
          quota.data?.message ||
          quota.data?.error ||
          quota.error?.message ||
          "Video credits required.",
      },
      402,
    );
  const cost = Number(quota.data.cost || rule.cost);
  const opKey = String(body?.request_id || crypto.randomUUID());
  const spent = await db.rpc("charge_credits_once", {
    p_operation_key: opKey,
    p_user_id: user.id,
    p_amount: cost,
    p_action_type: "video_generation",
    p_description: `${model} ${duration}s`,
  });
  if (spent.error || spent.data?.success === false)
    return out(
      { error: true, paywall: true, message: spent.data?.error || "Insufficient credits." },
      402,
    );

  let lastError = "Runway request failed";
  let selectedKey = keys[0];
  let generationId: string | null = null;
  for (const key of keys) {
    selectedKey = key;
    await noteKeyAttempt(key);
    try {
      generationId = await createRunwayTask(
        key.key,
        model,
        prompt,
        typeof body.start_frame === "string" ? body.start_frame : undefined,
        duration,
        typeof body.aspect_ratio === "string" ? body.aspect_ratio : undefined,
      );
      await noteKeyOk(key);
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Runway request failed";
      const status = Number((error as any)?.providerStatus || 500);
      await noteKeyFail(key, lastError, status);
      // A depleted/limited key is not allowed to consume the user's request:
      // move immediately to the next key in the same pool snapshot.
      continue;
    }
  }

  if (!generationId) {
    await db.rpc("refund_credits_once", { p_operation_key: opKey, p_reason: `Refund for failed ${model} request` });
    return out({ error: true, message: lastError, attempted_keys: keys.length }, 502);
  }

  const { data: job, error: jobError } = await db
    .from("pending_video_jobs")
    .insert({
      user_id: user.id,
      provider: "runway",
      model_slug: model,
      generation_id: generationId,
      api_key_id: selectedKey.id,
      credits_charged: cost,
      prompt,
      duration_seconds: duration,
      resolution,
      status: "pending",
    })
    .select("id")
    .single();
  if (jobError) {
    await db.rpc("refund_credits_once", { p_operation_key: opKey, p_reason: `Refund for untracked ${model} request` });
    return out({ error: true, message: jobError.message }, 502);
  }

  return out({
    job_id: job.id,
    provider: "runway",
    model_slug: model,
    credits_charged: cost,
    key: keySummary(selectedKey),
    attempted_keys: keys.length,
  });
});

async function handleWave(
  userId: string,
  model: string,
  rule: WaveRule,
  body: Record<string, unknown>,
) {
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return out({ error: true, message: "prompt is required" }, 400);
  // Clamp to the model's limit instead of rejecting the request.
  const duration = Math.min(rule.max, Math.max(1, Math.round(Number(body.duration) || rule.max)));
  const keys = await vaultKeys("wavespeed");
  if (!keys.length)
    return out({ error: true, message: "No active WaveSpeed keys are configured." }, 503);

  const cost = 25;
  const opKey = String(body?.request_id || crypto.randomUUID());
  if (cost > 0) {
    const spent = await db.rpc("charge_credits_once", {
      p_operation_key: opKey,
      p_user_id: userId,
      p_amount: cost,
      p_action_type: "video_generation",
      p_description: `${model} ${duration}s`,
    });
    if (spent.error || spent.data?.success === false)
      return out(
        { error: true, paywall: true, message: spent.data?.error || "Insufficient credits." },
        402,
      );
  }

  let lastError = "WaveSpeed request failed";
  let selectedKey = keys[0];
  let generationId: string | null = null;
  for (const key of keys) {
    selectedKey = key;
    await noteKeyAttempt(key);
    try {
      generationId = await createWaveTask(
        key.key,
        rule,
        prompt,
        typeof body.start_frame === "string" ? body.start_frame : undefined,
        duration,
        typeof body.aspect_ratio === "string" ? body.aspect_ratio : undefined,
      );
      await noteKeyOk(key);
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
      const status = Number((error as any)?.providerStatus || 500);
      await noteKeyFail(key, lastError, status);
      // A 400 is a request problem, not a key problem: another key won't help.
      if (status === 400) break;
    }
  }

  const refund = async (why: string) => {
    if (cost > 0)
      await db.rpc("refund_credits_once", { p_operation_key: opKey, p_reason: `Refund for ${why} ${model} request` });
  };
  if (!generationId) {
    await refund("failed");
    return out({ error: true, message: lastError }, 502);
  }
  const { data: job, error: jobError } = await db
    .from("pending_video_jobs")
    .insert({
      user_id: userId,
      provider: "wavespeed",
      model_slug: model,
      generation_id: generationId,
      api_key_id: selectedKey.id,
      credits_charged: cost,
      prompt,
      duration_seconds: duration,
      resolution: rule.resolution || null,
      status: "pending",
    })
    .select("id")
    .single();
  if (jobError) {
    await refund("untracked");
    return out({ error: true, message: jobError.message }, 502);
  }
  return out({ job_id: job.id, provider: "wavespeed", model_slug: model, credits_charged: cost });
}
