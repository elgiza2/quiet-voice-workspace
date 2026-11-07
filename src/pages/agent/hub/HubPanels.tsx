import "@/styles/ceyo.css";
import { VoiceSettingsFields } from "./VoiceControls";
import { ResourceList } from "@/components/agent/ResourceList";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { fileToAvatar, writeGroupAvatar } from "./chatPrefs";
import {
  Bot,
  Camera,
  Check,
  ChevronLeft,
  Copy,
  ImageIcon,
  MoreHorizontal,
  Trash2,
  ChevronRight,
  Clock3,
  FileText,
  Library,
  MessageSquareText,
  Pencil,
  Play,
  RotateCcw,
  Search,
  Users,
  X,
  Star,
  Share2,
  Monitor,
  Bell,
} from "lucide-react";
import type { AgentColor, AgentInfo, SessionInfo } from "@/lib/agentsky/client";
import type { AgentGroup, VoiceSettings } from "./hubStorage";
import { DEFAULT_VOICE } from "./hubStorage";
import { BOT_COLORS, BOT_SHAPES, agentColorFor, lookFor, type BotLook } from "./botLooks";
import {
  BackButton,
  BotAvatar,
  ColorSwatches,
  EmptySearch,
  FormFooter,
  GroupAvatar,
  HubIconButton,
  SelectionToggle,
  type HubLang,
} from "./HubParts";

export type AgentFormValue = {
  name: string;
  description: string;
  prompt: string;
  color: AgentColor;
  category: string;
  voice: VoiceSettings;
  look?: BotLook;
};

export function AgentForm({
  lang,
  initial,
  category = "Unassigned",
  voice = DEFAULT_VOICE,
  busy,
  error,
  onSubmit,
  onCancel,
  title,
  cta,
}: {
  title?: string;
  cta?: string;
  lang: HubLang;
  initial?: AgentInfo | null;
  category?: string;
  voice?: VoiceSettings;
  busy: boolean;
  error: string;
  onSubmit: (value: AgentFormValue) => void;
  onCancel: () => void;
}) {
  const start = initial ? lookFor(initial) : { shape: "circle", hex: "#ffffff" };
  const [name, setName] = useState(initial?.name || "");
  const [shape, setShape] = useState(start.shape);
  const [hex, setHex] = useState(start.hex);
  const [v, setV] = useState<VoiceSettings>(voice);
  const look = { shape, hex };
  const ok = name.trim().length >= 2 && !busy;
  const submit = () => {
    if (!ok) return;
    const n = name.trim();
    onSubmit({
      name: n,
      description: initial?.description || `${n} — Ceyo agent`,
      prompt: initial?.prompt || `You are ${n}, a Ceyo agent. Be helpful, clear and concise. Reply in the user's language.`,
      color: agentColorFor(hex),
      category,
      voice: v,
      look,
    });
  };
  return (
    <section className="gx-create">
      <header className="gx-create-head"><button type="button" className="gx-round" aria-label="Close" onClick={onCancel}><X size={22} /></button><h1>{title || (initial ? "Edit agent" : "Create new agent")}</h1></header>
      <div className="gx-create-body">
        <div className="gx-create-preview"><BotAvatar agent={{ name: name || "Agent", color: agentColorFor(hex), isDefault: false }} look={look} size={96} /></div>
        <input className="gx-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Researcher)" onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        <div className="gx-shapes">{BOT_SHAPES.map((s) => (
          <button type="button" key={s.id} aria-label={s.id} data-active={shape === s.id} onClick={() => setShape(s.id)}>
            <BotAvatar agent={{ name: s.id, color: "mono", isDefault: false }} look={{ shape: s.id, hex: "#7a7a7a" }} size={34} />
          </button>
        ))}</div>
        <div className="gx-colors">{BOT_COLORS.map((c) => <button type="button" key={c.hex} aria-label={c.hex} data-active={hex === c.hex} style={{ background: c.hex }} onClick={() => setHex(c.hex)} />)}</div>
        <div className="gx-voice"><p className="cx-field-label">{lang === "ar" ? "الصوت واللغة" : "Voice & language"}</p><VoiceSettingsFields value={v} onChange={setV} /></div>
      </div>
      {error && <p className="gx-error" role="alert">{error}</p>}
      <button type="button" className="gx-create-cta" disabled={!ok} onClick={submit}>{busy ? "…" : cta || (initial ? "Save" : "Create")}</button>
    </section>
  );
}

