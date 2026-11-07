import { lookFor, shapeStyle, type BotLook } from "./botLooks";
import { useEffect, useState, type ReactNode } from "react";
import { readGroupAvatar } from "./chatPrefs";
import { Bot, Check, ChevronLeft, ChevronRight, Loader2, Mic, Plus, Search, Users, X } from "lucide-react";
import { AgentOrb, type OrbState } from "@/components/agent/AgentOrb";
import type { AgentColor, AgentInfo } from "@/lib/agentsky/client";
import type { AgentGroup } from "./hubStorage";

export type HubLang = "en" | "ar";

export function useGroupAvatar(id: string) {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setV(readGroupAvatar(id));
    read();
    window.addEventListener("ceyo-group-avatar", read);
    return () => window.removeEventListener("ceyo-group-avatar", read);
  }, [id]);
  return v;
}

export function BotAvatar({
  agent,
  size = 46,
  state = "idle",
  className = "",
  look,
}: {
  agent: Pick<AgentInfo, "name" | "color" | "isDefault"> & { id?: string };
  size?: number;
  state?: OrbState;
  className?: string;
  look?: BotLook;
}) {
  const resolved = look || lookFor(agent);
  return (
    <span
      className={`hub-bot-avatar ${agent.isDefault ? "hub-primary-orb" : ""} ${className}`}
      data-agent-color={agent.color}
      data-look={resolved.shape}
      style={shapeStyle(resolved) as import("react").CSSProperties}
      aria-label={agent.name}
    >
      <AgentOrb color={agent.color} size={size} state={state} />
    </span>
  );
}

export function GroupAvatar({
  group,
  agents,
  size = 42,
  className = "",
}: {
  group: AgentGroup;
  agents: AgentInfo[];
  size?: number;
  className?: string;
}) {
  const members = group.memberIds
    .map((id) => agents.find((agent) => agent.id === id))
    .filter((agent): agent is AgentInfo => !!agent)
    .slice(0, 3);
  const remaining = Math.max(0, group.memberIds.length - members.length);
  const custom = useGroupAvatar(group.id);
  if (custom) return <img className={`hub-group-avatar-img ${className}`} src={custom} alt={group.name} style={{ width: size * 1.6, height: size * 1.6 }} />;
  return (
    <span className={`hub-group-avatar ${className}`} aria-label={group.name}>
      {members.map((agent, index) => (
        <span className={`hub-group-member hub-group-member-${index + 1}`} key={agent.id}>
          <BotAvatar agent={agent} size={size} />
        </span>
      ))}
      {remaining > 0 && <span className="hub-group-more">+{remaining}</span>}
      {!members.length && <Users size={size * 0.65} aria-hidden />}
    </span>
  );
}

export function HubIconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`hub-icon-button ${className}`}
      aria-label={label}
      title={label}
      data-active={active}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function BackButton({ lang, onClick, label }: { lang: HubLang; onClick: () => void; label?: string }) {
  return (
    <HubIconButton label={label || (lang === "ar" ? "رجوع" : "Back")} onClick={onClick}>
      {lang === "ar" ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
    </HubIconButton>
  );
}

export function HubSpinner({ label }: { label: string }) {
  return (
    <div className="hub-loading" role="status">
      <Loader2 size={19} className="animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function EmptySearch({ lang, query }: { lang: HubLang; query: string }) {
  return (
    <div className="hub-empty-state">
      <span className="hub-empty-icon"><Search size={22} /></span>
      <strong>{lang === "ar" ? "مفيش نتائج" : "No results"}</strong>
      <p>{lang === "ar" ? `جرّب كلمة تانية غير «${query}».` : `Try a different search than “${query}”.`}</p>
    </div>
  );
}

export function SelectionToggle({ selected, label }: { selected: boolean; label: string }) {
  return (
    <span className="hub-selection-toggle" data-selected={selected} aria-label={label} aria-hidden>
      {selected && <Check size={14} />}
    </span>
  );
}

export function FormFooter({
  lang,
  busy,
  disabled,
  submitLabel,
  onCancel,
}: {
  lang: HubLang;
  busy: boolean;
  disabled?: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="hub-form-footer">
      <button type="submit" className="hub-button hub-button-primary" disabled={busy || disabled}>
        {busy && <Loader2 size={16} className="animate-spin" />}
        {submitLabel}
      </button>
      <button type="button" className="hub-button hub-button-secondary" onClick={onCancel} disabled={busy}>
        {lang === "ar" ? "إلغاء" : "Cancel"}
      </button>
    </div>
  );
}

export function ColorSwatches({ value, onChange }: { value: AgentColor; onChange: (color: AgentColor) => void }) {
  const colors: AgentColor[] = ["aurora", "ocean", "ember", "mint", "sun", "rose", "mono"];
  return (
    <div className="hub-swatches" role="radiogroup" aria-label="Bot color">
      {colors.map((color) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          className="hub-swatch"
          data-agent-color={color}
          data-selected={value === color}
          key={color}
          onClick={() => onChange(color)}
        >
          <span />
        </button>
      ))}
    </div>
  );
}

export function VoiceCaptureButton({
  lang,
  listening,
  onClick,
  waveform = false,
}: {
  lang: HubLang;
  listening: boolean;
  onClick: () => void;
  waveform?: boolean;
}) {
  const label = listening ? (lang === "ar" ? "وقّف الاستماع" : "Stop listening") : lang === "ar" ? "تحدث" : "Speak";
  return (
    <HubIconButton label={label} onClick={onClick} active={listening} className={waveform ? "hub-voice-button" : ""}>
      {waveform ? (
        <span className="hub-waveform" aria-hidden><i /><i /><i /><i /></span>
      ) : listening ? <X size={18} /> : <Mic size={18} />}
    </HubIconButton>
  );
}

export function CreateHint({ lang, onClick }: { lang: HubLang; onClick: () => void }) {
  return (
    <button type="button" className="hub-create-hint" onClick={onClick}>
      <span className="hub-create-hint-icon"><Plus size={18} /></span>
      <span>
        <strong>{lang === "ar" ? "عايز وكيل جديد؟" : "Need another agent?"}</strong>
        <small>{lang === "ar" ? "اطلبه من Ceyo أو اعمله بنفسك" : "Ask Ceyo or create it yourself"}</small>
      </span>
      <Bot size={17} />
    </button>
  );
}
