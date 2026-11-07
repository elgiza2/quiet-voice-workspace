import { speechInput, type Voice } from "./voiceSchema";

const base = "https://api.cartesia.ai";
const version = "2026-08-14";

function headers(key: string) {
  return { "X-API-Key": key, "Cartesia-Version": version, "Content-Type": "application/json" };
}

function failure(status: number) {
  const error = status === 401 || status === 403 ? "Cartesia access was refused. Check the configured account key."
    : status === 402 || status === 429 ? "Cartesia credit or request limit reached. Check your Cartesia account."
    : "Cartesia could not generate audio. Please try again.";
  return Response.json({ error }, { status: status >= 400 && status < 600 ? status : 502, headers: { "Cache-Control": "no-store" } });
}

export async function voiceCatalogue(key: string, signal?: AbortSignal) {
  const voices: Voice[] = [];
  let after = "";
  for (let page = 0; page < 5; page++) {
    const url = new URL(`${base}/voices`);
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("starting_after", after);
    const response = await fetch(url, { headers: headers(key), signal });
    if (!response.ok) return failure(response.status);
    const payload = await response.json() as { data?: Voice[]; has_more?: boolean };
    const rows = (payload.data || []).filter((v) => typeof v.id === "string" && typeof v.name === "string");
    voices.push(...rows.map((v) => ({ id: v.id, name: v.name, language: v.language || "en" })));
    if (!payload.has_more || !rows.length) break;
    after = rows[rows.length - 1].id;
  }
  return Response.json({ voices }, { headers: { "Cache-Control": "no-store" } });
}

export async function generateSpeech(key: string, body: unknown, signal?: AbortSignal) {
  const parsed = speechInput.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Choose a voice and enter between 1 and 5000 characters." }, { status: 400 });
  const { text, voiceId, language } = parsed.data;
  const response = await fetch(`${base}/tts/bytes`, {
    method: "POST", headers: headers(key), signal,
    body: JSON.stringify({ model_id: "sonic-3.6", transcript: text, voice: { mode: "id", id: voiceId }, language,
      output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: 24000 } }),
  });
  if (!response.ok) return failure(response.status);
  return new Response(response.body, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}