export function GroupForm({
  lang,
  initial,
  agents,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  lang: HubLang;
  initial?: AgentGroup | null;
  agents: AgentInfo[];
  busy: boolean;
  error: string;
  onSubmit: (value: { name: string; memberIds: string[]; category: string }) => void;
  onCancel: () => void;
}) {
  void lang;
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(initial?.name || "");
  const [members, setMembers] = useState<string[]>(initial?.memberIds || []);
  const [q, setQ] = useState("");
  const category = initial?.category || "Unassigned";
  const toggle = (id: string) => setMembers((c) => c.includes(id) ? c.filter((x) => x !== id) : c.length >= 8 ? c : [...c, id]);
  const shown = agents.filter((a) => !q || a.name.toLowerCase().includes(q.toLowerCase()));
  const chosen = members.map((id) => agents.find((a) => a.id === id)).filter((a): a is AgentInfo => !!a);
  const finish = (skip: boolean) => {
    const n = skip || !name.trim() ? chosen.map((a) => a.name).slice(0, 3).join(", ") : name.trim();
    onSubmit({ name: n.slice(0, 60), memberIds: members, category });
  };
  if (step === 2) return (
    <section className="gx-create">
      <header className="gx-create-head"><button type="button" className="gx-round" aria-label="Back" onClick={() => setStep(1)}><ChevronRight size={22} style={{ transform: "rotate(180deg)" }} /></button><h1>New Group Chat</h1></header>
      <div className="gx-create-body gx-center">
        <div className="gx-group-preview">{chosen.slice(0, 3).map((a, i) => <span key={a.id} style={{ zIndex: 3 - i }}><BotAvatar agent={a} size={56} /></span>)}</div>
        <input className="gx-name gx-name-soft" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Project Falcon" />
        {error && <p className="hub-error" role="alert">{error}</p>}
      </div>
      <button type="button" className="gx-create-cta" data-variant={name.trim() ? "solid" : "outline"} disabled={busy} onClick={() => finish(!name.trim())}>{busy ? "…" : name.trim() ? "Create" : "Skip"}</button>
    </section>
  );
  return (
    <section className="gx-create">
      <header className="gx-create-head"><button type="button" className="gx-round" aria-label="Close" onClick={onCancel}><X size={22} /></button><h1>New Group Chat</h1><button type="button" className="gx-next" disabled={members.length < 2} onClick={() => setStep(2)}>Next</button></header>
      <div className="gx-pick-list">
        {members.length > 0 && <p className="gx-selected">{members.length} selected</p>}
        {shown.map((a) => (
          <button type="button" key={a.id} className="gx-pick" onClick={() => toggle(a.id)}>
            <BotAvatar agent={a} size={30} /><span>{a.name}</span>{members.includes(a.id) && <Check size={22} />}
          </button>
        ))}
        {agents.length < 2 && <p className="gx-selected">Create at least two bots first.</p>}
      </div>
      <div className="gx-bottom-search gx-abs"><Search size={20} /><input placeholder={members.length ? "Add another" : "Search Bots"} value={q} onChange={(e) => setQ(e.target.value)} /></div>
    </section>
  );
}

