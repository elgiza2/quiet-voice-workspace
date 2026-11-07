/** @doc Unified mobile shell for settings sub-pages — the same glass chrome the
 * billing page uses: sheet entry, big title, frosted cards, tinted icon tiles. */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from "react";

type ShellProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  trailing?: ReactNode;
  children: ReactNode;
};

const ProfileGlassShell = ({ title, subtitle, onBack, trailing, children }: ShellProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const back =
    onBack ??
    (() => {
      const parts = location.pathname.split("/").filter(Boolean);
      if (parts.length > 1) {
        navigate("/" + parts.slice(0, -1).join("/"));
      } else {
        navigate("/settings");
      }
    });

  return (
    <div className="gx-root" dir="ltr">
      <div className="gx-screen">
        <div className="gx-top">
          <button onClick={back} aria-label="Back" className="gx-hbtn">
            <ChevronLeft className="gx-hicon" strokeWidth={2} />
          </button>
          <div className="gx-top-trail">{trailing}</div>
        </div>

        <h1 className="gx-title">{title}</h1>
        {subtitle && <p className="gx-sub">{subtitle}</p>}

        <div className="gx-content">{children}</div>
        <div className="gx-spacer" />
      </div>
    </div>
  );
};

/* ---------- Building blocks (API compatible) ---------- */

export const GlassSection = ({
  title,
  className = "",
  children,
}: {
  title?: string;
  index?: string;
  className?: string;
  children: ReactNode;
}) => (
  <section className={`gx-section ${className}`}>
    {title && <h2 className="gx-section-title">{title}</h2>}
    {children}
  </section>
);

export const GlassCard = ({
  children,
  selected = false,
  className = "",
}: {
  children: ReactNode;
  selected?: boolean;
  className?: string;
}) => (
  <div className={`gx-card ${selected ? "gx-card-selected" : ""} ${className}`}>{children}</div>
);

type RowProps = {
  index?: string;
  icon?: ReactNode;
  label: string;
  hint?: string;
  trailing?: ReactNode;
  danger?: boolean;
  tone?: "neutral" | "blue" | "violet" | "green" | "yellow" | "pink" | "red";
  onClick?: () => void;
};

export const GlassRow = ({
  icon,
  label,
  hint,
  trailing,
  danger,
  tone = "neutral",
  onClick,
}: RowProps) => (
  <button
    onClick={onClick}
    type="button"
    className={`gx-row gx-row-tap gx-tone-${danger ? "red" : tone} ${danger ? "gx-row-danger" : ""}`}
  >
    {icon && <span className="gx-tile">{icon}</span>}
    <span className="gx-row-body">
      <span className="gx-row-label">{label}</span>
      {hint && <span className="gx-row-hint">{hint}</span>}
    </span>
    {trailing !== undefined ? (
      <span className="gx-row-trailing">{trailing}</span>
    ) : (
      <ChevronRight className="gx-chev" strokeWidth={1.9} aria-hidden />
    )}
  </button>
);

export const GlassField = ({
  label,
  hint,
  ...rest
}: { label?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) => (
  <label className="gx-field">
    {label && <span className="gx-field-label">{label}</span>}
    <input {...rest} className="gx-input" />
    {hint && <span className="gx-field-hint">{hint}</span>}
  </label>
);

export const GlassPrimaryButton = ({
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...rest} className={`gx-pill ${rest.className ?? ""}`}>
    {children}
  </button>
);

export const GlassSecondaryButton = ({
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...rest} className={`gx-pill ${rest.className ?? ""}`}>
    {children}
  </button>
);

export default ProfileGlassShell;
