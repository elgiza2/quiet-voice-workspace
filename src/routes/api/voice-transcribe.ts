import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/voice-transcribe")({ server: { handlers: {
  POST: async ({ request }) => {
    const { authenticate } = await import("@/lib/ceyo/auth.server");
    const auth = await authenticate(request).catch(() => null);
    if (!auth) return Response.json({ error: "Please sign in" }, { status: 401 });
    try {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof Blob) || !file.size || file.size > 20 * 1024 * 1024 || !/^(audio|video)\//.test(file.type))
        return Response.json({ error: "Upload an audio recording smaller than 20 MB." }, { status: 400 });
      const key = process.env['CARTESIA_API_KEY'];
      if (!key) return Response.json({ error: "Cartesia is not connected" }, { status: 503 });
      const payload = new FormData();
      payload.append("file", file, file.type.includes("mp4") ? "recording.mp4" : file.type.includes("wav") ? "recording.wav" : "recording.webm");
      payload.append("model", "ink-whisper");
      const language = String(form.get("language") || "").split(/[-_]/)[0];
      if (/^[a-z]{2}$/.test(language)) payload.append("language", language);
      const response = await fetch("https://api.cartesia.ai/stt", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Cartesia-Version": "2026-08-14" }, body: payload, signal: request.signal });
      if (!response.ok) return Response.json({ error: response.status === 401 || response.status === 403 ? "Cartesia refused transcription access. Check your provider account." : `Cartesia transcription failed (${response.status}).` }, { status: response.status });
      const result = await response.json() as { text?: string };
      return Response.json({ text: result.text || "" }, { headers: { "Cache-Control": "no-store" } });
    } catch { return Response.json({ error: "Could not transcribe the recording." }, { status: 502 }); }
  },
} } });