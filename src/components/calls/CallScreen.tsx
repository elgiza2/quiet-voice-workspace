/** Instagram-style voice and video call screens with a draggable minimized bubble. Calls never write to the chat. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, ChevronDown, Hand, Video, VideoOff, Volume2, SwitchCamera, ScreenShare, ScreenShareOff } from "lucide-react";
import { BotAvatar } from "@/pages/agent/hub/HubParts";
import { useVoiceChoice } from "@/pages/agent/hub/VoiceControls";
import { type CallPhase, type RealtimeCall, type CallTurn } from "@/lib/audio/realtimeCall";
import { sendCallFollowup } from "@/lib/calls/callFollowup";
import { toast } from "sonner";
import { startLiveAgentCall as startRealtimeCall } from "@/lib/audio/liveAgentCall";
import { supabase } from "@/integrations/supabase/client";
import { calls, useCalls, type ActiveCall } from "@/lib/calls/callStore";
import type { AgentInfo } from "@/lib/agentsky/client";
import { Button } from "@/components/ui/button";
import "@/styles/agent.css";
import "@/styles/agent-hub.css";
import "@/styles/calls.css";

const isAr = () => { try { return (localStorage.getItem("ceyo_language") || navigator.language || "").startsWith("ar"); } catch { return false; } };
const orbState = (s: string) => (s === "speaking" ? "talking" : s === "thinking" ? "thinking" : "idle") as "talking" | "thinking" | "idle";

function useTimer(running: boolean) {
  const [secs, setSecs] = useState(0);
  useEffect(() => { if (!running) return; const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, [running]);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

function statusLabel(s: string, ar: boolean) {
  const map: Record<string, [string, string]> = {
    connecting: ["جاري الاتصال…", "Calling…"], listening: ["بيسمعك", "Listening"], thinking: ["بيفكر…", "Thinking…"],
    speaking: ["بيتكلم", "Speaking"], muted: ["الميكروفون مقفول", "Muted"], live: ["", ""], ended: ["انتهت المكالمة", "Call ended"],
  };
  return (map[s] || ["", ""])[ar ? 0 : 1];
}

/** Blurred, enlarged avatar behind the call — the Instagram backdrop. */
export function CallBackdrop(_props: { agent: AgentInfo }) {
  return <div className="ig-call-backdrop ig-call-aurora" aria-hidden />;
}

export function CallButton({ label, on, danger, accept, disabled, onClick, children }: { label: string; on?: boolean; danger?: boolean; accept?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button variant="ghost" type="button" className="ig-call-btn" title={label} data-on={on || undefined} data-danger={danger || undefined} data-accept={accept || undefined} disabled={disabled} aria-label={label} aria-pressed={on} onClick={onClick}>{children}</Button>;
}

// ---------- minimized bubble: drag anywhere, snaps to the nearest side, tap to return ----------
const BUBBLE_W = 104, BUBBLE_H = 140, EDGE = 12;
let savedPos: { x: number; y: number } | null = null;
const clampPos = (x: number, y: number) => ({
  x: Math.min(Math.max(EDGE, x), window.innerWidth - BUBBLE_W - EDGE),
  y: Math.min(Math.max(EDGE + 56, y), window.innerHeight - BUBBLE_H - 96),
});

function CallBubble({ call, label, status, videoId }: { call: ActiveCall; label: string; status: string; videoId?: string }) {
  const ar = isAr();
  const [pos, setPos] = useState(() => savedPos ? clampPos(savedPos.x, savedPos.y) : clampPos(window.innerWidth - BUBBLE_W - EDGE, window.innerHeight * 0.42));
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);
  const mirror = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoId || !mirror.current) return;
    const src = document.getElementById(videoId) as HTMLVideoElement | null;
    if (src?.srcObject) { mirror.current.srcObject = src.srcObject; void mirror.current.play().catch(() => {}); }
  }, [videoId]);
  useEffect(() => { const onResize = () => setPos((p) => clampPos(p.x, p.y)); window.addEventListener("resize", onResize); return () => window.removeEventListener("resize", onResize); }, []);

  const onDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
    if (!d.moved) { d.moved = true; setDragging(true); }
    setPos(clampPos(e.clientX - d.dx, e.clientY - d.dy));
  };
  const onUp = () => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (!d.moved) { calls.minimize(false); return; }
    setDragging(false);
    setPos((p) => { const snapped = clampPos(p.x + BUBBLE_W / 2 < window.innerWidth / 2 ? EDGE : window.innerWidth, p.y); savedPos = snapped; return snapped; });
  };

  return <button type="button" className="ig-call-bubble" data-dragging={dragging || undefined} data-kind={call.kind}
    style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") calls.minimize(false); }}
    aria-label={ar ? "رجوع للمكالمة" : "Return to call"}>
    {videoId
      ? <video ref={mirror} className="ig-call-bubble-video" autoPlay playsInline muted />
      : <span className="ig-call-bubble-orb"><BotAvatar agent={call.agent} size={56} state={orbState(status)} /></span>}
    <span className="ig-call-bubble-label">{label}</span>
  </button>;
}

