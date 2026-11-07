import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request) {
  const { authenticate } = await import("@/lib/ceyo/auth.server");
  const auth = await authenticate(request).catch(() => null);
  if (!auth) return Response.json({ error: "Please sign in" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const key = process.env['CARTESIA_API_KEY'];
  if (!key) return Response.json({ error: "Cartesia is not connected" }, { status: 503 });
  try {
    const { voiceCatalogue, generateSpeech } = await import("@/lib/audio/cartesia.server");
    return request.method === "GET" ? await voiceCatalogue(key, request.signal)
      : await generateSpeech(key, await request.json().catch(() => null), request.signal);
  } catch {
    return Response.json({ error: "Voice service unavailable. Please try again." }, { status: 502 });
  }
}

export const Route = createFileRoute("/api/voice")({ server: { handlers: {
  GET: ({ request }) => handle(request), POST: ({ request }) => handle(request),
} } });