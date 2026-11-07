/**
 * @doc In-app notifications: a frosted glass card that drops in from the top of
 * the screen, holds a title and a line of detail, then slides away on its own.
 * The idea comes from expo-dynamic-notifications, rebuilt for the web with the
 * same --settings-* glass tokens the settings pages use.
 *
 * Dismiss it the way a phone banner behaves: swipe it left, right or up, or
 * simply tap it. There is no close button.
 *
 * Wrap the app once in <DynamicNotifications> and fire from anywhere:
 *   const { trigger } = useDynamicNotifications();
 *   trigger({ title: "Saved", message: "Your draft is safe." });
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type DynamicNotification = {
  /** Your identifier, handed back through onDismiss. */
  id?: string;
  /** Bold first line. */
  title: string;
  /** Secondary line. */
  message?: string;
  /** Image shown in the round leading slot. */
  avatar?: string;
  /** Custom leading slot; wins over `avatar`. */
  leading?: ReactNode;
  /** Small mark on the trailing side. */
  symbol?: ReactNode;
  /** Tint for the title. */
  accent?: string;
  /** Lifetime in ms. null keeps it on screen until it is dismissed. */
  duration?: number | null;
  onPress?: () => void;
  /** Replace the whole body; the enter/exit animation still applies. */
  render?: (n: DynamicNotification) => ReactNode;
};

type Ctx = {
  trigger: (n: DynamicNotification) => void;
  dismiss: () => void;
  isVisible: boolean;
  notification: DynamicNotification | null;
};

const DynamicNotificationsCtx = createContext<Ctx | null>(null);

export const useDynamicNotifications = (): Ctx =>
  useContext(DynamicNotificationsCtx) ?? {
    trigger: () => {},
    dismiss: () => {},
    isVisible: false,
    notification: null,
  };

/** Cards stay this long unless the notification overrides it. */
const DEFAULT_DURATION = 4200;
/** Keep in step with the .mgx-notif transitions below. */
const ENTER_MS = 520;
const EXIT_MS = 320;
/** How far a finger has to travel before the card is thrown away. */
const SWIPE_X = 84;
const SWIPE_UP = 58;
const SWIPE_DOWN = 84;

type Drag = { dx: number; dy: number; live: boolean };

