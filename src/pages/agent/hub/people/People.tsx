/** Person-to-person messaging inside the hub: username setup, chat list, new chat/group forms and the chat view. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ChevronLeft, LogOut, UserPlus, Bot, X, AtSign, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AgentInfo } from "@/lib/agentsky/client";
import { peopleApi, personLabel, myUserId, USERNAME_RE, normalizeUsername, type PersonInfo, type PeopleMessage, type ThreadSummary, type ThreadBot } from "@/lib/people/peopleApi";
import { BotAvatar, type HubLang } from "../HubParts";
import "@/styles/people.css";

function PersonAvatar({ person, size = 36 }: { person?: PersonInfo | null; size?: number }) {
  const label = personLabel(person);
  return <span className="pp-avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden>
    {person?.avatarUrl ? <img src={person.avatarUrl} alt="" /> : (label.replace("@", "")[0] || "?").toUpperCase()}
  </span>;
}

function botAgent(b: ThreadBot): Pick<AgentInfo, "name" | "color" | "isDefault"> & { id: string } {
  const colors = ["aurora", "ocean", "ember", "mint", "sun", "rose", "mono"];
  return { id: b.id, name: b.name, color: (colors.includes(b.look?.color) ? b.look?.color : "aurora") as AgentInfo["color"], isDefault: false };
}

/** Asks once for a username; renders children when one is set. */
export function UsernameGate({ lang, children }: { lang: HubLang; children: React.ReactNode }) {
  const ar = lang === "ar";
  const [username, setUsername] = useState<string | null | undefined>(undefined);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void peopleApi.myUsername().then(setUsername).catch(() => setUsername(null)); }, []);
  if (username === undefined) return null;
  if (username) return <>{children}</>;
  const save = async () => {
    setBusy(true); setError("");
    try { setUsername(await peopleApi.setUsername(value)); } catch (e) { setError(e instanceof Error ? e.message : "Could not save"); } finally { setBusy(false); }
  };
  return <section className="pp-panel">
    <h2>{ar ? "اختار اسم مستخدم" : "Choose your username"}</h2>
    <p className="pp-muted">{ar ? "صحابك وتيمك هيلاقوك بيه ويكلموك." : "Friends and teammates find and message you with it."}</p>
    <label className="pp-field"><AtSign size={16} /><input value={value} onChange={(e) => setValue(normalizeUsername(e.target.value))} placeholder="username" autoCapitalize="none" autoCorrect="off" maxLength={20} onKeyDown={(e) => { if (e.key === "Enter" && USERNAME_RE.test(value)) void save(); }} /></label>
    <small className="pp-muted">{ar ? "من 3 لـ 20 حرف إنجليزي صغير أو أرقام أو _" : "3–20 lowercase letters, numbers or _"}</small>
    {error && <p className="pp-error" role="alert">{error}</p>}
    <button type="button" className="pp-primary" disabled={busy || !USERNAME_RE.test(value)} onClick={() => void save()}>{ar ? "حفظ" : "Save"}</button>
  </section>;
}

