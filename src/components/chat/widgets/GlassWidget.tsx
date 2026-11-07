/** @doc Glass widget shell — one visual language for every in-chat card.
 *
 *  Every widget is built from these four parts, so a new widget is only a body:
 *  a frosted card, a head (logo + title + badge), a body, and an action bar.
 *  The surface comes from the settings-glass tokens, so chat cards and the
 *  settings pages share exactly the same glass.
 */
import type { ReactNode } from "react";

const SURFACE =
  "relative overflow-hidden rounded-[22px] border border-white/15 " +
  "bg-[var(--settings-surface)] backdrop-blur-[22px] saturate-150 " +
  "shadow-[0_8px_30px_rgba(0,0,0,0.18)]";

export function GlassWidget({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${SURFACE} ${className}`}>{children}</div>;
}

/** Brand mark in a frosted circle, the anchor of every widget head. */
export function WidgetMark({ src, alt, fallback }: { src?: string; alt: string; fallback?: ReactNode }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-white/15 bg-white/[0.06]">
      {src ? (
        <img src={src} alt={alt} width={22} height={22} loading="lazy" className="size-[22px] object-contain" />
      ) : (
        (fallback ?? <span className="text-[15px] font-semibold text-foreground/80">{alt.slice(0, 1)}</span>)
      )}
    </span>
  );
}

export function WidgetHead({
  mark,
  title,
  subtitle,
  badge,
}: {
  mark?: ReactNode;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-3 px-4 pt-4">
      {mark}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[13.5px] font-semibold leading-tight text-foreground">{title}</h3>
          {badge}
        </div>
        {subtitle && (
          <p className="mt-0.5 truncate text-[12.5px] leading-snug text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </header>
  );
}

export function WidgetBadge({ tone = "muted", children }: { tone?: "muted" | "ok" | "warn" | "bad"; children: ReactNode }) {
  const tones: Record<string, string> = {
    muted: "border-white/15 bg-white/[0.06] text-muted-foreground",
    ok: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    warn: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    bad: "border-red-400/25 bg-red-400/10 text-red-300",
  };
  return (
    <span className={`shrink-0 rounded-full border px-2 py-[2px] text-[10.5px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function WidgetBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`max-h-[420px] overflow-y-auto px-4 py-3 ${className}`}>{children}</div>;
}

/** Action bar: one primary action, everything else stays ghost. */
export function WidgetActions({ children }: { children: ReactNode }) {
  return (
    <footer className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">{children}</footer>
  );
}

export function WidgetButton({
  children,
  onClick,
  variant = "ghost",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const styles =
    variant === "primary"
      ? "bg-primary/90 text-primary-foreground hover:bg-primary shadow-[0_4px_16px_rgba(0,0,0,0.18)]"
      : "text-muted-foreground hover:bg-white/[0.07] hover:text-foreground";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-[7px] text-[12.5px] font-medium transition-colors disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

/** Inner cells and rows share one faint tint so the glass reads as a single pane. */
export function WidgetRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-2.5 ${className}`}>
      {children}
    </div>
  );
}

export function WidgetNote({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-1 text-[12px] leading-relaxed text-muted-foreground">{children}</p>;
}

/** Frosted skeleton while the real data is still on its way. */
export function WidgetSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded-full bg-white/[0.07]"
          style={{ width: `${88 - i * 14}%` }}
        />
      ))}
    </div>
  );
}

/** Empty state: one short line plus the action that fixes it. */
export function WidgetEmpty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
      <p className="text-[12.5px] text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

export function WidgetError({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-[16px] border border-red-400/20 bg-red-400/[0.06] px-3.5 py-3">
      <span className="mt-[2px] size-2 shrink-0 rounded-full bg-red-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] leading-relaxed text-foreground/90">{text}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-1 text-[12px] font-medium text-foreground underline">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

/** Compact key/value line used inside most widget bodies. */
export function WidgetField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-[12.5px] text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-[12.5px] font-medium text-foreground" dir="auto">
        {value}
      </span>
    </div>
  );
}

/** Auto result table: any tool result becomes a readable grid. */
export function WidgetTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  if (!columns.length || !rows.length) return null;
  return (
    <div className="overflow-x-auto rounded-[14px] border border-white/10 bg-white/[0.04]">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className="whitespace-nowrap px-3 py-2 text-[11.5px] font-medium text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-white/[0.07]">
              {row.map((cell, j) => (
                <td key={j} className="max-w-[220px] truncate px-3 py-2 text-[12px] text-foreground/90">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