export function DynamicNotifications({
  children,
  duration = DEFAULT_DURATION,
  onDismiss,
  accent,
}: {
  children?: ReactNode;
  duration?: number | null;
  onDismiss?: (n: DynamicNotification) => void;
  accent?: string;
}) {
  const [current, setCurrent] = useState<DynamicNotification | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const timer = useRef<number | null>(null);
  const closer = useRef<number | null>(null);
  const opener = useRef<number | null>(null);
  const pointer = useRef({ x: 0, y: 0, dx: 0, dy: 0, active: false, moved: false });

  const clearTimers = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (closer.current) window.clearTimeout(closer.current);
    if (opener.current) window.clearTimeout(opener.current);
    timer.current = closer.current = opener.current = null;
  }, []);

  const dismiss = useCallback(() => {
    clearTimers();
    setOpen(false);
    // Slide away first, then unmount — the reverse of how it arrived.
    closer.current = window.setTimeout(() => {
      setMounted(false);
      setCurrent((n) => {
        if (n) onDismiss?.(n);
        return null;
      });
    }, EXIT_MS);
  }, [clearTimers, onDismiss]);

  const trigger = useCallback(
    (n: DynamicNotification) => {
      clearTimers();
      setDrag(null);
      setCurrent(n);
      setMounted(true);
      setOpen(false);
      // One frame below the fold, then drop in.
      opener.current = window.setTimeout(() => setOpen(true), 30);
      const life = n.duration === undefined ? duration : n.duration;
      if (life !== null) {
        timer.current = window.setTimeout(() => dismiss(), ENTER_MS + life);
      }
    },
    [clearTimers, dismiss, duration],
  );

  useEffect(() => clearTimers, [clearTimers]);

  const value = useMemo<Ctx>(
    () => ({ trigger, dismiss, isVisible: mounted, notification: current }),
    [trigger, dismiss, mounted, current],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointer.current = {
      x: event.clientX,
      y: event.clientY,
      dx: 0,
      dy: 0,
      active: true,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = pointer.current;
    if (!state.active) return;
    state.dx = event.clientX - state.x;
    state.dy = event.clientY - state.y;
    if (!state.moved && Math.hypot(state.dx, state.dy) < 6) return;
    state.moved = true;
    // Only the axis the finger actually committed to, so the card tracks it.
    const horizontal = Math.abs(state.dx) >= Math.abs(state.dy);
    setDrag({
      dx: horizontal ? state.dx : state.dx * 0.25,
      dy: horizontal ? state.dy * 0.25 : state.dy,
      live: true,
    });
  };

  const endDrag = () => {
    const state = pointer.current;
    if (!state.active) return;
    state.active = false;
    const sideways = Math.abs(state.dx) >= SWIPE_X;
    const upwards = state.dy <= -SWIPE_UP;
    const downwards = state.dy >= SWIPE_DOWN;
    if (!sideways && !upwards && !downwards) {
      setDrag(null);
      return;
    }
    // Throw it off in the direction the finger was going, then unmount.
    const far = Math.max(window.innerWidth, 480);
    if (sideways) setDrag({ dx: Math.sign(state.dx) * far, dy: state.dy, live: false });
    else setDrag({ dx: 0, dy: Math.sign(state.dy) * Math.max(window.innerHeight * 0.5, 320), live: false });
    dismiss();
  };

  const tint = current?.accent ?? accent;

  const dragStyle = drag
    ? {
        transform: `translate3d(${drag.dx}px, ${drag.dy}px, 0) scale(${
          drag.live ? Math.max(0.9, 1 - Math.abs(drag.dx) / 1600) : 0.96
        })`,
        opacity: drag.live
          ? Math.max(0.4, 1 - (Math.abs(drag.dx) + Math.abs(drag.dy)) / 520)
          : 0,
      }
    : null;

  return (
    <DynamicNotificationsCtx.Provider value={value}>
      {children}
      <style>{NOTIF_CSS}</style>
      <div className="mgx-notif-root" aria-live="polite" aria-atomic="true">
        {mounted && current && (
          <div
            className="mgx-notif"
            data-open={open ? "true" : "false"}
            data-drag={drag?.live ? "true" : "false"}
            style={{
              ["--mgx-accent" as any]: tint ?? "var(--settings-ink)",
              ...dragStyle,
            }}
            role="status"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={() => {
              if (pointer.current.moved) return;
              current.onPress?.();
              dismiss();
            }}
          >
            <div className="mgx-notif__body">
              {current.render ? (
                current.render(current)
              ) : (
                <>
                  <span className="mgx-notif__lead">
                    {current.leading ??
                      (current.avatar ? <img src={current.avatar} alt="" loading="lazy" decoding="async" /> : null)}
                  </span>
                  <span className="mgx-notif__text">
                    <span className="mgx-notif__title">{current.title}</span>
                    {current.message ? <span className="mgx-notif__message">{current.message}</span> : null}
                  </span>
                  {current.symbol ? <span className="mgx-notif__symbol">{current.symbol}</span> : null}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </DynamicNotificationsCtx.Provider>
  );
}

const NOTIF_CSS = `
  .mgx-notif-root {
    position: fixed; inset-inline: 0; top: 0; z-index: 300;
    display: flex; justify-content: center;
    padding: calc(env(safe-area-inset-top, 0px) + 14px) 16px 0;
    pointer-events: none;
  }
  .mgx-notif {
    pointer-events: auto;
    position: relative;
    width: min(calc(100vw - 32px), 440px);
    border-radius: 26px;
    padding: 16px 18px;
    background: var(--settings-surface, oklch(1 0 0 / 0.55));
    backdrop-filter: var(--settings-frost, blur(24px) saturate(1.3));
    -webkit-backdrop-filter: var(--settings-frost, blur(24px) saturate(1.3));
    border: 1px solid var(--settings-line, oklch(0.4 0.01 255 / 0.09));
    box-shadow:
      var(--settings-shadow, inset 0 1px 0 oklch(1 0 0 / 0.6)),
      0 20px 48px oklch(0.25 0.01 255 / 0.18);
    color: var(--settings-ink, oklch(0.19 0.003 255));
    cursor: pointer;
    opacity: 0;
    transform: translateY(-28px) scale(0.96);
    transition:
      opacity 0.34s ease,
      transform 0.52s cubic-bezier(0.22, 1, 0.36, 1);
    -webkit-tap-highlight-color: transparent;
    /* The card owns the gesture: no page scroll or text selection mid-swipe. */
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .mgx-notif[data-open="true"] { opacity: 1; transform: translateY(0) scale(1); }
  .mgx-notif[data-drag="true"] { transition: none; cursor: grabbing; }
  .mgx-notif__body { display: flex; align-items: center; gap: 14px; }
  .mgx-notif__lead {
    flex: none; width: 46px; height: 46px; border-radius: 50%;
    display: grid; place-items: center; overflow: hidden;
    background: var(--settings-line, oklch(0.4 0.01 255 / 0.09));
  }
  .mgx-notif__lead img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .mgx-notif__text { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .mgx-notif__title {
    font-size: 16px; font-weight: 650; letter-spacing: -0.015em; line-height: 1.25;
    color: var(--mgx-accent);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .mgx-notif__message {
    font-size: 13.5px; line-height: 1.4; color: var(--settings-muted, oklch(0.61 0.005 255));
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .mgx-notif__symbol { flex: none; display: grid; place-items: center; color: var(--settings-muted); }
  @media (prefers-reduced-motion: reduce) {
    .mgx-notif { transition-duration: 0.01ms !important; }
  }
`;
