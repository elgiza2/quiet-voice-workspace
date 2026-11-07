import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const input = z.object({
  /** Small JPEG data URL captured from the user's camera or shared screen. */
  image: z.string().startsWith("data:image/jpeg;base64,").max(600_000),
  source: z.enum(["camera", "screen"]),
  language: z.string().max(12).default("en"),
});
const noStore = { "Cache-Control": "no-store" };

/** Lets a video-call bot "see": describes one frame of the user's camera or shared screen. Nothing is stored. */
async function handle(request: Request) {
  const { authenticate } = await import("@/lib/ceyo/auth.server");
  const auth = await authenticate(request).catch(() => null);
  if (!auth) return Response.json({ error: "Please sign in" }, { status: 401, headers: noStore });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid frame" }, { status: 400, headers: noStore });
  const { image, source, language } = parsed.data;
  const { getProviderKey } = await import("@/lib/keys/providerKey");
  const { CEREBRAS_BASE, CEREBRAS_MODELS } = await import("@/lib/keys/cerebrasKey");
  const key = await getProviderKey("cerebras");
  if (!key) return Response.json({ error: "Vision is not configured" }, { status: 503, headers: noStore });
  const ask = source === "screen"
    ? "This is the user's shared screen during a video call. In at most 3 short sentences say which app or page it is and the key readable text or numbers the user is likely asking about."
    : "This is the user's front or back camera during a video call. In at most 2 short sentences describe what is visible (person, expression, objects held up, surroundings). Do not guess identity.";
  const res = await fetch(`${CEREBRAS_BASE}/chat/completions`, {
    method: "POST", signal: request.signal,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CEREBRAS_MODELS.vision, max_completion_tokens: 220, temperature: 0.2,
      messages: [
        { role: "system", content: `You describe images plainly and briefly${language.startsWith("ar") ? "; answer in English but quote any Arabic text exactly" : ""}. No preamble.` },
        { role: "user", content: [{ type: "text", text: ask }, { type: "image_url", image_url: { url: image } }] },
      ],
    }),
  }).catch(() => null);
  if (!res?.ok) return Response.json({ error: "Vision unavailable" }, { status: res?.status === 429 ? 429 : 502, headers: noStore });
  const data = await res.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null;
  const description = (data?.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim().slice(0, 600);
  return Response.json({ description }, { headers: noStore });
}

export const Route = createFileRoute("/api/call-vision")({ server: { handlers: {
  POST: ({ request }) => handle(request),
} } });