/** People chats in the home list. */
export function PeopleSection({ lang, active, onOpen }: { lang: HubLang; active: string | null; onOpen: (id: string) => void }) {
  const ar = lang === "ar";
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [me, setMe] = useState("");
  useEffect(() => {
    let alive = true; let channel: ReturnType<typeof supabase.channel> | null = null;
    const load = () => peopleApi.threads().then((t) => { if (alive) setThreads(t); }).catch(() => {});
    void myUserId().then((id) => {
      if (!alive) return; setMe(id); void load();
      channel = supabase.channel(`people-list-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "people_messages" }, () => void load()).subscribe();
    }).catch(() => {});
    const onChange = () => void load();
    window.addEventListener("ceyo-people-changed", onChange);
    return () => { alive = false; window.removeEventListener("ceyo-people-changed", onChange); if (channel) void supabase.removeChannel(channel); };
  }, []);
  if (!threads.length) return null;
  return <section className="hub-category pp-section">
    <div className="hub-category-title"><span>{ar ? "الناس" : "People"}</span></div>
    <div className="hub-category-rows">
      {threads.map((t) => {
        const other = t.kind === "direct" ? t.members.find((m) => m.id !== me) : null;
        const title = t.kind === "group" ? t.name || (ar ? "جروب" : "Group") : personLabel(other);
        const unread = !!t.last && t.last.senderId !== me && t.last.createdAt > t.lastReadAt;
        return <div className="hub-list-row" key={t.id}>
          <button type="button" className="hub-list-row-main" data-unread={unread} data-active={active === t.id} onClick={() => onOpen(t.id)}>
            {t.kind === "group" ? <span className="pp-avatar pp-group-avatar">{(t.name || "G")[0].toUpperCase()}</span> : <PersonAvatar person={other} />}
            <span className="hub-row-copy"><span className="hub-row-title"><strong>{title}</strong></span><span className="hub-row-preview">{t.last?.content || (t.kind === "group" ? t.members.map(personLabel).join(" · ") : ar ? "ابدأ الكلام" : "Say hi")}</span></span>
          </button>
        </div>;
      })}
    </div>
  </section>;
}

function PeoplePicker({ lang, picked, onPick }: { lang: HubLang; picked: PersonInfo[]; onPick: (p: PersonInfo) => void }) {
  const ar = lang === "ar";
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PersonInfo[]>([]);
  useEffect(() => {
    const term = normalizeUsername(q);
    if (term.length < 2) { setResults([]); return; }
    const t = setTimeout(() => void peopleApi.search(term).then(setResults).catch(() => setResults([])), 220);
    return () => clearTimeout(t);
  }, [q]);
  return <div className="pp-picker">
    <label className="pp-field"><AtSign size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? "دوّر باسم المستخدم" : "Search by username"} autoCapitalize="none" autoCorrect="off" /></label>
    {results.length > 0 && <div className="pp-results">{results.map((p) => {
      const on = picked.some((x) => x.id === p.id);
      return <button type="button" key={p.id} className="pp-result" data-on={on} onClick={() => { onPick(p); setQ(""); }}><PersonAvatar person={p} size={32} /><span><strong>{p.displayName || p.username}</strong><small>@{p.username}</small></span>{on && <Check size={16} />}</button>;
    })}</div>}
    {normalizeUsername(q).length >= 2 && !results.length && <p className="pp-muted">{ar ? "مفيش حد بالاسم ده" : "No one with that username"}</p>}
  </div>;
}

export function NewPeopleChat({ lang, mode, agents, onCancel, onOpened }: { lang: HubLang; mode: "dm" | "group"; agents: AgentInfo[]; onCancel: () => void; onOpened: (id: string) => void }) {
  const ar = lang === "ar";
  const [picked, setPicked] = useState<PersonInfo[]>([]);
  const [bots, setBots] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = (p: PersonInfo) => setPicked((cur) => cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : mode === "dm" ? [p] : [...cur, p]);
  const submit = async () => {
    setBusy(true); setError("");
    try {
      const id = mode === "dm" ? await peopleApi.openDirect(picked[0].username || "") : await peopleApi.createGroup(name, picked.map((p) => p.username || ""), bots);
      window.dispatchEvent(new Event("ceyo-people-changed"));
      onOpened(id);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  };
  const ready = mode === "dm" ? picked.length === 1 : name.trim().length > 0 && picked.length + bots.length > 0;
  return <section className="pp-panel">
    <header className="pp-panel-head"><button type="button" className="pp-icon" aria-label="Back" onClick={onCancel}><ChevronLeft size={20} /></button><h2>{mode === "dm" ? (ar ? "رسالة جديدة" : "New message") : (ar ? "جروب مع ناس" : "New people group")}</h2></header>
    <UsernameGate lang={lang}>
      {mode === "group" && <label className="pp-field"><input value={name} onChange={(e) => setName(e.target.value)} placeholder={ar ? "اسم الجروب" : "Group name"} maxLength={80} /></label>}
      {picked.length > 0 && <div className="pp-chips">{picked.map((p) => <button type="button" key={p.id} className="pp-chip" onClick={() => toggle(p)}>@{p.username}<X size={14} /></button>)}</div>}
      <PeoplePicker lang={lang} picked={picked} onPick={toggle} />
      {mode === "group" && agents.length > 0 && <>
        <h3 className="pp-sub">{ar ? "ضيف بوتات" : "Add bots"}</h3>
        <div className="pp-results">{agents.map((a) => {
          const on = bots.includes(a.id);
          return <button type="button" key={a.id} className="pp-result" data-on={on} onClick={() => setBots((cur) => on ? cur.filter((x) => x !== a.id) : [...cur, a.id])}><BotAvatar agent={a} size={32} /><span><strong>{a.name}</strong><small>{a.description}</small></span>{on && <Check size={16} />}</button>;
        })}</div>
      </>}
      {error && <p className="pp-error" role="alert">{error}</p>}
      <button type="button" className="pp-primary" disabled={!ready || busy} onClick={() => void submit()}>{mode === "dm" ? (ar ? "ابدأ المحادثة" : "Start chat") : (ar ? "إنشاء الجروب" : "Create group")}</button>
    </UsernameGate>
  </section>;
}

export function PeopleChat({ lang, threadId, agents, onBack }: { lang: HubLang; threadId: string; agents: AgentInfo[]; onBack: () => void }) {
  const ar = lang === "ar";
  const [me, setMe] = useState("");
  const [thread, setThread] = useState<{ kind: "direct" | "group"; name: string | null } | null>(null);
  const [info, setInfo] = useState<{ members: PersonInfo[]; bots: ThreadBot[] }>({ members: [], bots: [] });
  const [messages, setMessages] = useState<PeopleMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"" | "people" | "bots">("");
  const scroller = useRef<HTMLDivElement>(null);

  const reloadInfo = () => peopleApi.info(threadId).then((i) => i && setInfo({ members: i.members || [], bots: i.bots || [] })).catch(() => {});
  useEffect(() => {
    let alive = true;
    void myUserId().then((id) => alive && setMe(id)).catch(() => {});
    void peopleApi.thread(threadId).then((t) => alive && setThread(t)).catch(() => {});
    void reloadInfo();
    void peopleApi.messages(threadId).then((m) => { if (alive) setMessages(m); }).catch((e) => setError(e.message));
    void peopleApi.markRead(threadId);
    const channel = supabase.channel(`people-thread-${threadId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "people_messages", filter: `thread_id=eq.${threadId}` }, (p: any) => {
        const m = p.new as PeopleMessage;
        setMessages((cur) => cur.some((x) => x.id === m.id) ? cur : [...cur, m]);
        void peopleApi.markRead(threadId);
      }).subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [threadId]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [messages.length]);

  const other = thread?.kind === "direct" ? info.members.find((m) => m.id !== me) : null;
  const title = thread?.kind === "group" ? thread.name || (ar ? "جروب" : "Group") : personLabel(other);
  const people = useMemo(() => new Map(info.members.map((m) => [m.id, m])), [info.members]);
  const bots = useMemo(() => new Map(info.bots.map((b) => [b.id, b])), [info.bots]);

  const send = async () => {
    const content = text.trim();
    if (!content) return;
    setText(""); setError("");
    try {
      const m = await peopleApi.send(threadId, content);
      setMessages((cur) => cur.some((x) => x.id === m.id) ? cur : [...cur, m]);
      if (info.bots.length && content.includes("@")) void peopleApi.askBots(threadId, m.id);
    } catch (e) { setText(content); setError(e instanceof Error ? e.message : "Not sent"); }
  };

  return <section className="pp-chat">
    <header className="pp-chat-head">
      <button type="button" className="pp-icon" aria-label="Back" onClick={onBack}><ChevronLeft size={20} /></button>
      {thread?.kind === "group" ? <span className="pp-avatar pp-group-avatar">{(thread.name || "G")[0].toUpperCase()}</span> : <PersonAvatar person={other} size={32} />}
      <span className="pp-chat-title"><strong>{title}</strong><small>{thread?.kind === "group" ? `${info.members.length} ${ar ? "أشخاص" : "people"}${info.bots.length ? ` · ${info.bots.length} ${ar ? "بوت" : "bots"}` : ""}` : other?.username ? `@${other.username}` : ""}</small></span>
      {thread?.kind === "group" && <>
        <button type="button" className="pp-icon" aria-label={ar ? "ضيف شخص" : "Add person"} onClick={() => setPanel(panel === "people" ? "" : "people")}><UserPlus size={18} /></button>
        <button type="button" className="pp-icon" aria-label={ar ? "ضيف بوت" : "Add bot"} onClick={() => setPanel(panel === "bots" ? "" : "bots")}><Bot size={18} /></button>
      </>}
      <button type="button" className="pp-icon" aria-label={ar ? "خروج" : "Leave"} onClick={() => { void peopleApi.leave(threadId).then(() => { window.dispatchEvent(new Event("ceyo-people-changed")); onBack(); }); }}><LogOut size={18} /></button>
    </header>
    {panel === "people" && <div className="pp-drawer"><PeoplePicker lang={lang} picked={info.members} onPick={(p) => { void peopleApi.addMember(threadId, p.username || "").then(reloadInfo).catch((e) => setError(e.message)); }} /></div>}
    {panel === "bots" && <div className="pp-drawer pp-results">{agents.map((a) => {
      const on = info.bots.some((b) => b.id === a.id);
      return <button type="button" key={a.id} className="pp-result" data-on={on} disabled={on} onClick={() => { void peopleApi.addBot(threadId, a.id).then(reloadInfo).catch((e) => setError(e.message)); }}><BotAvatar agent={a} size={30} /><span><strong>{a.name}</strong></span>{on && <Check size={16} />}</button>;
    })}</div>}
    <div className="pp-messages" ref={scroller}>
      {messages.map((m) => {
        const mine = m.sender_id === me;
        const bot = m.bot_id ? bots.get(m.bot_id) : null;
        const person = m.sender_id ? people.get(m.sender_id) : null;
        return <div key={m.id} className="pp-msg" data-mine={mine} data-bot={!!bot}>
          {!mine && thread?.kind === "group" && (bot ? <BotAvatar agent={botAgent(bot)} size={26} /> : <PersonAvatar person={person} size={26} />)}
          <div className="pp-bubble" dir="auto">
            {!mine && thread?.kind === "group" && <span className="pp-sender">{bot ? bot.name : personLabel(person)}</span>}
            {m.content}
          </div>
        </div>;
      })}
      {!messages.length && <p className="pp-muted pp-empty">{info.bots.length ? (ar ? "اكتب @ واسم البوت عشان يرد" : "Type @ and a bot's name to ask it") : ar ? "ابدأ الكلام" : "Say hi"}</p>}
    </div>
    {error && <p className="pp-error" role="alert">{error}</p>}
    <div className="pp-composer">
      {info.bots.length > 0 && text.endsWith("@") && <div className="pp-mentions">{info.bots.map((b) => <button type="button" key={b.id} onClick={() => setText(`${text}${b.name} `)}>@{b.name}</button>)}</div>}
      <textarea rows={1} dir="auto" value={text} placeholder={ar ? "اكتب رسالة" : "Message"} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
      <button type="button" className="pp-send" aria-label="Send" disabled={!text.trim()} onClick={() => void send()}><ArrowUp size={18} /></button>
    </div>
  </section>;
}