export function ProfilePanel({
  lang,
  agent,
  group,
  agents,
  sessions,
  onBack,
  onEdit,
  onOpenChat,
  onRename,
  onDelete,
  onMakePrimary,
  onComputer,
}: {
  lang: HubLang;
  agent: AgentInfo;
  group?: AgentGroup;
  agents: AgentInfo[];
  sessions: SessionInfo[];
  onBack: () => void;
  onEdit: () => void;
  onOpenChat: () => void;
  onRename?: (name: string) => void;
  onDelete?: () => void;
  onMakePrimary?: () => void;
  onComputer?: () => void;
}) {
  void sessions; void onOpenChat;
  const [notify, setNotify] = useState(() => { try { return localStorage.getItem(`ceyo_bot_notify:${agent.id}`) !== "0"; } catch { return true; } });
  const ar = lang === "ar";
  const [view, setView] = useState<"main" | "routines" | "library" | "members" | "edit" | "avatar">("main");
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const title = group?.name || agent.name;
  const members = group?.memberIds.map((id) => agents.find((item) => item.id === id)).filter((item): item is AgentInfo => !!item) || [];
  const id = group?.id || agent.id;
  const big = group ? <GroupAvatar group={group} agents={agents} size={64} className="cx-profile-group" /> : <BotAvatar agent={agent} size={96} state="hello" />;

  const Head = ({ title: t, back, right }: { title?: string; back: () => void; right?: ReactNode }) => (
    <header className="cx-sub-head"><button type="button" className="cx-circle cx-glass cx-lg" aria-label="Back" onClick={back}><ChevronLeft size={22} /></button>{t && <h1>{t}</h1>}<span className="cx-sub-right">{right}</span></header>
  );

  if (view === "routines" || view === "library") return (
    <section className="cx-sub" key={view}>
      <Head title={view === "routines" ? (ar ? "الروتينات" : "Routines") : (ar ? "المكتبة" : "Library")} back={() => setView("main")} />
      <ResourceList kind={view === "routines" ? "routines" : "files"} botId={agent.id} />
    </section>
  );

  if (view === "members") return (
    <section className="cx-sub" key={view}>
      <Head title={ar ? "الأعضاء" : "Members"} back={() => setView("main")} />
      <p className="cx-members-count">{members.length} {ar ? "عضو" : "members"}</p>
      <div className="cx-card cx-members">{members.map((m) => <div key={m.id} className="cx-member">
        <BotAvatar agent={m} size={40} state="hello" />
        <span className="cx-member-name" dir="auto">{m.name}</span>
        {m.isDefault && <em className="cx-member-tag">{ar ? "أساسي" : "Primary"}</em>}
      </div>)}</div>
    </section>
  );

  if (view === "edit" && group) return <EditGroup lang={lang} group={group} agents={agents} onBack={() => setView("main")} onAvatar={() => setView("avatar")} onSave={(n) => { onRename?.(n); setView("main"); }} />;
  if (view === "avatar" && group) return <GroupAvatarPage lang={lang} group={group} agents={agents} onBack={() => setView("edit")} />;

  return (
    <section className="cx-sub" key="main">
      <Head back={onBack} right={<>
        <button type="button" className="cx-circle cx-glass cx-lg" aria-label="Menu" onClick={() => setMenu((o) => !o)}><MoreHorizontal size={20} /></button>
        {menu && <div className="cx-scrim" onPointerDown={() => setMenu(false)} />}
        {menu && <div className="cx-pop cx-pop-down" role="menu">
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(id).then(() => setCopied(true)); setMenu(false); }}><Copy size={19} />{ar ? "نسخ المعرّف" : "Copy ID"}</button>
          {!group && !agent.isDefault && onMakePrimary && <button type="button" onClick={() => { setMenu(false); onMakePrimary(); }}><Star size={19} />{ar ? "اجعله البوت الأساسي" : "Replace Primary Bot"}</button>}
          {!group && <button type="button" onClick={() => { void navigator.clipboard?.writeText(`${agent.name}\n\n${agent.prompt || agent.description || ""}`).then(() => setCopied(true)); setMenu(false); }}><Share2 size={19} />{ar ? "شارك كقالب" : "Share as Template"}</button>}
          {onDelete && <button type="button" data-danger="true" onClick={() => { setMenu(false); onDelete(); }}><Trash2 size={19} />{group ? (ar ? "حذف الجروب" : "Delete Group Chat") : (ar ? "حذف البوت" : "Delete Bot")}</button>}
        </div>}
      </>} />
      <div className="cx-profile">
        <div className="cx-profile-avatar">{big}</div>
        <h2 dir="auto">{title}{!group && agent.isDefault && <Star size={16} className="cx-gold" fill="currentColor" />}</h2>
        <button type="button" className="cx-pill-btn" onClick={() => group ? setView("edit") : onEdit()}>{ar ? "تعديل" : "Edit"}</button>
        {copied && <p className="cx-copied">{ar ? "اتنسخ" : "Copied"}</p>}
        <div className="cx-card">
          <button type="button" onClick={() => setView("routines")}><Clock3 size={20} /><span>{ar ? "الروتينات" : "Routines"}</span><ChevronRight size={18} /></button>
          <button type="button" onClick={() => setView("library")}><Library size={20} /><span>{ar ? "المكتبة" : "Library"}</span><ChevronRight size={18} /></button>
          {!group && <button type="button" onClick={() => onComputer?.()}><Monitor size={20} /><span>{ar ? "الكمبيوتر" : "Computer"}</span><ChevronRight size={18} /></button>}
          {!group && <button type="button" onClick={() => setNotify((n) => { const next = !n; try { localStorage.setItem(`ceyo_bot_notify:${agent.id}`, next ? "1" : "0"); } catch { /* storage unavailable */ } return next; })}><Bell size={20} /><span>{ar ? "الإشعارات" : "Notifications"}</span><small>{notify ? (ar ? "شغالة" : "On") : (ar ? "مقفولة" : "Off")}</small></button>}
          {group && <button type="button" onClick={() => setView("members")}><Users size={20} /><span>{ar ? "الأعضاء" : "Members"}</span><small>{members.length}</small><ChevronRight size={18} /></button>}
        </div>
      </div>
    </section>
  );
}

