import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const replyInput = z.object({
  action: z.literal("reply"),
  agentName: z.string().max(120).default(""),
  agentPrompt: z.string().max(6000).default(""),
  language: z.string().max(12).default("en"),
  /** Why the bot is calling the user; the bot opens the call with it when history is empty. */
  reason: z.string().max(2000).default(""),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(4000) })).max(40),
});

const noStore = { "Cache-Control": "no-store" };

/** Realtime call plumbing: short-lived Cartesia browser tokens and a streamed, non-persisted spoken reply. */
async function handle(request: Request) {
  const { authenticate } = await import("@/lib/ceyo/auth.server");
  const auth = await authenticate(request).catch(() => null);
  if (!auth) return Response.json({ error: "Please sign in" }, { status: 401, headers: noStore });
  const body = await request.json().catch(() => null) as { action?: string } | null;
  const { getProviderKey } = await import("@/lib/keys/providerKey");

  if (body?.action === "agent") {
    const b = body as { agentName?: string; agentPrompt?: string; reason?: string; voiceId?: string; language?: string };
    const [dgKey, ctKey] = await Promise.all([getProviderKey("deepgram"), getProviderKey("cartesia")]);
    if (!dgKey) return Response.json({ error: "Deepgram is not connected" }, { status: 503, headers: noStore });
    if (!ctKey) return Response.json({ error: "Cartesia is not connected" }, { status: 503, headers: noStore });
    const [grant, ct] = await Promise.all([
      fetch("https://api.deepgram.com/v1/auth/grant", { method: "POST", signal: request.signal, headers: { Authorization: `Token ${dgKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ ttl_seconds: 300 }) }),
      fetch("https://api.cartesia.ai/access-token", { method: "POST", signal: request.signal, headers: { Authorization: `Bearer ${ctKey}`, "Cartesia-Version": "2026-08-14", "Content-Type": "application/json" }, body: JSON.stringify({ grants: { tts: true }, expires_in: 3600 }) }),
    ]);
    if (grant.status === 403) return Response.json({ error: "مفتاح Deepgram محتاج صلاحية Member أو أعلى عشان المكالمة تشتغل." }, { status: 502, headers: noStore });
    if (!grant.ok || !ct.ok) return Response.json({ error: "Voice service refused the call." }, { status: 502, headers: noStore });
    const { access_token } = await grant.json() as { access_token?: string };
    const { token: ctToken } = await ct.json() as { token?: string };
    if (!access_token || !ctToken) return Response.json({ error: "Voice service unavailable" }, { status: 502, headers: noStore });
    const { callLanguage } = await import("@/lib/calls/callLanguage.server");
    const language = await callLanguage(auth.db, auth.userId, String(b.language || ""));
    const name = String(b.agentName || "").slice(0, 120);
    const reason = String(b.reason || "").slice(0, 2000);
    const prompt = [
      `You are ${name || "the assistant"}, talking with the user on a live phone call.`,
      b.agentPrompt ? `Your persona and instructions:\n${String(b.agentPrompt).slice(0, 6000)}` : "",
      reason ? `You placed this call yourself. Reason for calling: ${reason}\nOpen by greeting the user and telling them why you are calling.` : "Open with a short friendly greeting and ask how you can help.",
      language === "ar" ? "Always speak Arabic in the Egyptian dialect, matching the user." : `Speak the user's language (${language}).`,
      `Current date and time (Cairo): ${new Date().toLocaleString("en-GB", { timeZone: "Africa/Cairo", dateStyle: "full", timeStyle: "short" })}.`,
      "This is speech: answer briefly and naturally in one to three short sentences, no markdown, lists, emojis, links or code.",
    ].filter(Boolean).join("\n\n");
    const settings = {
      type: "Settings",
      audio: { input: { encoding: "linear16", sample_rate: 16000 }, output: { encoding: "linear16", sample_rate: 24000, container: "none" } },
      agent: {
        language: language === "ar" ? "ar" : language === "en" ? "en" : "multi",
        listen: { provider: { type: "deepgram", model: "nova-3" } },
        think: { provider: { type: "open_ai", model: "gpt-4o-mini" }, prompt },
        speak: {
          provider: { type: "cartesia", model_id: "sonic-3", voice: { mode: "id", id: String(b.voiceId || "a0e99841-438c-4a64-b679-ae501e7d6091") }, language },
          endpoint: { url: "https://api.cartesia.ai/tts/bytes", headers: { Authorization: `Bearer ${ctToken}` } },
        },
      },
    };
    return Response.json({ token: access_token, settings }, { headers: noStore });
  }

  if (body?.action === "token") {
    const key = await getProviderKey("cartesia");
    if (!key) return Response.json({ error: "Cartesia is not connected" }, { status: 503, headers: noStore });
    const res = await fetch("https://api.cartesia.ai/access-token", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Cartesia-Version": "2026-08-14", "Content-Type": "application/json" },
      body: JSON.stringify({ grants: { tts: true, stt: true }, expires_in: 900 }),
      signal: request.signal,
    });
    if (!res.ok) return Response.json({ error: "Voice service refused the call. Check the Cartesia account." }, { status: 502, headers: noStore });
    const { token } = await res.json() as { token?: string };
    if (!token) return Response.json({ error: "Voice service unavailable" }, { status: 502, headers: noStore });
    const { callLanguage } = await import("@/lib/calls/callLanguage.server");
    const hint = typeof (body as { language?: unknown }).language === "string" ? String((body as { language?: string }).language) : "";
    const language = await callLanguage(auth.db, auth.userId, hint);
    return Response.json({ token, expiresIn: 900, language }, { headers: noStore });
  }

  const parsed = replyInput.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid call turn" }, { status: 400, headers: noStore });
  const { agentName, agentPrompt, language, history, reason } = parsed.data;
  if (!history.length && !reason) return Response.json({ error: "Nothing to answer" }, { status: 400, headers: noStore });
  const key = await getProviderKey("cerebras");
  if (!key) return Response.json({ error: "The reply model is not configured" }, { status: 503, headers: noStore });

  const system = [
    `You are ${agentName || "the assistant"}, talking with the user on a live phone call.`,
    agentPrompt ? `Your persona and instructions:\n${agentPrompt}` : "",
    reason ? `You placed this call yourself. Reason for calling: ${reason}\nOpen by greeting the user and telling them why you are calling.` : "",
    `Speak the user's language (${language.startsWith("ar") ? "Arabic, matching the user's dialect" : language}).`,
    "This is speech, not text: answer briefly and naturally in one to three short sentences, no markdown, lists, emojis, links or code.",
  ].filter(Boolean).join("\n\n");
  const messages = [
    { role: "system", content: system },
    ...(history.length ? history.map((m) => ({ role: m.role, content: m.text })) : [{ role: "user", content: "(The user just answered your call.)" }]),
  ];

  const upstream = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST", signal: request.signal,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-oss-120b", stream: true, reasoning_effort: "low", max_completion_tokens: 600, messages }),
  });
  if (!upstream.ok || !upstream.body) {
    const status = upstream.status === 429 ? 429 : 502;
    return Response.json({ error: status === 429 ? "The model is busy, try again in a moment." : "Reply failed" }, { status, headers: noStore });
  }
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  const out = new ReadableStream<Uint8Array>({
    async pull(controller) {
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
          for (const line of lines) {
            const raw = line.startsWith("data:") ? line.slice(5).trim() : "";
            if (!raw || raw === "[DONE]") continue;
            try {
              const delta = JSON.parse(raw)?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta) controller.enqueue(encoder.encode(delta));
            } catch { /* keepalive */ }
          }
        }
      } catch {
        controller.enqueue(encoder.encode("\u0000Reply interrupted"));
      }
      controller.close();
    },
    cancel() { void reader.cancel(); },
  });
  return new Response(out, { headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" } });
}

export const Route = createFileRoute("/api/voice-call")({ server: { handlers: {
  POST: ({ request }) => handle(request),
} } });
