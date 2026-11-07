import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Minus, Play, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentInfo } from "@/lib/agentsky/client";
import { callAudioElement, getSpeech, microphoneRecording, transcribeRecording } from "@/lib/audio/voiceClient";
import { speechText } from "@/lib/audio/voiceSchema";
import { BotAvatar, type HubLang } from "./HubParts";
import type { AgentVoiceSettings } from "@/lib/audio/agentVoice";
import { useVoiceChoice } from "./VoiceControls";
import "@/styles/floating-call.css";
import { clampCallPosition } from "@/lib/audio/callPosition";

type Phase = "ready" | "listening" | "thinking" | "speaking";

/** Automatic speech-ended turns, authenticated transcription and Cartesia playback. */
export function VoiceCallBar({ agent, lang, busy, lastReply, replyId, onSay, onEnd, settings, agentIds, replyError }: {
  replyError?: string | null; replyId?: string; settings: AgentVoiceSettings; agentIds: string[]; agent: AgentInfo; lang: HubLang; busy: boolean; lastReply: string; onSay: (text: string) => void; onEnd: () => void;
}) {
  const ar = lang === "ar";
  const choice = useVoiceChoice(ar ? "ar" : "en", agent.id, agentIds, settings);
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState("");
  const [needsTap, setNeedsTap] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const position = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const placed = useRef(false);
  const alive = useRef(true);
  const recording = useRef<{ stop: () => void } | null>(null);
  const starting = useRef(false);
  const discarded = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef("");
  const spoken = useRef(replyId || lastReply);
  const awaited = useRef(busy);
  const baselineError = useRef(replyError);
  const generating = useRef(false);
  const recordLatest = useRef<() => Promise<void>>(async () => {});

  const stopAudio = () => {
    abort.current?.abort(); player.current?.pause();
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = "";
  };
  useEffect(() => {
    alive.current = true; player.current = callAudioElement();
    return () => { alive.current = false; recording.current?.stop(); stopAudio(); };
  }, []);

  const record = async () => {
    if (starting.current || muted || busy) return;
    starting.current = true; discarded.current = false; stopAudio(); setError("");
    try {
      const take = await microphoneRecording({ autoStop: true });
      if (!alive.current) { take.stop(); return; }
      recording.current = take; setPhase("listening");
      const blob = await take.result;
      recording.current = null;
      if (!alive.current) return;
      if (discarded.current || !take.heard() || blob.size < 1200) { setPhase("ready"); return; }
      setPhase("thinking");
      const controller = new AbortController(); abort.current = controller;
      let text = "";
      try { text = await transcribeRecording(blob, choice.language, controller.signal); }
      catch (e) { if (e instanceof Error && /No speech/i.test(e.message)) { if (alive.current) setPhase("ready"); return; } throw e; }
      if (alive.current && !discarded.current) { spoken.current = replyId || lastReply; baselineError.current = replyError; awaited.current = true; onSay(text); }
    } catch (e) {
      if (alive.current) {
        const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
        setError(denied ? (ar ? "اسمح للتطبيق باستخدام الميكروفون" : "Allow microphone access to talk") : e instanceof Error ? e.message : "Recording unavailable");
        setPhase("ready");
      }
    } finally { starting.current = false; }
  };

  recordLatest.current = record;
  useEffect(() => {
    if (phase !== "ready" || muted || busy || error || needsTap || choice.error || !choice.voiceId || awaited.current) return;
    const timer = setTimeout(() => void recordLatest.current(), 250);
    return () => clearTimeout(timer);
  }, [phase, muted, busy, error, needsTap, choice.error, choice.voiceId]);

  useEffect(() => {
    if (busy) { baselineError.current = replyError; awaited.current = true; if (!generating.current) setPhase("thinking"); return; }
    if (replyError && replyError !== baselineError.current) { awaited.current = false; stopAudio(); setError(replyError); setPhase("ready"); return; }
    if (!awaited.current || generating.current) return;
    if (!lastReply || (replyId || lastReply) === spoken.current) return;
    if (!choice.voiceId) { if (choice.error) { setError(choice.error); setPhase("ready"); } return; }
    awaited.current = false; spoken.current = replyId || lastReply; generating.current = true;
    stopAudio(); const controller = new AbortController(); abort.current = controller;
    setPhase("thinking"); setError("");
    void (async () => {
      try {
        const blob = await getSpeech(speechText(lastReply), choice.voiceId, choice.language, controller.signal);
        if (!alive.current || controller.signal.aborted) return;
        audioUrl.current = URL.createObjectURL(blob);
        const audio = player.current; if (!audio) return;
        audio.src = audioUrl.current;
        audio.onended = () => { if (alive.current) { stopAudio(); setPhase("ready"); } };
        audio.onerror = () => { if (alive.current) { stopAudio(); setError(ar ? "تعذر تشغيل الرد الصوتي" : "Could not play the reply."); setPhase("ready"); } };
        try { await audio.play(); if (alive.current) setPhase("speaking"); }
        catch { if (alive.current) { setNeedsTap(true); setPhase("ready"); } }
      } catch (e) { if (alive.current && !controller.signal.aborted) { setError(e instanceof Error ? e.message : "Audio unavailable"); setPhase("ready"); } }
      finally { generating.current = false; }
    })();
  }, [busy, lastReply, replyId, replyError, choice.voiceId, choice.error]);

  useLayoutEffect(() => {
    const el = position.current, parent = el?.parentElement;
    if (!el || !parent) return;
    const fit = () => {
      const startX = placed.current ? el.offsetLeft : (parent.clientWidth - el.offsetWidth) / 2;
      const next = clampCallPosition(startX, el.offsetTop, el.offsetWidth, el.offsetHeight, parent.clientWidth, parent.clientHeight);
      placed.current = true;
      el.style.left = `${next.x}px`; el.style.top = `${next.y}px`;
    };
    fit(); const observer = new ResizeObserver(fit); observer.observe(parent);
    window.visualViewport?.addEventListener("resize", fit);
    return () => { observer.disconnect(); window.visualViewport?.removeEventListener("resize", fit); };
  }, [minimized]);

  const playReply = () => { void player.current?.play().then(() => { setNeedsTap(false); setPhase("speaking"); }).catch(() => setError(ar ? "تعذر تشغيل الصوت" : "Audio playback unavailable")); };
  const retry = () => { setError(""); choice.reload(); setPhase("ready"); };
  const status = error || choice.error ? (ar ? "في مشكلة" : "Problem")
    : needsTap ? (ar ? "اضغط لسماع الرد" : "Tap to hear the reply")
    : phase === "listening" ? (ar ? "بسمعك…" : "Listening…")
    : phase === "thinking" ? (ar ? "بيفكر…" : "Thinking…")
    : phase === "speaking" ? (ar ? "بيتكلم" : "Speaking")
    : muted ? (ar ? "الميكروفون مقفول" : "Muted") : (ar ? "جاري التوصيل" : "Connecting");
  const orb = phase === "speaking" ? "talking" : phase === "thinking" ? "thinking" : "idle";

  return <div
    ref={position}
    className="cx-call cx-call-cartesia"
    data-minimized={minimized}
    data-phase={phase}
    role="dialog"
    aria-label={ar ? "مكالمة صوتية" : "Voice call"}
    onPointerDown={(e) => {
      const el = position.current; if (!el || e.button > 0) return;
      dragged.current = false;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: el.offsetLeft, top: el.offsetTop, moved: false };
    }}
    onPointerMove={(e) => {
      const start = drag.current, el = position.current, parent = el?.parentElement;
      if (!start || start.id !== e.pointerId || !el || !parent) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!start.moved) { if (Math.hypot(dx, dy) < 6) return; start.moved = true; dragged.current = true; el.setPointerCapture(e.pointerId); el.dataset.dragging = "true"; }
      const next = clampCallPosition(start.left + dx, start.top + dy, el.offsetWidth, el.offsetHeight, parent.clientWidth, parent.clientHeight);
      el.style.left = `${next.x}px`; el.style.top = `${next.y}px`;
    }}
    onPointerUp={() => { drag.current = null; if (position.current) delete position.current.dataset.dragging; }}
    onPointerCancel={() => { drag.current = null; if (position.current) delete position.current.dataset.dragging; }}
    onClickCapture={(e) => { if (dragged.current) { e.stopPropagation(); e.preventDefault(); dragged.current = false; } }}
  >
    {minimized ? <button type="button" className="cx-call-restore" aria-label={ar ? "تكبير المكالمة" : "Restore call"} title={status} onClick={() => setMinimized(false)}>
      <BotAvatar agent={agent} size={44} state={orb} />
    </button> : <>
      <span className="cx-call-avatar"><BotAvatar agent={agent} size={44} state={orb} /></span>
      <div className="cx-call-content">
        <strong dir="auto">{agent.name}</strong>
        <span role="status">{status}</span>
        {(error || choice.error) && <button type="button" className="cx-call-alert" role="alert" onClick={retry}>{error || choice.error} · {ar ? "حاول تاني" : "Retry"}</button>}
      </div>
      <div className="cx-call-actions">
        {needsTap ? <Button variant="ghost" size="icon" className="cx-call-btn" aria-label={ar ? "شغّل الرد" : "Play reply"} onClick={playReply}><Play size={18} /></Button>
          : phase === "listening" ? <Button variant="ghost" size="icon" className="cx-call-btn" aria-label={ar ? "إرسال" : "Send"} onClick={() => recording.current?.stop()}><Send size={17} /></Button>
          : <Button variant="ghost" size="icon" className="cx-call-btn" disabled={busy || phase === "thinking"} aria-label={muted ? (ar ? "فتح الميكروفون" : "Unmute") : (ar ? "كتم" : "Mute")} onClick={() => {
            if (!muted) { discarded.current = true; recording.current?.stop(); setMuted(true); }
            else { discarded.current = false; setError(""); choice.reload(); setMuted(false); setPhase("ready"); }
          }}>{muted ? <MicOff size={18} /> : <Mic size={18} />}</Button>}
        <Button variant="ghost" size="icon" className="cx-call-btn" aria-label={ar ? "تصغير" : "Minimize call"} onClick={() => setMinimized(true)}><Minus size={18} /></Button>
        <Button variant="ghost" size="icon" className="cx-call-btn cx-call-end" aria-label={ar ? "إنهاء المكالمة" : "End call"} onClick={() => { discarded.current = true; alive.current = false; recording.current?.stop(); stopAudio(); onEnd(); }}><PhoneOff size={18} /></Button>
      </div>
    </>}
  </div>;
}
