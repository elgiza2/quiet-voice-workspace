/** Full-screen voice and video call UI with a minimized floating bubble. Calls never write to the chat. */
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, ChevronDown, Hand, Video, Volume2 } from "lucide-react";
import { BotAvatar } from "@/pages/agent/hub/HubParts";
import { useVoiceChoice } from "@/pages/agent/hub/VoiceControls";
import { startRealtimeCall, type CallPhase, type RealtimeCall } from "@/lib/audio/realtimeCall";
import { supabase } from "@/integrations/supabase/client";
import { calls, useCalls, type ActiveCall } from "@/lib/calls/callStore";
import "@/styles/agent.css";
import "@/styles/agent-hub.css";
import "@/styles/calls.css";

const isAr = () => { try { return (localStorage.getItem("ceyo_language") || navigator.language || "").startsWith("ar"); } catch { return false; } };

function useTimer(running: boolean) {
  const [secs, setSecs] = useState(0);
  useEffect(() => { if (!running) return; const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, [running]);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

function Shell({ call, status, connected, minimized, children, controls, video }: { call: ActiveCall; status: string; connected: boolean; minimized: boolean; children?: React.ReactNode; controls: React.ReactNode; video?: React.ReactNode }) {
  const ar = isAr();
  const time = useTimer(connected);
  return <>
    <div className="agent-hub cx-callscreen" data-minimized={minimized} data-kind={call.kind} role="dialog" aria-modal={!minimized} aria-label={ar ? "مكالمة" : "Call"} dir="auto">
      {video}
      <header className="cx-callscreen-top">
        <button type="button" className="cx-callscreen-icon" aria-label={ar ? "تصغير" : "Minimize"} onClick={() => calls.minimize(true)}><ChevronDown size={22} /></button>
      </header>
      <div className="cx-callscreen-who">
        {call.kind === "voice" && <span className="cx-callscreen-avatar"><BotAvatar agent={call.agent} size={132} state={status === "speaking" ? "talking" : status === "thinking" ? "thinking" : "idle"} /></span>}
        <h2>{call.agent.name}</h2>
        <p role="status">{connected ? time : ""}{connected && status ? " · " : ""}{statusLabel(status, ar)}</p>
        {children}
      </div>
      <footer className="cx-callscreen-controls">{controls}</footer>
    </div>
    {minimized && <button type="button" className="cx-callbubble" onClick={() => calls.minimize(false)} aria-label={ar ? "رجوع للمكالمة" : "Return to call"}>
      <BotAvatar agent={call.agent} size={30} state="idle" /><span>{connected ? time : statusLabel(status, ar)}</span>
    </button>}
  </>;
}

function statusLabel(s: string, ar: boolean) {
  const map: Record<string, [string, string]> = {
    connecting: ["جاري الاتصال…", "Connecting…"], listening: ["بيسمعك", "Listening"], thinking: ["بيفكر…", "Thinking…"],
    speaking: ["بيتكلم", "Speaking"], muted: ["الميكروفون مقفول", "Muted"], live: ["", ""], ended: ["انتهت المكالمة", "Call ended"],
  };
  return (map[s] || ["", ""])[ar ? 0 : 1];
}

function VoiceCall({ call, minimized }: { call: ActiveCall; minimized: boolean }) {
  const ar = isAr();
  const choice = useVoiceChoice(ar ? "ar" : "en", call.agent.id, call.agentIds, call.agent.voiceSettings || { voice: "Not set", language: "Auto", speed: 1 });
  const [phase, setPhase] = useState<CallPhase | "ready">("connecting");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const live = useRef<RealtimeCall | null>(null);

  useEffect(() => {
    if (!choice.voiceId) { if (choice.error) setError(choice.error); return; }
    let cancelled = false; let handle: RealtimeCall | null = null;
    setError(""); setPhase("connecting");
    startRealtimeCall({
      voiceId: choice.voiceId, language: choice.language, agentName: call.agent.name, agentPrompt: call.agent.prompt || call.agent.description || "", reason: call.reason,
      onPhase: (p) => { if (!cancelled) { setPhase(p); if (p === "speaking") setError(""); } },
      onError: (m) => { if (!cancelled) setError(m); },
    }).then(async (c) => {
      if (cancelled) { c.end(); return; }
      handle = c; live.current = c;
      if (!(await c.resumeAudio())) setNeedsTap(true);
    }).catch((e) => {
      if (cancelled) return;
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      setError(denied ? (ar ? "اسمح للتطبيق باستخدام الميكروفون" : "Allow microphone access to talk") : e instanceof Error ? e.message : "Call unavailable");
      setPhase("ready");
    });
    return () => { cancelled = true; handle?.end(); live.current = null; };
  }, [choice.voiceId, choice.language, call.key, attempt]);

  const end = () => { live.current?.end(); live.current = null; calls.end(); };
  const status = muted && phase === "listening" ? "muted" : phase === "ready" ? "" : phase;
  return <Shell call={call} minimized={minimized} connected={phase !== "connecting" && phase !== "ready"} status={status}
    controls={<>
      {phase === "speaking"
        ? <button type="button" className="cx-callscreen-btn" aria-label={ar ? "قاطعه" : "Interrupt"} onClick={() => live.current?.interrupt()}><Hand size={24} /></button>
        : <button type="button" className="cx-callscreen-btn" data-on={muted} aria-label={muted ? (ar ? "فتح الميكروفون" : "Unmute") : (ar ? "كتم" : "Mute")} onClick={() => { const n = !muted; setMuted(n); live.current?.setMuted(n); }}>{muted ? <MicOff size={24} /> : <Mic size={24} />}</button>}
      <button type="button" className="cx-callscreen-btn cx-callscreen-end" aria-label={ar ? "إنهاء" : "End call"} onClick={end}><PhoneOff size={26} /></button>
      <button type="button" className="cx-callscreen-btn" aria-label={ar ? "فيديو" : "Switch to video"} onClick={() => { end(); calls.start({ ...call, kind: "video" }); }}><Video size={24} /></button>
    </>}>
    {needsTap && <button type="button" className="cx-callscreen-pill" onClick={async () => { if (await live.current?.resumeAudio()) setNeedsTap(false); }}><Volume2 size={16} />{ar ? "اضغط لتشغيل الصوت" : "Tap to turn on sound"}</button>}
    {(error || choice.error) && <button type="button" className="cx-callscreen-error" role="alert" onClick={() => { setError(""); choice.reload(); setAttempt((n) => n + 1); }}>{error || choice.error} · {ar ? "حاول تاني" : "Retry"}</button>}
  </Shell>;
}

function VideoCall({ call, minimized }: { call: ActiveCall; minimized: boolean }) {
  const ar = isAr();
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const client = useRef<import("@anam-ai/js-sdk").AnamClient | null>(null);
  const videoId = `cx-video-${call.key}`;

  useEffect(() => {
    let cancelled = false;
    setError(""); setStatus("connecting");
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error(ar ? "سجّل دخولك الأول" : "Please sign in");
        const res = await fetch("/api/video-call", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
          body: JSON.stringify({ agentName: call.agent.name, agentPrompt: call.agent.prompt || "", language: ar ? "ar" : "en", reason: call.reason || "" }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.sessionToken) throw new Error(body.error || "Video unavailable");
        if (cancelled) return;
        const { createClient, AnamEvent } = await import("@anam-ai/js-sdk");
        const c = createClient(body.sessionToken);
        client.current = c;
        c.addListener(AnamEvent.VIDEO_PLAY_STARTED, () => { if (!cancelled) setStatus("live"); });
        c.addListener(AnamEvent.CONNECTION_CLOSED, () => { if (!cancelled) setStatus("ended"); });
        c.addListener(AnamEvent.MIC_PERMISSION_DENIED, () => { if (!cancelled) setError(ar ? "اسمح للتطبيق باستخدام الميكروفون" : "Allow microphone access to talk"); });
        await c.streamToVideoElement(videoId);
        if (cancelled) void c.stopStreaming();
      } catch (e) { if (!cancelled) { setError(e instanceof Error ? e.message : "Video unavailable"); setStatus(""); } }
    })();
    return () => { cancelled = true; void client.current?.stopStreaming().catch(() => {}); client.current = null; };
  }, [call.key, attempt]);

  const end = () => { void client.current?.stopStreaming().catch(() => {}); client.current = null; calls.end(); };
  return <Shell call={call} minimized={minimized} connected={status === "live"} status={status}
    video={<video id={videoId} className="cx-callscreen-video" autoPlay playsInline />}
    controls={<>
      <button type="button" className="cx-callscreen-btn" data-on={muted} aria-label={muted ? (ar ? "فتح الميكروفون" : "Unmute") : (ar ? "كتم" : "Mute")} onClick={() => { const c = client.current; if (!c) return; if (muted) c.unmuteInputAudio(); else c.muteInputAudio(); setMuted(!muted); }}>{muted ? <MicOff size={24} /> : <Mic size={24} />}</button>
      <button type="button" className="cx-callscreen-btn cx-callscreen-end" aria-label={ar ? "إنهاء" : "End call"} onClick={end}><PhoneOff size={26} /></button>
    </>}>
    {error && <button type="button" className="cx-callscreen-error" role="alert" onClick={() => setAttempt((n) => n + 1)}>{error} · {ar ? "حاول تاني" : "Retry"}</button>}
  </Shell>;
}

export function ActiveCallScreen() {
  const { active, minimized } = useCalls();
  if (!active) return null;
  return active.kind === "video" ? <VideoCall key={active.key} call={active} minimized={minimized} /> : <VoiceCall key={active.key} call={active} minimized={minimized} />;
}