// ---------- shared shell ----------
function Shell({ call, status, connected, minimized, children, controls, video, selfView, videoId }: {
  call: ActiveCall; status: string; connected: boolean; minimized: boolean; children?: React.ReactNode; controls: React.ReactNode; video?: React.ReactNode; selfView?: React.ReactNode; videoId?: string;
}) {
  const ar = isAr();
  const time = useTimer(connected);
  const label = connected ? time : statusLabel(status, ar);
  const sub = [connected ? time : "", statusLabel(status, ar)].filter(Boolean).join(" · ");
  return <>
    <div className="agent-hub ig-call" data-minimized={minimized} data-kind={call.kind} data-connected={connected} role="dialog" aria-modal={!minimized} aria-label={ar ? "مكالمة" : "Call"} dir="auto">
      {video || <CallBackdrop agent={call.agent} />}
      <div className="ig-call-scrim" aria-hidden />
      <header className="ig-call-top">
        <Button variant="ghost" type="button" className="ig-call-icon" aria-label={ar ? "تصغير" : "Minimize"} onClick={() => calls.minimize(true)}><ChevronDown size={26} /></Button>
        {call.kind === "video" && connected && <div className="ig-call-topinfo"><strong>{call.agent.name}</strong><span role="status">{sub}</span></div>}
        <span className="ig-call-icon-space" />
      </header>
      {call.kind === "voice"
        ? <div className="ig-call-center">
            <span className="ig-call-avatar"><BotAvatar agent={call.agent} size={112} state={orbState(status)} /></span>
            <h2>{call.agent.name}</h2>
            <p role="status">{sub}</p>
            {children}
          </div>
        : <div className="ig-call-center ig-call-center--video">{children}</div>}
      {selfView}
      <footer className="ig-call-tray">{controls}</footer>
    </div>
    {minimized && <CallBubble call={call} label={label || (ar ? "مكالمة" : "Call")} status={status} videoId={videoId} />}
  </>;
}

