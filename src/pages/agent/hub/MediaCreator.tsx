import { useState } from "react";
import { Image, Film, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { agentApi } from "@/lib/agentsky/client";
import { MediaCard } from "@/components/agent/Cards";
import type { MediaPayload } from "@/lib/agentsky/transcript";

export function MediaCreator({ onClose, ar }: { onClose: () => void; ar: boolean }) {
  const [kind, setKind] = useState<"image" | "video">("image"); const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [media, setMedia] = useState<MediaPayload | null>(null);
  const generate = async () => {
    setBusy(true); setError("");
    try { const run = await agentApi.media({ kind, prompt, aspect: kind === "video" ? "16:9" : "1:1", duration: 5, idempotencyKey: crypto.randomUUID() }); setMedia({ type: "megsy.media", kind, prompt, urls: [], ...run }); }
    catch (e) { setError(e instanceof Error ? e.message : "Generation unavailable"); }
    finally { setBusy(false); }
  };
  return <section className="chat-media-creator" aria-label="Create media"><header><strong>{ar ? "إنشاء صور وفيديو" : "Create media"}</strong><Button variant="ghost" size="icon" aria-label="Close media creator" onClick={onClose}><X size={18} /></Button></header>
    <div className="chat-media-modes"><Button variant={kind === "image" ? "secondary" : "ghost"} aria-pressed={kind === "image"} onClick={() => setKind("image")}><Image size={16} />{ar ? "صورة" : "Image"}</Button><Button variant={kind === "video" ? "secondary" : "ghost"} aria-pressed={kind === "video"} onClick={() => setKind("video")}><Film size={16} />{ar ? "فيديو" : "Video"}</Button></div>
    <textarea aria-label="Media prompt" dir="auto" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={5000} />
    {error && <p role="alert">{error}</p>}<Button variant="secondary" disabled={!prompt.trim() || busy} onClick={() => void generate()}><Sparkles size={16} />{busy ? ar ? "جاري الإرسال…" : "Starting…" : ar ? "إنشاء" : "Generate"}</Button>
    {media && <MediaCard media={media} lang={ar ? "ar" : "en"} />}
  </section>;
}