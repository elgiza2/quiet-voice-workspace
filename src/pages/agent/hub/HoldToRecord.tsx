/** WhatsApp-style voice note button: hold to record, slide to cancel, slide up to lock, release to send. */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Mic, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { microphoneRecording, type Recording } from "@/lib/audio/voiceClient";

const CANCEL_PX = 110;
const LOCK_PX = 80;
const MIN_MS = 500;

export function HoldToRecord({ ar, disabled, onRecording, onRecorded }: { ar: boolean; disabled?: boolean; onRecording: (on: boolean) => void; onRecorded: (blob: Blob) => void }) {
  const [state, setState] = useState<null | { locked: boolean; dx: number; dy: number }>(null);
  const [elapsed, setElapsed] = useState(0);
  const rec = useRef<Recording | null>(null);
  const pending = useRef<Promise<Recording> | null>(null);
  const start = useRef(0);
  const origin = useRef({ x: 0, y: 0, rtl: false });
  const discard = useRef(false);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (!state) return; const t = setInterval(() => setElapsed(Date.now() - start.current), 200); return () => clearInterval(t); }, [!!state]);
  useEffect(() => () => { discard.current = true; rec.current?.stop(); }, []);

  const finish = async (send: boolean) => {
    const duration = Date.now() - start.current;
    discard.current = !send || duration < MIN_MS;
    setState(null); onRecording(false);
    const r = rec.current || (pending.current ? await pending.current.catch(() => null) : null);
    rec.current = null; pending.current = null;
    if (!r) return;
    r.stop();
    if (send && duration < MIN_MS) { toast(ar ? "اضغط مطوّلاً عشان تسجّل" : "Hold to record"); return; }
    const blob = await r.result.catch(() => null);
    if (!discard.current && blob && blob.size > 800) { try { navigator.vibrate?.(20); } catch { /* unsupported */ } onRecorded(blob); }
  };

  const begin = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || state) return;
    e.preventDefault();
    btn.current?.setPointerCapture(e.pointerId);
    origin.current = { x: e.clientX, y: e.clientY, rtl: getComputedStyle(e.currentTarget).direction === "rtl" };
    start.current = Date.now(); setElapsed(0); discard.current = false;
    setState({ locked: false, dx: 0, dy: 0 }); onRecording(true);
    try { navigator.vibrate?.(15); } catch { /* unsupported */ }
    const p = microphoneRecording();
    pending.current = p;
    p.then((r) => { if (pending.current === p) rec.current = r; else r.stop(); })
      .catch((err) => {
        setState(null); onRecording(false); pending.current = null;
        const denied = err instanceof DOMException && err.name === "NotAllowedError";
        toast.error(denied ? (ar ? "اسمح باستخدام الميكروفون" : "Allow microphone access") : err instanceof Error ? err.message : "Recording unavailable");
      });
  };

  const move = (e: React.PointerEvent) => {
    if (!state || state.locked) return;
    const raw = e.clientX - origin.current.x;
    const dx = origin.current.rtl ? Math.max(0, raw) : Math.min(0, raw);
    const dy = Math.min(0, e.clientY - origin.current.y);
    if (Math.abs(dx) > CANCEL_PX) { void finish(false); return; }
    if (-dy > LOCK_PX) { try { navigator.vibrate?.(15); } catch { /* unsupported */ } setState({ locked: true, dx: 0, dy: 0 }); return; }
    setState({ locked: false, dx, dy });
  };

  const release = () => { if (state && !state.locked) void finish(true); };
  const time = `${Math.floor(elapsed / 60000)}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, "0")}`;
  const Chevron = ar ? ChevronRight : ChevronLeft;

  return <>
    {state && <div className="cx-wa-rec" data-locked={state.locked} role="status" aria-live="polite">
      {state.locked
        ? <button type="button" className="cx-wa-trash" aria-label={ar ? "إلغاء" : "Delete"} onClick={() => void finish(false)}><Trash2 size={20} /></button>
        : <span className="cx-wa-dot" />}
      <span className="cx-wa-time">{time}</span>
      {state.locked
        ? <span className="cx-wa-wave" aria-hidden>{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 7) * 0.09}s` }} />)}</span>
        : <span className="cx-wa-slide" style={{ transform: `translateX(${state.dx}px)`, opacity: 1 - Math.abs(state.dx) / CANCEL_PX }}><Chevron size={16} />{ar ? "اسحب للإلغاء" : "Slide to cancel"}</span>}
    </div>}
    {state && !state.locked && <span className="cx-wa-lock" style={{ transform: `translateY(${Math.max(-LOCK_PX, state.dy) / 2}px)` }} aria-hidden><Lock size={16} /><ChevronLeft size={14} className="cx-wa-up" /></span>}
    {state?.locked
      ? <button type="button" className="cx-circle cx-mic cx-wa-send" aria-label={ar ? "إرسال" : "Send"} onClick={() => void finish(true)}><Send size={17} /></button>
      : <button ref={btn} type="button" className="cx-circle cx-mic" data-active={!!state} disabled={disabled} aria-label={ar ? "اضغط مطوّلاً للتسجيل" : "Hold to record"}
          style={state ? { transform: `translate(${state.dx}px, ${state.dy}px) scale(1.6)` } : undefined}
          onPointerDown={begin} onPointerMove={move} onPointerUp={release} onPointerCancel={() => void finish(false)} onContextMenu={(e) => e.preventDefault()}>
          <Mic size={17} />
        </button>}
  </>;
}