function EditGroup({ lang, group, agents, onBack, onAvatar, onSave }: { lang: HubLang; group: AgentGroup; agents: AgentInfo[]; onBack: () => void; onAvatar: () => void; onSave: (name: string) => void }) {
  const ar = lang === "ar";
  const [name, setName] = useState(group.name);
  const changed = name.trim().length > 0 && name.trim() !== group.name;
  return (
    <section className="cx-sub">
      <header className="cx-sub-head"><button type="button" className="cx-circle cx-glass cx-lg" aria-label="Back" onClick={onBack}><ChevronLeft size={22} /></button><h1>{ar ? "تعديل الجروب" : "Edit Group Chat"}</h1><span className="cx-sub-right"><button type="button" className="cx-done-pill" disabled={!changed} onClick={() => onSave(name.trim().slice(0, 60))}>{ar ? "تم" : "Done"}</button></span></header>
      <div className="cx-edit">
        <button type="button" className="cx-profile-avatar cx-edit-avatar" onClick={onAvatar}><GroupAvatar group={group} agents={agents} size={64} className="cx-profile-group" /><span className="cx-pencil"><Pencil size={17} /></span></button>
        <label className="cx-field-label">{ar ? "الاسم" : "Name"}</label>
        <input className="cx-field" dir="auto" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <label className="cx-field-label">{ar ? "المظهر" : "Appearance"}</label>
        <div className="cx-card"><button type="button" onClick={onAvatar}><span>{ar ? "الصورة" : "Avatar"}</span><ChevronRight size={18} /></button></div>
      </div>
    </section>
  );
}

function GroupAvatarPage({ lang, group, agents, onBack }: { lang: HubLang; group: AgentGroup; agents: AgentInfo[]; onBack: () => void }) {
  const ar = lang === "ar";
  const [tab, setTab] = useState<"generate" | "upload">("generate");
  const [prompt, setPrompt] = useState("");
  const [err, setErr] = useState("");
  const pick = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const onFile = async (f?: File) => {
    if (!f) return;
    setErr("");
    try { writeGroupAvatar(group.id, await fileToAvatar(f)); } catch (e) { setErr(e instanceof Error ? e.message : "Upload failed"); }
  };
  return (
    <section className="cx-sub">
      <header className="cx-sub-head"><button type="button" className="cx-circle cx-glass cx-lg" aria-label="Back" onClick={onBack}><ChevronLeft size={22} /></button><h1>{ar ? "الصورة" : "Avatar"}</h1><span className="cx-sub-right"><button type="button" className="cx-done-pill" onClick={onBack}>{ar ? "تم" : "Done"}</button></span></header>
      <div className="cx-edit">
        <div className="cx-seg"><button type="button" data-active={tab === "generate"} onClick={() => setTab("generate")}>{ar ? "توليد" : "Generate"}</button><button type="button" data-active={tab === "upload"} onClick={() => setTab("upload")}>{ar ? "رفع" : "Upload"}</button></div>
        <div className="cx-profile-avatar"><GroupAvatar group={group} agents={agents} size={64} className="cx-profile-group" /></div>
        {tab === "generate" ? (<>
          <textarea className="cx-field cx-area" dir="auto" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={ar ? "اوصف الصورة…" : "Describe your avatar..."} />
          <button type="button" className="cx-wide-btn" disabled={!prompt.trim()} onClick={() => setErr(ar ? "توليد الصور لسه مش متوصل. ارفع صورة بدلها." : "Avatar generation isn't connected yet. Upload a photo instead.")}>{ar ? "توليد" : "Generate"}</button>
        </>) : (<>
          <div className="cx-card">
            <button type="button" onClick={() => pick.current?.click()}><ImageIcon size={20} /><span>{ar ? "اختار من الصور" : "Choose from Photos"}</span><ChevronRight size={18} /></button>
            <button type="button" onClick={() => cam.current?.click()}><Camera size={20} /><span>{ar ? "صوّر" : "Take Photo"}</span><ChevronRight size={18} /></button>
          </div>
          <p className="cx-hint">{ar ? "صور لحد 25 ميجا." : "Images up to 25 MB."}</p>
          <input ref={pick} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
          <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </>)}
        {err && <p className="cx-hint cx-hint-err" role="alert">{err}</p>}
        <button type="button" className="cx-link-btn" onClick={() => writeGroupAvatar(group.id, null)}>{ar ? "رجّع صور الأعضاء" : "Reset to members' avatars"}</button>
      </div>
    </section>
  );
}

