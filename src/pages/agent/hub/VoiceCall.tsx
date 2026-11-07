import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Minus, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentInfo } from "@/lib/agentsky/client";
import { startRealtimeCall, type CallPhase, type RealtimeCall } from "@/lib/audio/realtimeCall";
import { BotAvatar, type HubLang } from "./HubParts";
import type { AgentVoiceSettings } from "@/lib/audio/agentVoice";
import { useVoiceChoice } from "./VoiceControls";
import "@/styles/floating-call.css";
import { clampCallPosition } from "@/lib/audio/callPosition";

type Phase = CallPhase | "ready";

/** Realtime Cartesia call: streamed speech recognition and streamed speech, kept out of the chat. */
export function VoiceCallBar({ agent, lang, onEnd, settings, agentIds }: {
  settings: AgentVoiceSettings; agentIds: string[]; agent: AgentInfo; lang: HubLang; onEnd: () => void;
}) {
  const ar = lang === "ar";
  const choice = useVoiceChoice(ar ? "ar" : "en", agent.id, agentIds, settings);
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const position = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const placed = useRef(false);
  const call = useRef<RealtimeCall | null>(null);

  useEffect(() => {
    if (!choice.voiceId) { if (choice.error) setError(choice.error); return; }
    let cancelled = false; let live: RealtimeCall | null = null;
    setError(""); setPhase("connecting");
    startRealtimeCall({
      voiceId: choice.voiceId, language: choice.language, agentName: agent.name, agentPrompt: agent.prompt || agent.description || "",
      onPhase: (p) => { if (!cancelled) { setPhase(p); if (p === "speaking") setError(""); } },
      onError: (m) => { if (!cancelled) setError(m); },
    }).then((c) => { if (cancelled) c.end(); else { live = c; call.current = c; } })
      .catch((e) => {
        if (cancelled) return;
        const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
        setError(denied ? (ar ? "اسمح للتطبيق باستخدام الميكروفون" : "Allow microphone access to talk") : e instanceof Error ? e.message : "Call unavailable");
        setPhase("ready");
      });
    return () => { cancelled = true; live?.end(); call.current = null; };
  }, [choice.voiceId, choice.language, choice.error, agent.id, attempt]);

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

  const retry = () => { setError(""); choice.reload(); setAttempt((n) => n + 1); };
  const status = error || choice.error ? (ar ? "في مشكلة" : "Problem")
    : phase === "listening" ? (muted ? (ar ? "الميكروفون مقفول" : "Muted") : (ar ? "بسمعك…" : "Listening…"))
    : phase === "thinking" ? (ar ? "بيفكر…" : "Thinking…")
    : phase === "speaking" ? (ar ? "بيتكلم" : "Speaking")
    : (ar ? "جاري التوصيل" : "Connecting");
  const orb = phase === "speaking" ? "talking" : phase === "thinking" ? "thinking" : "idle";

  return <div
    ref={position}
    className="cx-call cx-call-cartesia"
    data-minimized={minimized}
    data-phase={phase}
    role="region"
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
        {phase === "speaking" ? <Button variant="ghost" size="icon" className="cx-call-btn" aria-label={ar ? "قاطعه" : "Interrupt"} onClick={() => call.current?.interrupt()}><Hand size={18} /></Button>
          : <Button variant="ghost" size="icon" className="cx-call-btn" aria-label={muted ? (ar ? "فتح الميكروفون" : "Unmute") : (ar ? "كتم" : "Mute")} onClick={() => { const next = !muted; setMuted(next); call.current?.setMuted(next); }}>{muted ? <MicOff size={18} /> : <Mic size={18} />}</Button>}
        <Button variant="ghost" size="icon" className="cx-call-btn" aria-label={ar ? "تصغير" : "Minimize call"} onClick={() => setMinimized(true)}><Minus size={18} /></Button>
        <Button variant="ghost" size="icon" className="cx-call-btn cx-call-end" aria-label={ar ? "إنهاء المكالمة" : "End call"} onClick={() => { call.current?.end(); call.current = null; onEnd(); }}><PhoneOff size={18} /></Button>
      </div>
    </>}
  </div>;
}