// ---------- voice ----------
function VoiceCall({ call, minimized }: { call: ActiveCall; minimized: boolean }) {
  const ar = isAr();
  const choice = useVoiceChoice(ar ? "ar" : "en", call.agent.id, call.agentIds, call.agent.voiceSettings || { voice: "Not set", language: "Auto", speed: 1 });
  const [phase, setPhase] = useState<CallPhase | "ready">("connecting");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const live = useRef<RealtimeCall | null>(null);
  const turns = useRef<CallTurn[]>([]);
  const followedUp = useRef(false);
  const followUp = () => {
    if (followedUp.current) return;
    followedUp.current = true;
    void sendCallFollowup(call, turns.current, choice.language).catch(() => toast.error(ar ? "تعذّر إرسال رسالة بعد المكالمة" : "Could not send the call follow-up"));
  };

  useEffect(() => {
    if (!choice.voiceId) { if (choice.error) setError(choice.error); return; }
    let cancelled = false; let handle: RealtimeCall | null = null;
    setError(""); setPhase("connecting");
    startRealtimeCall({
      voiceId: choice.voiceId, language: choice.language, agentName: call.agent.name, agentPrompt: call.agent.prompt || call.agent.description || "", reason: call.reason,
      onPhase: (p) => { if (!cancelled) { setPhase(p); if (p === "speaking") setError(""); } },
      onError: (m) => { if (!cancelled) setError(m); },
      onTurn: turn => { if (!cancelled) turns.current.push(turn); },
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

  const end = () => { live.current?.end(); live.current = null; followUp(); calls.end(); };
  const status = muted && phase === "listening" ? "muted" : phase === "ready" ? "" : phase;
  return <Shell call={call} minimized={minimized} connected={phase !== "connecting" && phase !== "ready"} status={status}
    controls={<>
      <CallButton label={muted ? (ar ? "فتح الميكروفون" : "Unmute") : (ar ? "كتم" : "Mute")} on={muted} onClick={() => { const n = !muted; setMuted(n); live.current?.setMuted(n); }}>{muted ? <MicOff size={24} /> : <Mic size={24} />}</CallButton>
      <CallButton label={ar ? "قاطعه" : "Interrupt"} disabled={phase !== "speaking"} onClick={() => live.current?.interrupt()}><Hand size={24} /></CallButton>
      <CallButton label={ar ? "إنهاء" : "End call"} danger onClick={end}><PhoneOff size={24} /></CallButton>
    </>}>
    {needsTap && <Button variant="ghost" type="button" className="ig-call-pill" onClick={async () => { if (await live.current?.resumeAudio()) setNeedsTap(false); }}><Volume2 size={16} />{ar ? "اضغط لتشغيل الصوت" : "Tap to turn on sound"}</Button>}
    {(error || choice.error) && <Button variant="ghost" type="button" className="ig-call-pill" data-error role="alert" onClick={() => { setError(""); choice.reload(); setAttempt((n) => n + 1); }}>{error || choice.error} · {ar ? "حاول تاني" : "Retry"}</Button>}
  </Shell>;
}

// ---------- video ----------
type Source = "camera" | "screen" | "off";
const canShareScreen = () => typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";

/** Grabs a small JPEG of what the user is showing so the bot can "see" it. */
function captureFrame(v: HTMLVideoElement): string | null {
  if (!v.videoWidth || !v.videoHeight) return null;
  const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
  c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.6);
}

function VideoCall({ call, minimized }: { call: ActiveCall; minimized: boolean }) {
  const ar = isAr();
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [muted, setMuted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [source, setSource] = useState<Source>("off");
  const [needsTap, setNeedsTap] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const client = useRef<import("@anam-ai/js-sdk").AnamClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const selfRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cameraGeneration = useRef(0);
  const teardown = useRef<Promise<void>>(Promise.resolve());
  const videoId = `ig-video-${call.key}`;
  const turns = useRef<CallTurn[]>([]);
  const followedUp = useRef(false);
  const followUp = () => {
    if (followedUp.current) return;
    followedUp.current = true;
    void sendCallFollowup(call, turns.current, ar ? "ar" : "en").catch(() => toast.error(ar ? "تعذّر إرسال رسالة بعد المكالمة" : "Could not send the call follow-up"));
  };

  const replace = useCallback((next: MediaStream | null, src: Source) => {
    cameraGeneration.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = next; setStream(next); setSource(src);
  }, []);
  const startCamera = useCallback(async (mode: "user" | "environment") => {
    const generation = ++cameraGeneration.current;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode, width: { ideal: 720 }, height: { ideal: 1280 } }, audio: false });
      if (generation !== cameraGeneration.current) { s.getTracks().forEach((t) => t.stop()); return; }
      replace(s, "camera"); setFacing(mode); setNotice("");
    } catch { if (generation !== cameraGeneration.current) return; replace(null, "off"); setNotice(ar ? "اسمح للتطبيق باستخدام الكاميرا" : "Allow camera access to show your video"); }
  }, [ar, replace]);
  const startScreen = async () => {
    const generation = ++cameraGeneration.current;
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      if (generation !== cameraGeneration.current) { s.getTracks().forEach((t) => t.stop()); return; }
      s.getVideoTracks()[0]?.addEventListener("ended", () => { if (streamRef.current === s) void startCamera(facing); });
      replace(s, "screen"); setNotice("");
    } catch { /* user cancelled the picker */ }
  };

  // Your own camera opens with the call, like any video call.
  useEffect(() => { void startCamera("user"); return () => { cameraGeneration.current += 1; streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; }; }, [call.key]);
  useEffect(() => { if (selfRef.current) { selfRef.current.srcObject = stream; if (stream) void selfRef.current.play().catch(() => {}); } }, [stream]);

  // While live, the bot periodically "looks" at the camera or shared screen.
  useEffect(() => {
    if (status !== "live" || source === "off" || !stream) return;
    let busy = false; let last = ""; let stopped = false;
    const look = async () => {
      const v = selfRef.current; const c = client.current;
      if (busy || stopped || !v || !c || document.visibilityState !== "visible") return;
      const image = captureFrame(v); if (!image) return;
      busy = true;
      try {
        const { data } = await supabase.auth.getSession();
        const res = await fetch("/api/call-vision", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
          body: JSON.stringify({ image, source, language: ar ? "ar" : "en" }),
        });
        const body = await res.json().catch(() => ({})) as { description?: string };
        if (!stopped && body.description && body.description !== last) {
          last = body.description;
          try { c.addContext(`[You see the user's ${source === "screen" ? "shared screen" : "camera"}] ${body.description}`); } catch { /* session closing */ }
        }
      } catch { /* vision is best effort */ } finally { busy = false; }
    };
    const first = setTimeout(look, 1200);
    const t = setInterval(look, source === "screen" ? 5000 : 8000);
    return () => { stopped = true; clearTimeout(first); clearInterval(t); };
  }, [status, source, stream]);

  useEffect(() => {
    let cancelled = false;
    let owned: import("@anam-ai/js-sdk").AnamClient | null = null;
    let startup: Promise<void> = Promise.resolve();
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let disposal: Promise<void> | undefined;
    const controller = new AbortController();
    const dispose = () => {
      if (!disposal) disposal = (async () => {
        await startup.catch(() => {});
        if (client.current === owned) client.current = null;
        await owned?.stopStreaming().catch(() => {});
      })();
      return disposal;
    };
    const failed = (message: string) => {
      if (cancelled) return;
      cancelled = true; controller.abort(); clearTimeout(watchdog);
      setError(message); setStatus("ended");
      teardown.current = dispose();
    };
    setError(""); setNeedsTap(false); setStatus("connecting");
    // Deferring startup cancels React's mount probe before it opens a provider session.
    const begin = setTimeout(() => { startup = (async () => {
      try {
        await teardown.current;
        if (cancelled) return;
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!data.session) throw new Error(ar ? "سجّل دخولك الأول" : "Please sign in");
        const res = await fetch("/api/video-call", {
          signal: controller.signal,
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
          body: JSON.stringify({ agentName: call.agent.name, agentPrompt: call.agent.prompt || "", language: ar ? "ar" : "en", reason: call.reason || "" }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.sessionToken) throw new Error(body.error || "Video unavailable");
        if (cancelled) return;
        const { createClient, AnamEvent } = await import("@anam-ai/js-sdk");
        if (cancelled) return;
        const c = createClient(body.sessionToken);
        owned = c; client.current = c;
        c.addListener(AnamEvent.MESSAGE_HISTORY_UPDATED, history => {
          if (!cancelled) turns.current = history.filter(m => m.content.trim()).map(m => ({ role: m.role === "user" ? "user" : "assistant", text: m.content }));
        });
        c.addListener(AnamEvent.VIDEO_STREAM_STARTED, () => {
          if (cancelled) return;
          void remoteRef.current?.play().catch(() => { if (!cancelled) setNeedsTap(true); });
        });
        c.addListener(AnamEvent.AUDIO_STREAM_STARTED, (audio) => {
          if (cancelled || !audioRef.current) return;
          audioRef.current.srcObject = audio;
          void audioRef.current.play().catch(() => { if (!cancelled) setNeedsTap(true); });
        });
        c.addListener(AnamEvent.VIDEO_PLAY_STARTED, () => { if (!cancelled) { clearTimeout(watchdog); setStatus("live"); } });
        c.addListener(AnamEvent.CONNECTION_CLOSED, () => failed(ar ? "اتصال الفيديو انقطع. حاول تاني." : "Video connection closed. Please retry."));
        c.addListener(AnamEvent.MIC_PERMISSION_DENIED, () => failed(ar ? "اسمح للتطبيق باستخدام الميكروفون" : "Allow microphone access to talk"));
        watchdog = setTimeout(() => failed(ar ? "الفيديو موصلش. حاول تاني أو راجع اتصال الإنترنت." : "Video did not connect. Retry or check your connection."), 30000);
        await c.streamToVideoElement(videoId);
      } catch (e) {
        const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
        failed(denied ? (ar ? "اسمح للتطبيق باستخدام الميكروفون" : "Allow microphone access to talk") : ar ? "تعذّر بدء الفيديو. حاول تاني وتأكد إن مفيش مكالمة تانية مفتوحة." : "Could not start video. Retry and check no other call is open.");
      }
    })(); }, 0);
    return () => {
      cancelled = true; clearTimeout(begin); clearTimeout(watchdog); controller.abort();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.srcObject = null; }
      teardown.current = dispose();
    };
  }, [call.key, attempt]);

  const end = () => { followUp(); replace(null, "off"); calls.end(); };
  const sharing = source === "screen";
  return <Shell call={call} minimized={minimized} connected={status === "live"} status={status} videoId={videoId}
    video={<><CallBackdrop agent={call.agent} /><video ref={remoteRef} id={videoId} className="ig-call-remote" data-live={status === "live" || undefined} autoPlay playsInline muted /><audio ref={audioRef} autoPlay /></>}
    selfView={<div className="ig-call-self" data-hidden={source === "off" || undefined} data-mirror={(source === "camera" && facing === "user") || undefined}>
      <video ref={selfRef} autoPlay playsInline muted />
      {sharing && <span className="ig-call-self-tag"><ScreenShare size={12} />{ar ? "بتشارك الشاشة" : "Sharing"}</span>}
    </div>}
    controls={<>
      <CallButton label={ar ? "قلب الكاميرا" : "Flip camera"} disabled={source !== "camera"} onClick={() => void startCamera(facing === "user" ? "environment" : "user")}><SwitchCamera size={24} /></CallButton>
      <CallButton label={source === "off" ? (ar ? "تشغيل الكاميرا" : "Turn camera on") : (ar ? "قفل الكاميرا" : "Turn camera off")} on={source === "off"} onClick={() => (source === "off" ? void startCamera(facing) : replace(null, "off"))}>{source === "off" ? <VideoOff size={24} /> : <Video size={24} />}</CallButton>
      <CallButton label={muted ? (ar ? "فتح الميكروفون" : "Unmute") : (ar ? "كتم" : "Mute")} on={muted} onClick={() => { const c = client.current; if (!c) return; if (muted) c.unmuteInputAudio(); else c.muteInputAudio(); setMuted(!muted); }}>{muted ? <MicOff size={24} /> : <Mic size={24} />}</CallButton>
      {canShareScreen() && <CallButton label={sharing ? (ar ? "وقف مشاركة الشاشة" : "Stop sharing") : (ar ? "مشاركة الشاشة" : "Share screen")} on={sharing} onClick={() => (sharing ? void startCamera(facing) : void startScreen())}>{sharing ? <ScreenShareOff size={24} /> : <ScreenShare size={24} />}</CallButton>}
      <CallButton label={ar ? "إنهاء" : "End call"} danger onClick={end}><PhoneOff size={24} /></CallButton>
    </>}>
    {status !== "live" && <div className="ig-call-waiting"><span className="ig-call-avatar"><BotAvatar agent={call.agent} size={112} state="idle" /></span><h2>{call.agent.name}</h2><p>{statusLabel(status, ar) || (ar ? "جاري الاتصال…" : "Calling…")}</p></div>}
    {notice && <p className="ig-call-pill" role="status">{notice}</p>}
    {needsTap && <Button variant="ghost" className="ig-call-pill" onClick={() => {
      const plays = [remoteRef.current?.play(), audioRef.current?.play()].filter((p): p is Promise<void> => Boolean(p));
      void Promise.all(plays).then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
    }}><Volume2 size={16} />{ar ? "اضغط لتشغيل الفيديو والصوت" : "Tap to start video and sound"}</Button>}
    {error && <Button variant="ghost" className="ig-call-pill" data-error role="alert" onClick={() => setAttempt((n) => n + 1)}>{error} · {ar ? "حاول تاني" : "Retry"}</Button>}
  </Shell>;
}

export function ActiveCallScreen() {
  const { active, minimized } = useCalls();
  if (!active) return null;
  return active.kind === "video" ? <VideoCall key={active.key} call={active} minimized={minimized} /> : <VoiceCall key={active.key} call={active} minimized={minimized} />;
}
