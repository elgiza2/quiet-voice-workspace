import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const replyInput = z.object({
  action: z.literal("reply"),
  agentName: z.string().max(120).default(""),
  agentPrompt: z.string().max(6000).default(""),
  language: z.string().max(12).default("en"),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(4000) })).min(1).max(40),
});

const noStore = { "Cache-Control": "no-store" };

/** Realtime call plumbing: short-lived Cartesia browser tokens and a streamed, non-persisted spoken reply. */
async function handle(request: Request) {
  const { authenticate } = await import("@/lib/ceyo/auth.server");
  const auth = await authenticate(request).catch(() => null);
  if (!auth) return Response.json({ error: "Please sign in" }, { status: 401, headers: noStore });
  const body = await request.json().catch(() => null) as { action?: string } | null;

  if (body?.action === "token") {
    const key = process.env["CARTESIA_API_KEY"];
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
    return Response.json({ token, expiresIn: 900 }, { headers: noStore });
  }

  const parsed = replyInput.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid call turn" }, { status: 400, headers: noStore });
  const { agentName, agentPrompt, language, history } = parsed.data;
  const { streamResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
  const instructions = [
    `You are ${agentName || "the assistant"}, talking with the user on a live voice call.`,
    agentPrompt ? `Your persona and instructions:\n${agentPrompt}` : "",
    `Reply in the user's spoken language (${language === "ar" ? "Arabic, matching the user's dialect" : language}).`,
    "This is speech, not text: answer briefly and naturally in one to three short sentences, no markdown, lists, emojis, links or code.",
  ].filter(Boolean).join("\n\n");

  try {
    const stream = await streamResponse({
      model: "openai/gpt-6-astra",
      instructions,
      input: history.map((m) => ({ role: m.role, content: m.text })),
      reasoning: { effort: "low" },
    }, { signal: request.signal });
    const encoder = new TextEncoder();
    const out = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream as AsyncIterable<{ type?: string; delta?: string }>) {
            if (event.type === "response.output_text.delta" && event.delta) controller.enqueue(encoder.encode(event.delta));
          }
        } catch (e) {
          controller.enqueue(encoder.encode(`\u0000${e instanceof GatewayError ? e.message : "Reply failed"}`));
        } finally { controller.close(); }
      },
    });
    return new Response(out, { headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e) {
    const status = e instanceof GatewayError && e.httpStatus ? e.httpStatus : 502;
    return Response.json({ error: e instanceof Error ? e.message : "Reply failed" }, { status, headers: noStore });
  }
}

export const Route = createFileRoute("/api/voice-call")({ server: { handlers: {
  POST: ({ request }) => handle(request),
} } });
