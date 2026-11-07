/** WhatsApp-style voice note button: hold to record, slide to cancel, slide up to lock, release to send. */
import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronLeft, ChevronRight, Lock, Mic, Send, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { microphoneRecording, type Recording } from "@/lib/audio/voiceClient";
import { Button } from "@/components/ui/button";

const CANCEL_PX = 110;
const LOCK_PX = 80;
const MIN_MS = 500;

export function HoldToRecord({ ar, disabled, onRecording, onRecorded }: { ar: boolean; disabled?: boolean; onRecording: (on: boolean) => void; onRecorded: (blob: Blob) => void }) {
  const [state, setState] = useState<null | { locked: boolean; dx: number; dy: number }>(null);
  const [elapsed, setElapsed] = useState(0);
  const session = useRef<{ promise: Promise<Recording>; started: number; locked: boolean; finished: boolean; recorder?: Recording } | null>(null);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const mounted = useRef(true);
  const origin = useRef({ x: 0, y: 0, rtl: false });
  const btn = useRef<HTMLButtonElement>(null);
  const sendTap = useRef(false);

  useEffect(() => { if (!state) return; const t = setInterval(() => setElapsed(session.current?.started ? Date.now() - session.current.started : 0), 200); return () => clearInterval(t); }, [!!state]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; const s = session.current; session.current = null; if (s) { s.finished = true; void s.promise.then(r => { r.stop(); return r.result.catch(() => {}); }).catch(() => {}); } }; }, []);

  const finish = async (send: boolean) => {
    const s = session.current;
    if (!s || s.finished) return;
    s.finished = true;
    const duration = s.started ? Date.now() - s.started : 0;
    setState(null); setStarting(false); setFinishing(true); onRecording(false);
    try {
      const r = await s.promise;
      r.stop();
      const blob = await r.result;
      if (!mounted.current || !send) return;
      if (duration < MIN_MS) { toast(ar ? "اضغط مطوّلاً بعد فتح الميكروفون" : "Hold a little longer after the microphone opens"); return; }
      if (!blob.size) throw new Error(ar ? "التسجيل فاضي، جرّب تاني" : "Recording was empty. Try again.");
      onRecorded(blob);
    } catch (err) { if (mounted.current && send) toast.error(err instanceof Error ? err.message : "Recording unavailable"); }
    finally { if (session.current === s) session.current = null; if (mounted.current) setFinishing(false); }
  };

  const begin = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || session.current || finishing) return;
    e.preventDefault();
    try { btn.current?.setPointerCapture(e.pointerId); } catch { /* unavailable capture */ }
    origin.current = { x: e.clientX, y: e.clientY, rtl: getComputedStyle(e.currentTarget).direction === "rtl" };
    setElapsed(0); setStarting(true);
    setState({ locked: false, dx: 0, dy: 0 }); onRecording(true);
    try { navigator.vibrate?.(15); } catch { /* unsupported */ }
    const p = microphoneRecording();
    const s = { promise: p, started: 0, locked: false, finished: false, recorder: undefined as Recording | undefined };
    session.current = s;
    p.then((r) => {
      s.recorder = r;
      // A release while permission is pending belongs to finish(), not a second stop path.
      if (!mounted.current) return;
      if (session.current === s && !s.finished) { s.started = Date.now(); setStarting(false); }
      void r.result.then(() => { if (mounted.current && session.current === s && !s.finished) void finish(true); }).catch(() => {});
    })
      .catch((err) => {
        if (!mounted.current || session.current !== s || s.finished) return;
        session.current = null; setState(null); setStarting(false); onRecording(false);
        const denied = err instanceof DOMException && err.name === "NotAllowedError";
        toast.error(denied ? (ar ? "اسمح باستخدام الميكروفون" : "Allow microphone access") : err instanceof Error ? err.message : "Recording unavailable");
      });
  };

  const move = (e: React.PointerEvent) => {
    const s = session.current;
    if (!s || s.finished || s.locked) return;
    const raw = e.clientX - origin.current.x;
    const dx = origin.current.rtl ? Math.max(0, raw) : Math.min(0, raw);
    const dy = Math.min(0, e.clientY - origin.current.y);
    if (Math.abs(dx) > CANCEL_PX) { void finish(false); return; }
    if (-dy >= LOCK_PX) { s.locked = true; try { navigator.vibrate?.(15); } catch { /* unsupported */ } setState({ locked: true, dx: 0, dy: 0 }); return; }
    setState({ locked: false, dx, dy });
  };

  const release = (e: React.PointerEvent) => {
    const s = session.current;
    if (!s || s.finished || s.locked) return;
    if (origin.current.y - e.clientY >= LOCK_PX) { s.locked = true; setState({ locked: true, dx: 0, dy: 0 }); return; }
    void finish(true);
  };
  const time = `${Math.floor(elapsed / 60000)}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, "0")}`;
  const Chevron = ar ? ChevronRight : ChevronLeft;

  return <>
    {state && <div className="cx-wa-rec" data-locked={state.locked} role="status" aria-live="polite">
      {state.locked
        ? <Button variant="ghost" size="icon" type="button" className="cx-wa-trash" aria-label={ar ? "إلغاء" : "Delete"} onClick={() => void finish(false)}><Trash2 size={20} /></Button>
        : <span className="cx-wa-dot" />}
      <span className="cx-wa-time">{starting ? <Loader2 size={16} className="animate-spin" /> : time}</span>
      {state.locked
        ? <span className="cx-wa-wave" aria-hidden>{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 7) * 0.09}s` }} />)}</span>
        : <span className="cx-wa-slide" style={{ transform: `translateX(${state.dx}px)`, opacity: 1 - Math.abs(state.dx) / CANCEL_PX }}><Chevron size={16} />{ar ? "اسحب للإلغاء" : "Slide to cancel"}</span>}
    </div>}
    {state && <span className="cx-wa-lock" data-locked={state.locked} aria-label={state.locked ? (ar ? "التسجيل مقفول" : "Recording locked") : undefined}><Lock size={16} />{!state.locked && <ArrowUp size={14} className="cx-wa-up" />}</span>}
    <Button variant="ghost" size="icon" ref={btn} type="button" className={`cx-circle cx-mic ${state?.locked ? "cx-wa-send" : ""}`} data-active={!!state} disabled={disabled || finishing} aria-label={state?.locked ? (ar ? "إرسال" : "Send") : (ar ? "اضغط مطوّلاً للتسجيل" : "Hold to record")}
      onPointerDown={e => { sendTap.current = Boolean(session.current?.locked); if (!session.current?.locked) begin(e); }} onPointerMove={move} onPointerUp={release} onPointerCancel={() => { if (!session.current?.locked) void finish(false); }} onClick={e => { if (session.current?.locked && (sendTap.current || e.detail === 0)) void finish(true); sendTap.current = false; }} onContextMenu={e => e.preventDefault()}>
      {finishing ? <Loader2 size={17} className="animate-spin" /> : state?.locked ? <Send size={17} /> : <Mic size={17} />}
    </Button>
  </>;
}
