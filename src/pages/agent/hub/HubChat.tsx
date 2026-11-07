import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  Copy,
  Flag,
  Loader2,
  MessageSquareDot,
  MoreHorizontal,
  Plus,
  Paperclip,
  Camera,
  ImageIcon,
  Reply,
  Search,
  SmilePlus,
  Square,
  TextCursor,
  Trash2,
  UserRound,
  X,
  CircleAlert,
  Mic,
  AudioLines,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { agentApi, type AgentInfo, type SessionInfo } from "@/lib/agentsky/client";
import { refreshSessions, workspace } from "@/lib/agentsky/store";
import { useAgentSession } from "@/hooks/useAgentSession";
import { MediaCard, PlanCard, TaskCard, VideoProposalCard } from "@/components/agent/Cards";
import { VoiceCallBar } from "./VoiceCall";
import { VoiceMessage } from "./VoiceControls";
import { FilePreview, AttachmentPreview } from "./FilePreview";
import { MediaCreator } from "./MediaCreator";
import "@/styles/chat-previews.css";
import { prefersVoiceReply, type AgentVoiceSettings, type RecordingOrigin } from "@/lib/audio/agentVoice";
import { cacheRecording } from "@/lib/audio/recordingCache";
import { microphoneRecording, transcribeRecording, unlockCallAudio } from "@/lib/audio/voiceClient";
import { ChoiceCard, ConnectAppsCard, SecretCard, readConnectApps } from "./HubCards";
import { AgentProposalCard } from "@/components/agent/AgentProposalCard";
import { orbStateFor, type AgentTurn } from "@/lib/agentsky/transcript";
import { groupTranscript, type AgentGroup } from "./hubStorage";
import { BotAvatar, HubSpinner, type HubLang } from "./HubParts";
import { readReactions, writeReactions, REACTIONS } from "./chatPrefs";
import { IntegrationApprovalCard } from "@/components/agent/IntegrationApprovalCard";
import { readTextAttachment } from "@/lib/ceyo/content";
import { saveDocument } from "@/lib/ceyo/resources";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Bubble = {
  key: string;
  turnId: string;
  role: "user" | "agent";
  text: string;
  at?: string;
  speaker?: AgentInfo;
  turn: any;
  partIndex: number;
  lastPart: boolean;
  turnIndex: number;
};