const filters = ["All", "Messages", "Bots", "Group Chats", "Files", "Routines"] as const;
type SearchFilter = (typeof filters)[number];

export function SearchOverlay({
  lang,
  agents,
  groups,
  sessions,
  onClose,
  onBot,
  onGroup,
  onSession,
}: {
  lang: HubLang;
  agents: AgentInfo[];
  groups: AgentGroup[];
  sessions: SessionInfo[];
  onClose: () => void;
  onBot: (id: string) => void;
  onGroup: (id: string) => void;
  onSession: (session: SessionInfo) => void;
}) {
  const ar = lang === "ar";
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("All");
  const q = query.trim().toLowerCase();
  const matchingAgents = useMemo(() => agents.filter((agent) => !q || `${agent.name} ${agent.description}`.toLowerCase().includes(q)), [agents, q]);
  const matchingGroups = useMemo(() => groups.filter((group) => !q || group.name.toLowerCase().includes(q)), [groups, q]);
  const matchingSessions = useMemo(() => sessions.filter((session) => q && session.title.toLowerCase().includes(q)), [sessions, q]);
  const localizedFilter = (value: SearchFilter) => ar ? ({ All: "الكل", Messages: "الرسائل", Bots: "البوتات", "Group Chats": "الجروبات", Files: "الملفات", Routines: "الروتينات" }[value]) : value;
  const noResults = !matchingAgents.length && !matchingGroups.length && !matchingSessions.length;

  return (
    <section className="hub-search-overlay" aria-label={ar ? "بحث" : "Search"}>
      <div className="hub-search-filters" role="tablist">
        {filters.map((item) => <button type="button" role="tab" aria-selected={filter === item} data-active={filter === item} key={item} onClick={() => setFilter(item)}>{localizedFilter(item)}</button>)}
      </div>
      <div className="hub-search-results">
        {(filter === "All" || filter === "Bots") && matchingAgents.map((agent) => (
          <button type="button" className="hub-search-row" key={agent.id} onClick={() => onBot(agent.id)}><BotAvatar agent={agent} size={40} /><span><strong>{agent.name}</strong><small>{agent.description}</small></span></button>
        ))}
        {(filter === "All" || filter === "Group Chats") && matchingGroups.map((group) => (
          <button type="button" className="hub-search-row" key={group.id} onClick={() => onGroup(group.id)}><GroupAvatar group={group} agents={agents} size={34} /><span><strong>{group.name}</strong><small>{group.category}</small></span><em>{ar ? "جروب" : "Group Chat"}</em></button>
        ))}
        {(filter === "All" || filter === "Messages") && matchingSessions.map((session) => (
          <button type="button" className="hub-search-row" key={session.id} onClick={() => onSession(session)}><span className="hub-search-file-icon"><MessageSquareText size={20} /></span><span><strong>{session.title}</strong><small>{agents.find((agent) => agent.id === session.agentId)?.name || (groups.find((group) => group.coordinatorId === session.agentId)?.name ?? "")}</small></span><em>{ar ? "رسالة" : "Message"}</em></button>
        ))}
        {(filter === "Files" || filter === "Routines") && <ResourceList kind={filter === "Files" ? "files" : "routines"} query={query} />}
        {noResults && (filter === "All" || filter === "Messages" || filter === "Bots" || filter === "Group Chats") && <EmptySearch lang={lang} query={query} />}
      </div>
      <div className="hub-search-bottom">
        <Search size={19} />
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ar ? "دوّر في كل حاجة" : "Search everything"} aria-label={ar ? "دوّر في كل حاجة" : "Search everything"} />
        <HubIconButton label={ar ? "قفل البحث" : "Close search"} onClick={onClose}><X size={19} /></HubIconButton>
      </div>
    </section>
  );
}
