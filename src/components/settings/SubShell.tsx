/** @doc Unified Settings sub-page shell — the same glass chrome everywhere:
 * sheet entry, big title, frosted cards, thin tinted icon tiles. */
import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { DesktopSettingsLayout } from "@/components/settings/DesktopSettingsLayout";
import ProfileGlassShell from "@/components/profile/ProfileGlassShell";
import { useNavigate } from "react-router-dom";

// ============================================================================
// SubShell — top-level wrapper for every settings sub-page.
// Desktop: keeps the left nav rail, renders the glass heading + children.
// Mobile: ProfileGlassShell (identical sheet, title and rows).
// ============================================================================
interface SubShellProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  onBack?: () => void;
  action?: ReactNode;
  children: ReactNode;
}

export function SubShell({
  title,
  subtitle,
  backTo = "/settings",
  onBack,
  action,
  children,
}: SubShellProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  // Settings pages always step up to their parent screen — browser history can
  // point anywhere (deep links, redirects) and used to land users on the wrong page.
  const goBack = onBack ?? (() => navigate(backTo));

  if (!isMobile) {
    return (
      <DesktopSettingsLayout>
        <div className="gx-pane">
          <div className="gx-top">
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="gx-hbtn"
            >
              <ChevronRight className="gx-hicon rotate-180" strokeWidth={2} />
            </button>
            <div className="gx-top-trail">{action}</div>
          </div>
          <h1 className="gx-title">{title}</h1>
          {subtitle && <p className="gx-sub">{subtitle}</p>}
          <div className="gx-content">{children}</div>
          <div className="gx-spacer" />
        </div>
      </DesktopSettingsLayout>
    );
  }

  return (
    <ProfileGlassShell title={title} subtitle={subtitle} onBack={goBack} trailing={action}>
      {children}
    </ProfileGlassShell>
  );
}

// ============================================================================
// SubSection — a titled section with an optional note.
// ============================================================================
interface SubSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SubSection({ title, description, children }: SubSectionProps) {
  return (
    <section className="gx-section">
      <h2 className="gx-section-title">{title}</h2>
      {description && <p className="gx-section-note">{description}</p>}
      {children}
    </section>
  );
}

// ============================================================================
// SubCard — unified glass card surface. Optional padding.
// ============================================================================
export function SubCard({
  children,
  className,
  flush,
}: {
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <div className={cn("gx-card", !flush && "gx-card-pad", className)}>{children}</div>
  );
}

// ============================================================================
// SubRowList — grouped rows inside one glass card (hairline dividers built in).
// ============================================================================
export function SubRowList({ children }: { children: ReactNode }) {
  return <div className="gx-card">{children}</div>;
}

// ============================================================================
// SubRow — a tappable row: tinted icon tile, label + hint, trailing or chevron.
// ============================================================================
interface SubRowProps {
  label: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  trailing?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  tone?: "neutral" | "blue" | "violet" | "green" | "yellow" | "pink" | "red";
}

export function SubRow({
  label,
  hint,
  icon: Icon,
  trailing,
  onClick,
  danger,
  disabled,
  tone = "neutral",
}: SubRowProps) {
  const isClickable = !!onClick && !disabled;
  const Comp: any = isClickable ? "button" : "div";
  return (
    <Comp
      type={isClickable ? "button" : undefined}
      onClick={isClickable ? onClick : undefined}
      disabled={disabled}
      className={cn(
        "gx-row",
        `gx-tone-${danger ? "red" : tone}`,
        danger && "gx-row-danger",
        isClickable && "gx-row-tap",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {Icon && (
        <span className="gx-tile">
          <Icon strokeWidth={1.7} />
        </span>
      )}
      <span className="gx-row-body">
        <span className="gx-row-label">{label}</span>
        {hint && <span className="gx-row-hint">{hint}</span>}
      </span>
      {trailing !== undefined ? (
        <span className="gx-row-trailing">{trailing}</span>
      ) : isClickable ? (
        <ChevronRight className="gx-chev" strokeWidth={1.9} />
      ) : null}
    </Comp>
  );
}

// ============================================================================
// SubStatStrip — small stat tiles in one glass card.
// ============================================================================
export function SubStatStrip({
  items,
}: {
  items: { label: string; value: string; sub?: string }[];
}) {
  return (
    <div className="gx-card gx-card-pad">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--settings-muted)]">
              {it.label}
            </p>
            <p className="mt-1 text-[18px] font-semibold leading-none tabular-nums text-[color:var(--settings-ink)]">
              {it.value}
            </p>
            {it.sub && (
              <p className="mt-1 text-[11.5px] text-[color:var(--settings-muted)]">{it.sub}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// DangerCallout — delete-style confirmation area.
// ============================================================================
export function DangerCallout({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action: ReactNode;
}) {
  return (
    <div className="gx-card gx-card-pad flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-[color:var(--settings-red)]">{title}</p>
        {description && (
          <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--settings-muted)]">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export default SubShell;