function fmtTime(at?: string) {
  if (!at) return "";
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Highlight({ text, q }: { text: string; q: string }): ReactNode {
  if (!q) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return parts.map((p, i) => (p.toLowerCase() === q.toLowerCase() ? <mark key={i}>{p}</mark> : p));
}

function Composer({
  lang,
  placeholder,
  running,
  stopping,
  queue,
  replyTo,
  onCancelReply,
  onSend,
  onStop,
  onUnqueue,
  onNew,
  onConnect,
  members = [], onCall,
}: {
  lang: HubLang;
  placeholder: string;
  running: boolean;
  stopping: boolean;
  queue: { id: string; text: string }[];
  replyTo: string | null;
  onCancelReply: () => void;
  onSend: (text: string, origin?: RecordingOrigin) => void;
  onStop: () => void;
  onUnqueue: (id: string) => void;
  onNew: () => void;
  onConnect: () => void;
  onCall?: () => void;
  members?: AgentInfo[];
}) {
  const [text, setText] = useState("");
  const [plusOpen, setPlusOpen] = useState(false);
  const [mediaCreator, setMediaCreator] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null);
  const camIn = useRef<HTMLInputElement>(null);
  const mediaIn = useRef<HTMLInputElement>(null);
  const addFiles = (list: FileList | null) => { if (list?.length) setFiles((c) => [...c, ...Array.from(list)].slice(0, 6)); };
  const [listening, setListening] = useState(false);
  const recognition = useRef<{ stop: () => void } | null>(null);
  const recordingAlive = useRef(true);
  const recordingStarting = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const ar = lang === "ar";

  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);
  useEffect(() => { if (replyTo) textarea.current?.focus(); }, [replyTo]);
  useEffect(() => { recordingAlive.current = true; return () => { recordingAlive.current = false; recognition.current?.stop(); }; }, []);

  const submit = async () => {
    const typed = text.trim();
    if (uploading || (!typed && !files.length)) return;
    setUploading(true);
    try {
      const documents = await Promise.all(files.map(readTextAttachment));
      const refs: string[] = [];
      for (const doc of documents) {
        const saved = await saveDocument(doc);
        refs.push(`Attached document: ${doc.name}; read_file id=${saved.id}. Read its actual contents before answering.`);
      }
      const value = [typed, ...refs].filter(Boolean).join("\n\n");
      onSend(replyTo ? `> ${replyTo.slice(0, 200).replace(/\n/g, " ")}\n\n${value}` : value);
      setText(""); setFiles([]); onCancelReply();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not send files"); }
    finally { setUploading(false); }
  };

  const listen = async () => {
    if (listening) { recognition.current?.stop(); return; }
    if (recordingStarting.current) return;
    recordingStarting.current = true;
    try {
      const recording = await microphoneRecording();
      if (!recordingAlive.current) { recording.stop(); return; }
      recognition.current = recording; setListening(true);
      const blob = await recording.result;
      if (!recordingAlive.current) return;
      setListening(false); setUploading(true);
      const words = await transcribeRecording(blob, ar ? "ar" : "en");
      if (recordingAlive.current) {
        const recordingId = crypto.randomUUID();
        await cacheRecording(recordingId, blob).catch(() => {});
        onSend(words, { voiceOrigin: "recording", recordingId });
      }
    } catch (error) { if (recordingAlive.current) toast.error(error instanceof Error ? error.message : "Recording unavailable"); }
    finally { recordingStarting.current = false; if (recordingAlive.current) { setListening(false); setUploading(false); } }
  };

  const mentionQuery = members.length ? /(?:^|\s)@([^\s@]*)$/.exec(text)?.[1] : undefined;
  const mentionMatches = mentionQuery === undefined ? [] : members.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6);
  const pickMention = (m: AgentInfo) => { setText((t) => t.replace(/@([^\s@]*)$/, `@${m.name} `)); textarea.current?.focus(); };

  return (
    <div className="cx-composer-wrap">
      {mentionMatches.length > 0 && <div className="cx-mentions" role="listbox">{mentionMatches.map((m) => <button type="button" role="option" key={m.id} onPointerDown={(e) => { e.preventDefault(); pickMention(m); }}><BotAvatar agent={m} size={26} /><span>{m.name}</span></button>)}</div>}
      {queue.map((q) => (
        <div className="cx-queued" key={q.id}>
          <Clock size={14} /><span>{q.text}</span>
          <button type="button" onClick={() => onUnqueue(q.id)} aria-label="Remove"><X size={14} /></button>
        </div>
      ))}
      {replyTo && (
        <div className="cx-reply-chip"><Reply size={14} /><span dir="auto">{replyTo}</span><button type="button" aria-label="Cancel reply" onClick={onCancelReply}><X size={14} /></button></div>
      )}
      {mediaCreator && <MediaCreator ar={ar} onClose={() => setMediaCreator(false)} />}
      {files.map((file, i) => <AttachmentPreview key={`preview-${i}`} file={file} />)}
      {files.length > 0 && (
        <div className="cx-files">{files.map((f, i) => <span key={`${f.name}-${i}`} className="cx-file-chip"><Paperclip size={13} /><span>{f.name}</span><button type="button" aria-label="Remove file" onClick={() => setFiles((c) => c.filter((_, j) => j !== i))}><X size={13} /></button></span>)}</div>
      )}
      <input ref={fileIn} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      <input ref={camIn} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.target.files)} />
      <input ref={mediaIn} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      {plusOpen && <div className="cx-scrim" onPointerDown={() => setPlusOpen(false)} />}
      <div className="cx-composer" data-listening={listening}>
        <div className="cx-plus-wrap">
          <button type="button" className="cx-circle" aria-label="More" onClick={() => setPlusOpen((o) => !o)}><Plus size={20} /></button>
          {plusOpen && (
            <div className="cx-pop cx-pop-up" role="menu">
              <button type="button" onClick={() => { fileIn.current?.click(); setPlusOpen(false); }}><Paperclip size={18} />{ar ? "اختيار ملف" : "Choose File"}</button>
              <button type="button" onClick={() => { camIn.current?.click(); setPlusOpen(false); }}><Camera size={18} />{ar ? "التقاط صورة" : "Take Photo"}</button>
              <button type="button" onClick={() => { mediaIn.current?.click(); setPlusOpen(false); }}><ImageIcon size={18} />{ar ? "صورة أو فيديو" : "Photo or Video"}</button>
              <Button variant="ghost" role="menuitem" onClick={() => { setMediaCreator(true); setPlusOpen(false); }}><ImageIcon size={18} />{ar ? "إنشاء صور وفيديو" : "Create media"}</Button>
            </div>
          )}
        </div>
        {listening && <div className="cx-rec" aria-hidden><span className="cx-rec-dot" />{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 6) * 0.11}s` }} />)}</div>}
        <textarea
          ref={textarea}
          rows={1}
          value={text}
          dir="auto"
          aria-label={placeholder}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (mentionMatches.length && (e.key === "Enter" || e.key === "Tab")) { e.preventDefault(); pickMention(mentionMatches[0]); return; }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
          }}
        />
        {text.trim() || files.length ? (
          <Button variant="ghost" size="icon" type="button" className="cx-circle cx-send" aria-label="Send" disabled={uploading} onClick={() => void submit()}><ArrowUp size={18} /></Button>
        ) : (
          <>
            <button type="button" className="cx-circle cx-mic" data-active={listening} aria-label="Voice" onClick={listen}><Mic size={18} /></button>
            {onCall && !listening && <button type="button" className="cx-circle cx-send" aria-label={ar ? "مكالمة صوتية" : "Voice call"} onClick={onCall}><AudioLines size={18} /></button>}
          </>
        )}
      </div>
    </div>
  );
}

export function HubChat({
  lang,
  voiceSettings,
  voicePreferences,
  agent,
  group,
  agents,
  sessions,
  sessionId,
  tier,
  models,
  demo = false,
  onSession,
  onBack,
  onProfile,
  onHide,
  onDelete,
  onMarkUnread,
}: {
  lang: HubLang;
  voiceSettings: AgentVoiceSettings;
  voicePreferences: Record<string, AgentVoiceSettings>;
  agent: AgentInfo;
  group?: AgentGroup;
  agents: AgentInfo[];
  sessions: SessionInfo[];
  sessionId: string | null;
  tier: "free" | "pro";
  models: Parameters<typeof VideoProposalCard>[0]["models"];
  demo?: boolean;
  onSession: (id: string | null) => void;
  onBack: () => void;
  onProfile: () => void;
  onHide: () => void;
  onDelete?: () => void;
  onMarkUnread?: () => void;
}) {
  void sessions; void onHide;
  const nav = useNavigate();
  const [starting, setStarting] = useState(false);
  const [firstMessage, setFirstMessage] = useState<{ id: string; text: string; at: string; sessionId: string | null; voiceOrigin?: "recording"; recordingId?: string } | null>(null);
  const [toast, setToast] = useState<{ title: string; body?: string; tone?: "error" } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIdx, setFindIdx] = useState(0);
  const [pinned, setPinned] = useState(true);
  const [sheet, setSheet] = useState<Bubble | null>(null);
  const [calling, setCalling] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [selectable, setSelectable] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [swipe, setSwipe] = useState(0);
  const swipeStart = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const press = useRef<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const s = useAgentSession(demo ? null : sessionId, lang);
  const ar = lang === "ar";
  const title = group?.name || agent.name;

  useEffect(() => { setReactions(readReactions()); }, []);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 3200); return () => window.clearTimeout(t); }, [toast]);

  const lastAgent = useMemo(() => [...s.turns].reverse().find((t) => t.type === "agent") as AgentTurn | undefined, [s.turns]);
  const orb = orbStateFor(lastAgent, s.running);

  useEffect(() => { setMenuOpen(false); setFindOpen(false); setFindQuery(""); setSheet(null); setReplyTo(null); }, [agent.id, sessionId]);
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  useLayoutEffect(() => { const el = scroller.current; if (el && pinned) el.scrollTop = el.scrollHeight; }, [s.turns, s.queue, pinned]);
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { if (pinnedRef.current) el.scrollTop = el.scrollHeight; });
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  });
  useEffect(() => { if (!demo && !s.running) void refreshSessions(); }, [s.running, demo]);
  useEffect(() => {
    // Refresh once when returning to the tab instead of polling every few seconds.
    if (demo || !sessionId || s.running) return;
    const onVisible = () => { if (document.visibilityState === "visible") window.dispatchEvent(new Event("ceyo-action-completed")); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [demo, sessionId, s.running]);
  useEffect(() => {
    const err = lastAgent?.error || s.error;
    if (err) setToast({ title: ar ? "الوكيل مقدرش يرد" : "No reply received", body: err, tone: "error" });
  }, [lastAgent?.error, s.error, ar]);

  const startConversation = async (text: string, origin: RecordingOrigin = {}) => {
    if (demo) return;
    const messageId = crypto.randomUUID();
    setFirstMessage({ id: messageId, text, at: new Date().toISOString(), sessionId: null, ...origin });
    setStarting(true);
    try {
      const result = await agentApi.createSession({ agentId: agent.id, text, messageId, origin });
      workspace.upsertSession(result.session);
      setFirstMessage((pending) => pending ? { ...pending, sessionId: result.session.id } : null);
      onSession(result.session.id);
    } catch (error) {
      setFirstMessage(null);
      setToast({ title: ar ? "المحادثة مبدأتش" : "Could not start chat", body: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setStarting(false);
    }
  };

  // Flatten turns into bubbles (group replies split per speaker).
  const bubbles = useMemo<Bubble[]>(() => {
    const out: Bubble[] = [];
    let lastAt: string | undefined;
    const now = new Date().toISOString();
    const source: any[] = demo ? [
      { id: "d1", type: "user", text: ar ? "عايزكم تجهزوا خطة الأسبوع" : "Plan this week for me", images: [], at: now },
      ...(group ? [{ id: "d2", type: "agent", text: group.memberIds.slice(0, 2).map((id) => `[[speaker: ${agents.find((a) => a.id === id)?.name}]] @${agents.find((a) => a.id === group.memberIds[0])?.name} ${ar ? "تمام، هبدأ دلوقتي." : "On it."}`).join("\n\n"), steps: [], cards: [] }] : [{ id: "d2", type: "agent", text: ar ? "أكيد، هقسمها لثلاث خطوات." : "Sure, three steps.", steps: [], cards: [] }]),
    ] : [...s.turns];
    if (!demo && firstMessage && (!firstMessage.sessionId || firstMessage.sessionId === sessionId) && !source.some((turn) => turn.type === "user" && turn.text === firstMessage.text)) {
      source.unshift({ ...firstMessage, type: "user", images: [] });
    }
    source.forEach((turn: any, turnIndex) => {
      if (turn.type === "user") {
        lastAt = turn.at || lastAt;
        out.push({ key: turn.id, turnId: turn.id, role: "user", text: turn.text, at: turn.at, turn, partIndex: 0, lastPart: true, turnIndex });
        return;
      }
      const parsed = group ? groupTranscript(turn.text || "") : [{ speaker: "", text: turn.text || "" }];
      const parts = parsed.length ? parsed : [{ speaker: "", text: "" }];
      parts.forEach((part, partIndex) => {
        const speaker = group && part.speaker ? agents.find((a) => group.memberIds.includes(a.id) && a.name === part.speaker) : undefined;
        out.push({ key: `${turn.id}-${partIndex}`, turnId: turn.id, role: "agent", text: part.text, at: lastAt, speaker: speaker || agent, turn, partIndex, lastPart: partIndex === parts.length - 1, turnIndex });
      });
    });
    return out;
  }, [s.turns, group, agents, agent, demo, ar, firstMessage, sessionId]);

  const q = findQuery.trim();
  const matches = useMemo(() => (q ? bubbles.filter((b) => b.text.toLowerCase().includes(q.toLowerCase())).map((b) => b.key) : []), [bubbles, q]);
  useEffect(() => { setFindIdx(matches.length ? matches.length - 1 : 0); }, [q, matches.length]);
  useEffect(() => {
    const key = matches[findIdx];
    if (key) document.getElementById(`cx-${key}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [findIdx, matches]);

  // One loader for the whole reply: it stays mounted across brief idle gaps and only its text/avatar change.
  const rawBusy = s.running || starting;
  const [busy, setBusy] = useState(rawBusy);
  useEffect(() => {
    setBusy(rawBusy);
  }, [rawBusy]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!busy) { setTick(0); return; }
    const t = window.setInterval(() => setTick((n) => n + 1), 1800);
    return () => window.clearInterval(t);
  }, [busy]);
  const lastActivity = useRef<{ bot: AgentInfo; state: "thinking" | "tool" | "talking" } | null>(null);
  // Who is busy right now and what they are doing (thinking / using a tool / writing).
  const activity = useMemo(() => {
    if (!busy) return [] as { bot: AgentInfo; state: "thinking" | "tool" | "talking" }[];
    if (!s.running && !starting) return [] as { bot: AgentInfo; state: "thinking" | "tool" | "talking" }[];
    const live = s.running && lastAgent && s.turns[s.turns.length - 1] === lastAgent ? lastAgent : undefined;
    const st: "thinking" | "tool" | "talking" = orb === "tool" ? "tool" : orb === "talking" ? "talking" : "thinking";
    if (!group) return [{ bot: agent, state: (live ? st : "thinking") as "thinking" | "tool" | "talking" }];
    const coord = agents.find((a) => a.id === group.coordinatorId) || agent;
    const parts = live ? groupTranscript(live.text || "") : [];
    const last = parts[parts.length - 1]?.speaker;
    const speaker = last ? agents.find((a) => group.memberIds.includes(a.id) && a.name === last) : undefined;
    if (!speaker) return [{ bot: coord, state: (live ? st : "thinking") as "thinking" | "tool" | "talking" }];
    return [{ bot: speaker, state: st }];
  }, [busy, s.running, starting, s.turns, lastAgent, orb, group, agents, agent]);
  useEffect(() => { lastActivity.current = activity[0] || null; }, [activity]);

  const startPress = (b: Bubble) => {
    if (press.current) window.clearTimeout(press.current);
    press.current = window.setTimeout(() => { setSheet(b); navigator.vibrate?.(8); }, 430);
  };
  const cancelPress = () => { if (press.current) { window.clearTimeout(press.current); press.current = null; } };

  const react = (key: string, emoji: string) => {
    setReactions((cur) => {
      const next = { ...cur };
      if (next[key] === emoji) delete next[key]; else next[key] = emoji;
      writeReactions(next);
      return next;
    });
    setSheet(null);
  };
  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); setToast({ title: label }); } catch { setToast({ title: ar ? "النسخ مش متاح" : "Copy unavailable", tone: "error" }); }
    setSheet(null);
  };

  const placeholder = group ? (ar ? "اسأل فريقك…" : "Ask your team…") : ar ? `رسالة لـ ${title}` : `Message ${title}`;
  const empty = bubbles.length === 0;

  return (
    <section className="cx-chat" aria-label={`${title} conversation`}>
      <header className="cx-head">
        <button type="button" className="cx-circle cx-glass" aria-label={ar ? "رجوع" : "Back"} onClick={onBack}><ChevronLeft size={22} /></button>
        <button type="button" className="cx-title-pill cx-glass" onClick={onProfile}>
          {group ? <span className="cx-stack">{group.memberIds.slice(0, 4).flatMap((id) => { const member = agents.find((a) => a.id === id); return member ? [<BotAvatar key={member.id} agent={member} size={22} />] : []; })}</span> : <BotAvatar agent={agent} size={24} state="idle" />}
          <strong dir="auto">{title}</strong>
        </button>
        <button type="button" className="cx-circle cx-glass cx-more" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}><MoreHorizontal size={20} /></button>
        {menuOpen && <div className="cx-scrim" onPointerDown={() => setMenuOpen(false)} />}
        {menuOpen && (
          <div className="cx-pop cx-pop-down" role="menu">
            <button type="button" onClick={() => { setMenuOpen(false); onProfile(); }}><UserRound size={19} />{ar ? "عرض البروفايل" : "View Profile"}</button>
            <button type="button" onClick={() => { setMenuOpen(false); setFindOpen(true); }}><Search size={19} />{ar ? "دوّر في الشات" : "Find in Chat"}</button>
            {onDelete && <button type="button" data-danger="true" onClick={() => { setMenuOpen(false); onDelete(); }}><Trash2 size={19} />{ar ? "حذف" : "Delete"}</button>}
          </div>
        )}
      </header>
      {calling && !group && agent && (
        <VoiceCallBar
          agent={agent}
          settings={voiceSettings}
          agentIds={agents.map((a) => a.id)}
          lang={lang}
          busy={s.running || starting}
          replyError={s.error || lastAgent?.error}
          replyId={lastAgent?.id}
          lastReply={lastAgent?.text || ""}
          onSay={(text) => { setPinned(true); if (!sessionId && !demo) void startConversation(text); else s.send(text); }}
          onEnd={() => setCalling(false)}
        />
      )}

      {toast && (
        <div className="cx-toast" data-tone={toast.tone} role="status">
          {toast.tone === "error" && <CircleAlert size={18} />}
          <span><strong>{toast.title}</strong>{toast.body && <small>{toast.body}</small>}</span>
        </div>
      )}
      {s.error && <div className="cx-chat-error" role="alert"><CircleAlert size={18} /><span>{s.error}</span></div>}

      <div
        className="cx-scroll"
        ref={scroller}
        onScroll={(e) => { const el = e.currentTarget; setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 120); }}
        onPointerDown={(e) => { swipeStart.current = { x: e.clientX, y: e.clientY, active: false }; }}
        onPointerMove={(e) => {
          const st = swipeStart.current; if (!st) return;
          const dx = e.clientX - st.x, dy = e.clientY - st.y;
          if (!st.active && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.5) { st.active = true; cancelPress(); }
          if (st.active) setSwipe(Math.max(-90, Math.min(0, ar ? -dx : dx)));
        }}
        onPointerUp={() => { swipeStart.current = null; setSwipe(0); }}
        onPointerCancel={() => { swipeStart.current = null; setSwipe(0); }}
      >
        {empty && !s.running && !starting ? (
          <div className="cx-empty">{(s.loading || starting) && <HubSpinner label={ar ? "لحظة…" : "One moment…"} />}</div>
        ) : (
          <div className="cx-column" style={{ transform: swipe ? `translateX(${ar ? -swipe : swipe}px)` : undefined, transition: swipe ? "none" : undefined }}>
            {s.loading && !bubbles.length && <HubSpinner label={ar ? "بنحمّل الرسائل…" : "Loading messages…"} />}
            {bubbles.map((b, i) => {
              const prev = bubbles[i - 1];
              const showDay = b.at && (!prev?.at || new Date(prev.at).toDateString() !== new Date(b.at).toDateString() || (new Date(b.at).getTime() - new Date(prev.at).getTime()) > 3600_000);
              const hit = matches[findIdx] === b.key;
              const handlers = {
                onPointerDown: () => startPress(b),
                onPointerUp: cancelPress,
                onPointerLeave: cancelPress,
                onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); cancelPress(); setSheet(b); },
              };
              const input = bubbles.slice(0, i).reverse().find((item) => item.role === "user");
              const voiceReply = b.role === "agent" && prefersVoiceReply(input?.turn.voiceOrigin, b.text) && !b.turn.running && !b.turn.error && !b.turn.stopped;
              const speaker = b.speaker || agent;
              const settings = speaker.voiceSettings || voicePreferences[speaker.id] || voiceSettings;
              const reaction = reactions[b.key];
              const time = fmtTime(b.at);
              return (
                <div key={b.key} id={`cx-${b.key}`} className="cx-row-wrap">
                  {showDay && <p className="cx-day">{new Date(b.at || "").toDateString() === new Date().toDateString() ? (ar ? "النهارده " : "Today ") : ""}{time}</p>}
                  {b.role === "user" ? (
                    <div className="cx-row cx-row-user">
                      <div className="cx-bubble cx-bubble-user" data-hit={hit} data-select={selectable === b.key} dir="auto" {...handlers}>
                        {b.turn.voiceOrigin === "recording" && b.turn.recordingId ? <VoiceMessage own text={b.text} recordingId={b.turn.recordingId} agentId={agent.id} agentIds={agents.map((a) => a.id)} settings={voiceSettings} ar={ar} /> : b.text.startsWith("> ") ? (() => { const [quote, ...rest] = b.text.split("\n\n"); return <><span className="cx-quote">{quote.slice(2)}</span><Highlight text={rest.join("\n\n")} q={q} /></>; })() : <Highlight text={b.text} q={q} />}
                        {reaction && <em className="cx-reaction">{reaction}</em>}
                      </div>
                      <span className="cx-time">{time}</span>
                    </div>
                  ) : !b.text && !(b.lastPart && b.turn.cards?.length) ? null : (
                    <div className="cx-row cx-row-agent">
                      <div className="cx-avatar"><BotAvatar agent={b.speaker || agent} size={22} state="idle" /></div>
                      <div className="cx-agent-body">
                        {(group || b.partIndex === 0) && <span className="cx-author" dir="auto">{b.speaker?.name || title}</span>}
                        {b.lastPart && b.turn.cards?.filter((c: any) => c.kind === "plan").map((c: any) => <PlanCard key={c.id} title={c.title} steps={c.steps} lang={lang} />)}
                        {voiceReply && input ? <VoiceMessage text={b.text} recordingId={`${input.turn.recordingId || input.turnId}:${b.partIndex}`} agentId={speaker.id} agentIds={agents.map((a) => a.id)} settings={settings} ar={ar} /> : b.text && (
                          <div className="cx-bubble cx-bubble-agent" data-hit={hit} data-select={selectable === b.key} dir="auto" {...handlers}>
                            {q ? <p><Highlight text={b.text} q={q} /></p> : (
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
                                p: ({ children }) => <p>{mentionify(children, group, agents)}</p>,
                                li: ({ children }) => <li>{mentionify(children, group, agents)}</li>,
                              }}>{b.text}</ReactMarkdown>
                            )}
                            {reaction && <em className="cx-reaction">{reaction}</em>}
                          </div>
                        )}
                        {b.lastPart && b.turn.cards?.map((card: any) => {
                          if (card.kind === "agent-proposal") return <AgentProposalCard key={card.id} proposal={card.proposal} />;
                          if (card.kind === "media") return <MediaCard key={card.id} media={card.media} lang={lang} />;
                          if (card.kind === "file") return <FilePreview key={card.id} id={card.id} name={card.name} content={card.content} />;
                          if (card.kind === "video") return <VideoProposalCard key={card.id} proposal={card.proposal} models={models} tier={tier} lang={lang} onUpgrade={() => nav("/pricing")} />;
                          if (card.kind === "question") return <ChoiceCard key={card.id} question={card.question} options={card.options} allowFreeText={card.allowFreeText} answered={card.answered} ar={ar} onAnswer={(v) => s.send(v)} />;
                          if (card.kind === "widget") {
                            const d = (card.data || {}) as Record<string, any>;
                            if (card.name === "connect_app") return <ConnectAppsCard key={card.id} apps={readConnectApps(d)} title={d.title || d.question} ar={ar} onAuthorize={(app) => nav(`/settings/apps/${encodeURIComponent(app.id || app.name.toLowerCase())}`)} />;
                            if (card.name === "integration_approval") return <IntegrationApprovalCard key={card.id} data={d} onDone={() => window.dispatchEvent(new Event("ceyo-action-completed"))} />;
                            if (card.name === "secret" || card.name === "api_key") return <SecretCard key={card.id} name={String(d.name || d.title || "API key")} ar={ar} onOpen={() => nav("/settings/vault")} />;
                            if (card.name === "question" || card.name === "option_picker") {
                              const opts = (Array.isArray(d.options) ? d.options : Array.isArray(d.choices) ? d.choices : []).map((o: any) => typeof o === "string" ? o : String(o?.label ?? o?.name ?? o?.title ?? "")).filter(Boolean);
                              return <ChoiceCard key={card.id} question={d.question || d.title} options={opts} allowFreeText={d.allow_free_text !== false} ar={ar} onAnswer={(v) => s.send(v)} />;
                            }
                          }
                          if (card.kind === "task") return <TaskCard key={card.id} title={card.title} dueAt={card.dueAt} lang={lang} onOpen={() => nav("/agents")} />;
                          return null;
                        })}
                      </div>
                      <span className="cx-time">{time}</span>
                    </div>
                  )}
                </div>
              );
            })}
            {!demo && s.requests.map((r) => (
              r.kind === "connect_app"
                ? <ConnectAppsCard key={r.id} title={r.question} apps={readConnectApps({ apps: r.options?.length ? r.options.map((o) => ({ id: o.id, name: o.label, description: o.description })) : [r.subject || r.question] })} ar={ar} onAuthorize={() => nav("/settings/apps")} />
                : <ChoiceCard key={r.id} question={r.question} options={r.options?.length ? r.options.map((o) => o.label) : r.kind === "approval" ? [ar ? "موافق" : "Approve", ar ? "لأ" : "Don't"] : []} allowFreeText={r.allow_free_text || r.kind === "question"} ar={ar} onAnswer={(v) => { s.setRequests((rs) => rs.filter((x) => x.id !== r.id)); s.send(v); }} />
            ))}
            {activity.slice(0, 1).map(({ bot, state }) => {
              const pool = state === "tool"
                ? (ar ? ["شغال على الطلب", "بجهّز الأدوات", "بنفّذ الخطوة", "قربت أخلص"] : ["Working on it", "Getting things ready", "Running the step", "Almost there"])
                : state === "talking"
                ? (ar ? ["بيكتب", "بيرتب الرد", "بيكمل الكتابة"] : ["Writing", "Shaping the reply", "Still writing"])
                : (ar ? ["بيفكر في الموضوع", "بيحلل طلبك", "بيرتب أفكاره", "لحظة كمان"] : ["Thinking it through", "Reading your request", "Organizing ideas", "One more moment"]);
              const label = pool[tick % pool.length];
              const others = group ? Math.max(0, group.memberIds.filter((id) => id !== bot.id).length) : 0;
              return (
                <div className="cx-working" key="working">
                  <BotAvatar agent={bot} size={30} state={state} />
                  <span dir="auto" className="cx-working-text">
                    {group && <b>{bot.name}{others > 0 && <span className="cx-working-others"> +{others} {ar ? "آخرون" : "others"}</span>} </b>}
                    <span key={label} className="cx-shimmer cx-label-swap">{label}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {!pinned && !empty && (
          <button type="button" className="cx-circle cx-glass cx-latest" aria-label="Scroll to latest" onClick={() => { setPinned(true); scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }}><ChevronDown size={20} /></button>
        )}
      </div>

      {findOpen ? (
        <div className="cx-find">
          <label className="cx-find-input"><Search size={18} /><input autoFocus value={findQuery} onChange={(e) => setFindQuery(e.target.value)} placeholder={ar ? "دوّر في الشات" : "Find in chat"} />{q && <small>{matches.length ? findIdx + 1 : 0}/{matches.length}</small>}</label>
          <button type="button" className="cx-circle cx-glass cx-lg" aria-label="Previous" disabled={!matches.length} onClick={() => setFindIdx((i) => Math.max(0, i - 1))}><ChevronUp size={20} /></button>
          <button type="button" className="cx-circle cx-glass cx-lg" aria-label="Next" disabled={!matches.length} onClick={() => setFindIdx((i) => Math.min(matches.length - 1, i + 1))}><ChevronDown size={20} /></button>
          <button type="button" className="cx-done cx-glass" onClick={() => { setFindOpen(false); setFindQuery(""); }}>{ar ? "تم" : "Done"}</button>
        </div>
      ) : (
        <Composer
          lang={lang}
          placeholder={placeholder}
          running={s.running || starting}
          stopping={s.stopping}
          queue={s.queue}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSend={(text, origin) => { setPinned(true); setSelectable(null); if (!sessionId && !demo) void startConversation(text, origin); else s.send(text, [], origin); }}
          onStop={s.stop}
          onUnqueue={s.unqueue}
          onNew={() => onSession(null)}
          onConnect={() => nav("/settings/apps")}
          onCall={group ? undefined : () => { unlockCallAudio(); setCalling(true); }}
          members={group ? agents.filter((a) => group.memberIds.includes(a.id)) : undefined}
        />
      )}

      {sheet && (
        <>
          <div className="cx-sheet-scrim" onPointerDown={() => setSheet(null)} />
          <div className="cx-sheet" role="dialog" aria-label="Message options">
            <span className="cx-grip" />
            <div className="cx-emoji-grid">
              {REACTIONS.map((e) => <button type="button" key={e} data-active={reactions[sheet.key] === e} onClick={() => react(sheet.key, e)}>{e}</button>)}
              <button type="button" aria-label="More reactions" onClick={() => { const v = window.prompt(ar ? "اكتب إيموجي" : "Type an emoji")?.trim(); if (v) react(sheet.key, v.slice(0, 4)); }}><SmilePlus size={22} /></button>
            </div>
            <div className="cx-sheet-group">
              <button type="button" onClick={() => { setReplyTo(sheet.text); setSheet(null); }}><Reply size={20} />{ar ? "رد" : "Reply"}</button>
              <button type="button" onClick={() => { onMarkUnread?.(); setSheet(null); setToast({ title: ar ? "اتعلمت غير مقروءة" : "Marked as unread" }); }}><MessageSquareDot size={20} />{ar ? "علّمها غير مقروءة" : "Mark as unread"}</button>
            </div>
            <div className="cx-sheet-group">
              <button type="button" onClick={() => void copy(sheet.text, ar ? "اتنسخت" : "Copied")}><Copy size={20} />{ar ? "نسخ" : "Copy"}</button>
              <button type="button" onClick={() => { setSelectable(sheet.key); setSheet(null); }}><TextCursor size={20} />{ar ? "تحديد النص" : "Select Text"}</button>
              <button type="button" onClick={() => void copy(sheet.turnId, ar ? "اتنسخ رقم الطلب" : "Request ID copied")}><Copy size={20} />{ar ? "نسخ رقم الطلب" : "Copy Request ID"}</button>
            </div>
            <div className="cx-sheet-group">
              <button type="button" onClick={() => { setSheet(null); setToast({ title: ar ? "شكرًا، وصلنا البلاغ" : "Thanks, report received" }); }}><Flag size={20} />{ar ? "إبلاغ" : "Report"}</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function mentionify(children: ReactNode, group: AgentGroup | undefined, agents: AgentInfo[]): ReactNode {
  if (!group) return children;
  const names = group.memberIds.map((id) => agents.find((a) => a.id === id)?.name).filter(Boolean) as string[];
  if (!names.length) return children;
  const re = new RegExp(`(@?(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "g");
  const walk = (node: ReactNode): ReactNode => {
    if (typeof node === "string") return node.split(re).map((p, i) => (names.includes(p.replace(/^@/, "")) ? <span key={i} className="cx-mention">{p}</span> : p));
    if (Array.isArray(node)) return node.map((n, i) => <span key={i} style={{ display: "contents" }}>{walk(n)}</span>);
    return node;
  };
  return walk(children);
}
