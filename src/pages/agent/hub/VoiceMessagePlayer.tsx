import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cachedRecording, cacheRecording } from "@/lib/audio/recordingCache";
import { getSpeech, sharedAudioContext } from "@/lib/audio/voiceClient";
import { speechText } from "@/lib/audio/voiceSchema";

const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export function VoiceMessagePlayer({ text, recordingId, agentId, voiceId = "", language = "en", ar, own, catalogueError = "", reload }: {
  text: string; recordingId: string; agentId: string; voiceId?: string; language?: string; ar: boolean; own: boolean; catalogueError?: string; reload?: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!own && !voiceId) { setLoading(!catalogueError); return; }
    const controller = new AbortController(); let objectUrl = "";
    setLoading(true); setUrl(""); setError(""); setPlaying(false); setPosition(0); setDuration(0);
    void (async () => {
      try {
        const key = own ? recordingId : `${recordingId}:${agentId}:${voiceId}:${language}`;
        let blob = await cachedRecording(key);
        if (!blob) {
          if (own) throw new Error(ar ? "التسجيل مش موجود على الجهاز ده" : "Recording isn't saved on this device");
          blob = await getSpeech(speechText(text), voiceId, language, controller.signal);
          await cacheRecording(key, blob).catch(() => {});
        }
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
        // Decode a copy for WebM's missing duration header; never seek the player to its end.
        const ctx = sharedAudioContext();
        if (ctx) void blob.arrayBuffer().then(bytes => ctx.decodeAudioData(bytes)).then(decoded => { if (!controller.signal.aborted) setDuration(decoded.duration); }).catch(() => {});
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Audio unavailable"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [recordingId, agentId, voiceId, language, own, text, retry, ar, catalogueError]);
  const toggle = async () => {
    const el = audio.current; if (!el) return;
    if (!el.paused) { el.pause(); return; }
    try { await el.play(); setError(""); }
    catch { setError(ar ? "تعذّر تشغيل الصوت، جرّب تاني" : "Could not play audio. Try again."); }
  };
  const metadata = () => {
    const el = audio.current; if (!el) return;
    if (el.duration && Number.isFinite(el.duration)) { setDuration(el.duration); if (el.currentTime > el.duration) el.currentTime = 0; }
  };
  return <div className="cx-voice-message" data-own={own}>
    <div className="cx-voice-player" dir="ltr">
      <Button variant="ghost" size="icon" className="cx-voice-play" disabled={loading || !url} aria-label={playing ? (ar ? "إيقاف مؤقت" : "Pause recording") : (ar ? "تشغيل التسجيل" : "Play recording")} onClick={() => void toggle()}>
        {loading ? <Loader2 size={19} className="animate-spin" /> : playing ? <Pause size={19} /> : <Play size={19} />}
      </Button>
      <div className="cx-voice-track">
        <div className="cx-voice-bars" aria-hidden>{Array.from({ length: 32 }, (_, i) => <i key={i} data-played={duration > 0 && i / 32 <= position / duration} style={{ height: `${7 + ((i * 13 + recordingId.length) % 20)}px` }} />)}</div>
        <input type="range" min="0" max={duration || 1} step="0.1" value={position} disabled={!duration || !url} aria-label={ar ? "موضع التسجيل" : "Recording position"} onChange={e => { const value = Number(e.target.value); if (audio.current) audio.current.currentTime = value; setPosition(value); }} />
      </div>
      <span className="cx-voice-duration">{time(playing || position > 0 ? position : duration)}</span>
      <audio ref={audio} src={url || undefined} preload="metadata" onLoadedMetadata={metadata} onDurationChange={metadata} onTimeUpdate={() => { metadata(); setPosition(audio.current?.currentTime || 0); }} onPlay={() => { document.querySelectorAll("audio").forEach(el => { if (el !== audio.current) el.pause(); }); setPlaying(true); }} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setPosition(0); }} onError={() => { setPlaying(false); setError(ar ? "تعذّر قراءة التسجيل" : "Could not read this recording"); }} />
    </div>
    {(error || catalogueError) && <div className="cx-voice-failure"><span role="alert">{error || catalogueError}</span><Button variant="ghost" size="icon" aria-label={ar ? "إعادة المحاولة" : "Retry recording"} onClick={() => { reload?.(); setRetry(n => n + 1); }}><RotateCcw size={16} /></Button></div>}
  </div>;
}