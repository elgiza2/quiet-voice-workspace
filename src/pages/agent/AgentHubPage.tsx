import { askConfirm, askText } from "@/components/common/CeyoConfirm";
import { toast } from "sonner";
/** Grok-style home for Ceyo bots and multi-bot groups, backed by real AgentSky chats. */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Folder,
  MessageSquareDot,
  Pin,
  Star,
  Trash2,
  Grid2X2,
  Grid2x2Plus,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import SEOHead from "@/components/common/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { agentApi, type AgentInfo, type SessionInfo } from "@/lib/agentsky/client";
import { loadWorkspace, useWorkspaceStore, workspace } from "@/lib/agentsky/store";
import { promptUpgrade } from "@/lib/upgradeMoment";
import { isPaidUser } from "@/lib/subscriptionGating";
import { HubChat } from "./hub/HubChat";
import { setBotLook } from "./hub/botLooks";
import { AgentForm, GroupForm, ProfilePanel, SearchOverlay, type AgentFormValue } from "./hub/HubPanels";
import { BotAvatar, GroupAvatar, HubIconButton, type HubLang } from "./hub/HubParts";
import {
  EMPTY_HUB_LOCAL,
  groupPrompt,
  itemKey,
  loadHubLocal,
  makeGroup,
  saveHubLocal,
  voiceFor,
  type AgentGroup,
  type HubLocalState,
} from "./hub/hubStorage";

const DEMO_AGENTS: AgentInfo[] = [
  { id: "demo-main", name: "اخوو", description: "المساعد الأساسي", color: "mono", prompt: "", isDefault: true, createdAt: "" },
  { id: "demo-helper", name: "مساعد", description: "تنظيم المهام والردود", color: "ember", prompt: "", isDefault: false, createdAt: "" },
  { id: "demo-analyst", name: "محلل", description: "بحث وتحليل البيانات", color: "mint", prompt: "", isDefault: false, createdAt: "" },
  { id: "demo-lead", name: "تداول — قيادة", description: "منسق الجروب", color: "rose", prompt: "", isDefault: false, createdAt: "" },
];
const DEMO_GROUP: AgentGroup = { id: "demo-group", name: "تداول — قيادة", coordinatorId: "demo-lead", memberIds: ["demo-main", "demo-analyst", "demo-helper"], category: "Trading", createdAt: "" };
const DEMO_SESSIONS: SessionInfo[] = [
  { id: "demo-session-1", agentId: "demo-lead", title: "موافقتي سارية مع أمر التحويل", status: "idle", createdAt: new Date().toISOString() },
  { id: "demo-session-2", agentId: "demo-helper", title: "التنظيف خلص، واتفقنا على الخطوة الجاية", status: "idle", createdAt: new Date(Date.now() - 720000).toISOString() },
];

function relativeTime(iso: string | undefined, lang: HubLang) {
  if (!iso) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return lang === "ar" ? "دلوقتي" : "now";
  if (minutes < 60) return lang === "ar" ? `${minutes} د` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === "ar" ? `${hours} س` : `${hours}h`;
  return new Date(iso).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { month: "short", day: "numeric" });
}

function parseTarget(value: string | null): { kind: "bot" | "group"; id: string } | null {
  if (!value) return null;
  const [kind, ...rest] = value.split(":");
  const id = rest.join(":");
  return (kind === "bot" || kind === "group") && id ? { kind, id } : null;
}

export default function AgentHubPage({ demo = false }: { demo?: boolean }) {
  const live = useWorkspaceStore();
  const ws = demo
    ? { ready: true, error: null, agents: DEMO_AGENTS, tier: "pro" as const, models: [], sessions: DEMO_SESSIONS }
    : live;
  const lang = "en" as HubLang;
  const ar = lang === "ar";
  const nav = useNavigate();
  useEffect(() => { const t = window.setTimeout(() => { void import("@/pages/ceyo/CeyoSettings"); }, 600); return () => window.clearTimeout(t); }, []);
  const [params, setParams] = useSearchParams();
  const [userId, setUserId] = useState(demo ? "demo" : "");
  const [userAvatar, setUserAvatar] = useState("");
  const [userInitial, setUserInitial] = useState("C");
  const [local, setLocal] = useState<HubLocalState>(demo ? { ...EMPTY_HUB_LOCAL, groups: [DEMO_GROUP] } : EMPTY_HUB_LOCAL);
  const [storageReady, setStorageReady] = useState(demo);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [plusOpen, setPlusOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<{ kind: "bot" | "group"; id: string; x: number; y: number; move?: boolean } | null>(null);
  const pressTimer = useRef<number | null>(null);
  const plusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!plusOpen) return;
    const onDown = (e: PointerEvent) => { if (plusRef.current && !plusRef.current.contains(e.target as Node)) setPlusOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [plusOpen]);
  const pressed = useRef(false);

  useEffect(() => {
    if (!demo) void loadWorkspace();
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const u = data.user;
      setUserId(u?.id || "device");
      const meta = (u?.user_metadata || {}) as Record<string, string>;
      setUserAvatar(meta.avatar_url || meta.picture || meta.photo_url || "");
      setUserInitial(((meta.full_name || meta.name || u?.email || "C")[0] || "C").toUpperCase());
    });
    return () => { active = false; };
  }, [demo]);

  useEffect(() => {
    if (!userId || demo) return;
    setLocal(loadHubLocal(userId));
    setStorageReady(true);
    let active = true;
    const refreshGroups = () => {
      void agentApi.groups().then((groups) => {
        if (!active) return;
        setLocal((current) => ({ ...current, groups: [...current.groups.filter((g) => g.id.startsWith("group-")), ...groups] }));
        void loadWorkspace(true);
      }).catch(() => {});
    };
    refreshGroups();
    const onFocus = () => { if (document.visibilityState === "visible") refreshGroups(); };
    document.addEventListener("visibilitychange", onFocus);
    const timer = 0;
    const onChange = () => { refreshGroups(); void loadWorkspace(true); };
    window.addEventListener("ceyo-workspace-changed", onChange);
    return () => { active = false; void timer; document.removeEventListener("visibilitychange", onFocus); window.removeEventListener("ceyo-workspace-changed", onChange); };
  }, [userId, demo]);

  const updateLocal = useCallback((recipe: (current: HubLocalState) => HubLocalState) => {
    setLocal((current) => {
      const next = recipe(current);
      if (!demo && userId) saveHubLocal(userId, next);
      return next;
    });
  }, [demo, userId]);

  const coordinatorIds = useMemo(() => new Set(local.groups.map((group) => group.coordinatorId)), [local.groups]);
  const directoryAgents = useMemo(
    () => ws.agents.filter((agent) => !coordinatorIds.has(agent.id) && !agent.isTemplate && !agent.mediaOnly),
    [ws.agents, coordinatorIds],
  );
  const primary = directoryAgents.find((agent) => agent.isDefault) || directoryAgents[0] || null;
  const orderedAgents = [...directoryAgents].sort((a, b) => Number(a.isDefault) - Number(b.isDefault));
  const groupMembersAgents = demo ? DEMO_AGENTS.filter((agent) => agent.id !== "demo-lead") : ws.agents.filter((agent) => !coordinatorIds.has(agent.id) && !agent.isTemplate && !agent.mediaOnly);

  const chatTarget = parseTarget(params.get("chat"));
  const profileTarget = parseTarget(params.get("profile"));
  const editTarget = parseTarget(params.get("edit"));
  const newKind = params.get("new");
  const activeTarget = profileTarget || editTarget || chatTarget;
  const activeGroup = activeTarget?.kind === "group" ? local.groups.find((group) => group.id === activeTarget.id) : undefined;
  const activeAgent = activeTarget
    ? ws.agents.find((agent) => agent.id === (activeTarget.kind === "group" ? activeGroup?.coordinatorId : activeTarget.id))
    : null;
  const activeSessions = activeAgent ? ws.sessions.filter((session) => session.agentId === activeAgent.id) : [];
  const selectedSession = chatTarget ? params.get("session") : null;
  const paid = isPaidUser(ws.tier);

  const go = useCallback((next: Record<string, string>, replace = false) => {
    setPlusOpen(false);
    setAppsOpen(false);
    setSearchOpen(false);
    setFormError("");
    setParams(next, { replace });
  }, [setParams]);

  const goHome = useCallback(() => go({}, false), [go]);

  // A chat that no longer exists (deleted bot/group, stale link) drops back to the home list.
  useEffect(() => {
    if (!activeTarget || !ws.ready || !storageReady) return;
    if (!activeAgent) goHome();
  }, [activeTarget, activeAgent, goHome, storageReady, ws.ready]);

  const openChat = useCallback((kind: "bot" | "group", id: string, latest = true, sessionId?: string | null) => {
    const next: Record<string, string> = { chat: itemKey(kind, id) };
    const group = kind === "group" ? local.groups.find((item) => item.id === id) : undefined;
    const agentId = group?.coordinatorId || id;
    const latestSession = latest ? ws.sessions.find((session) => session.agentId === agentId) : null;
    const chosen = sessionId === undefined ? latestSession?.id : sessionId;
    if (chosen) next.session = chosen;
    const key = itemKey(kind, id);
    updateLocal((current) => ({ ...current, unread: current.unread.filter((k) => k !== key), seen: { ...current.seen, [key]: new Date().toISOString() } }));
    go(next);
  }, [go, local.groups, ws.sessions, updateLocal]);

  const latestFor = useCallback((agentId: string) => ws.sessions.find((session) => session.agentId === agentId), [ws.sessions]);

  const toggleHidden = (key: string, hide: boolean) => {
    updateLocal((current) => ({ ...current, hidden: hide ? [...new Set([...current.hidden, key])] : current.hidden.filter((item) => item !== key) }));
    if (hide) goHome();
  };

  const saveAgent = async (value: AgentFormValue, initial?: AgentInfo | null) => {
    if (demo) { setFormError("Design preview"); return; }
    setBusy(true);
    setFormError("");
    try {
      const payload = { name: value.name, description: value.description, prompt: value.prompt, color: value.color, voiceSettings: value.voice };
      const result = initial ? await agentApi.updateAgent(initial.id, payload) : await agentApi.createAgent(payload);
      if (initial) workspace.updateAgent(result.agent); else workspace.addAgent(result.agent);
      const id = result.agent.id;
      if (value.look) setBotLook(id, value.look);
      updateLocal((current) => ({
        ...current,
        categories: { ...current.categories, [itemKey("bot", id)]: value.category },
        voices: { ...current.voices, [id]: value.voice },
      }));
      openChat("bot", id, false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : ar ? "معرفناش نحفظ البوت." : "Could not save the bot.");
    } finally {
      setBusy(false);
    }
  };

  const saveGroup = async (value: { name: string; memberIds: string[]; category: string }, initial?: AgentGroup | null) => {
    if (demo) { setFormError("Design preview"); return; }
    setBusy(true);
    setFormError("");
    try {
      const members = value.memberIds.map((id) => ws.agents.find((agent) => agent.id === id)).filter((agent): agent is AgentInfo => !!agent);
      const payload = { name: value.name, description: `${members.length} coordinated bots`, prompt: groupPrompt(value.name, members), color: "rose" as const };
      const result = initial ? await agentApi.updateAgent(initial.coordinatorId, payload) : await agentApi.createAgent(payload);
      if (initial) workspace.updateAgent(result.agent); else workspace.addAgent(result.agent);
      const draft = makeGroup({ id: initial?.id, createdAt: initial?.createdAt, name: value.name, coordinatorId: result.agent.id, memberIds: value.memberIds, category: value.category });
      const group = await agentApi.saveGroup(draft);
      updateLocal((current) => ({ ...current, groups: [...current.groups.filter((item) => item.id !== group.id), group] }));
      openChat("group", group.id, false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : ar ? "معرفناش نحفظ الجروب." : "Could not save the group.");
    } finally {
      setBusy(false);
    }
  };

  const deleteBot = async (agent: AgentInfo) => {
    if (demo) return;
    if (!(await askConfirm({ title: ar ? `تمسح ${agent.name}؟` : `Delete ${agent.name}?`, body: ar ? "البوت وتعليماته هيتمسحوا نهائيًا." : "This bot and its instructions will be deleted for good.", confirm: ar ? "مسح" : "Delete", cancel: ar ? "إلغاء" : "Cancel", danger: true }))) return;
    try {
      await agentApi.deleteAgent(agent.id);
      workspace.removeAgent(agent.id);
      updateLocal((current) => ({
        ...current,
        groups: current.groups.map((group) => ({ ...group, memberIds: group.memberIds.filter((id) => id !== agent.id) })),
        categories: Object.fromEntries(Object.entries(current.categories).filter(([key]) => key !== itemKey("bot", agent.id))),
        hidden: current.hidden.filter((key) => key !== itemKey("bot", agent.id)),
      }));
      goHome();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : ar ? "الحذف مكملش." : "Could not delete the bot.");
    }
  };

  const deleteGroup = async (group: AgentGroup) => {
    if (demo) return;
    if (!(await askConfirm({ title: ar ? `تمسح جروب ${group.name}؟` : `Delete ${group.name}?`, body: ar ? "الجروب هيتمسح نهائيًا." : "This group will be deleted for good.", confirm: ar ? "مسح" : "Delete", cancel: ar ? "إلغاء" : "Cancel", danger: true }))) return;
    try {
      await agentApi.deleteAgent(group.coordinatorId);
      workspace.removeAgent(group.coordinatorId);
      updateLocal((current) => ({ ...current, groups: current.groups.filter((item) => item.id !== group.id), hidden: current.hidden.filter((key) => key !== itemKey("group", group.id)) }));
      goHome();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : ar ? "الحذف مكملش." : "Could not delete the group.");
    }
  };

  const categoryFor = (kind: "bot" | "group", id: string, group?: AgentGroup) => group?.category || local.categories[itemKey(kind, id)] || "Unassigned";
  const categories = new Set<string>(["Unassigned"]);
  orderedAgents.forEach((agent) => { if (!agent.isDefault) categories.add(categoryFor("bot", agent.id)); });
  local.groups.forEach((group) => categories.add(categoryFor("group", group.id, group)));

  const isUnread = (key: string, at?: string) => local.unread.includes(key) || (!!at && !!local.seen[key] && at > local.seen[key]);
  const pressProps = (kind: "bot" | "group", id: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      pressed.current = false;
      const x = e.clientX, y = e.clientY;
      pressTimer.current = window.setTimeout(() => { pressed.current = true; setRowMenu({ kind, id, x, y }); }, 450);
    },
    onPointerUp: () => { if (pressTimer.current) window.clearTimeout(pressTimer.current); },
    onPointerLeave: () => { if (pressTimer.current) window.clearTimeout(pressTimer.current); },
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setRowMenu({ kind, id, x: e.clientX, y: e.clientY }); },
    onClickCapture: (e: React.MouseEvent) => { if (pressed.current) { e.stopPropagation(); e.preventDefault(); pressed.current = false; } },
  });
  const sortPinned = <T,>(items: T[], key: (t: T) => string) => [...items].sort((a, b) => Number(local.pinned.includes(key(b))) - Number(local.pinned.includes(key(a))));

  const renderBotRow = (agent: AgentInfo, hidden = false) => {
    const latest = latestFor(agent.id);
    const key = itemKey("bot", agent.id);
    return (
      <div className="hub-list-row" key={key}>
        <button type="button" className="hub-list-row-main" {...pressProps("bot", agent.id)} data-unread={isUnread(key, latest?.createdAt)} onClick={() => openChat("bot", agent.id)} aria-label={`${ar ? "افتح" : "Open"} ${agent.name}`}>
          <BotAvatar agent={agent} size={36} />
          <span className="hub-row-copy"><span className="hub-row-title"><strong>{local.pinned.includes(key) && <Pin size={12} className="hub-pin" />}{agent.name}</strong><time>{relativeTime(latest?.createdAt, lang)}</time></span><span className="hub-row-preview">{latest?.title || (ar ? "ابدأ محادثة" : "Start a conversation")}</span></span>
        </button>
        {hidden && <HubIconButton label={ar ? "إظهار" : "Unhide"} onClick={() => toggleHidden(key, false)}><EyeOff size={16} /></HubIconButton>}
      </div>
    );
  };

  const renderGroupRow = (group: AgentGroup, hidden = false) => {
    const latest = latestFor(group.coordinatorId);
    const key = itemKey("group", group.id);
    const members = group.memberIds.map((id) => ws.agents.find((agent) => agent.id === id)).filter((agent): agent is AgentInfo => !!agent);
    return (
      <div className="hub-list-row" key={key}>
        <button type="button" className="hub-list-row-main" {...pressProps("group", group.id)} data-unread={isUnread(key, latest?.createdAt)} onClick={() => openChat("group", group.id)} aria-label={`${ar ? "افتح" : "Open"} ${group.name}`}>
          <GroupAvatar group={group} agents={ws.agents} size={28} />
          <span className="hub-row-copy"><span className="hub-row-title"><strong>{local.pinned.includes(key) && <Pin size={12} className="hub-pin" />}{group.name}</strong><time>{relativeTime(latest?.createdAt, lang)}</time></span><span className="hub-row-preview">{latest?.title || members.map((member) => member.name).join(" · ")}</span></span>
        </button>
        {hidden && <HubIconButton label={ar ? "إظهار" : "Unhide"} onClick={() => toggleHidden(key, false)}><EyeOff size={16} /></HubIconButton>}
      </div>
    );
  };

  const listContent = (
    <aside className="hub-home" aria-label={ar ? "البوتات والجروبات" : "Bots and groups"}>
      <header className="hub-home-header">
        <button type="button" aria-label="Account" className="hub-user-avatar" onClick={() => nav("/settings")}>{userAvatar ? <img src={userAvatar} alt="" /> : <span>{userInitial}</span>}</button>
        <div className="hub-plus-wrap" ref={plusRef}>
          <HubIconButton label={ar ? "إنشاء" : "Create"} onClick={() => setPlusOpen((open) => !open)} active={plusOpen}><Plus size={22} /></HubIconButton>
          {plusOpen && <div className="hub-menu hub-plus-menu" role="menu"><button type="button" role="menuitem" onClick={() => go({ new: "bot" })}>{ar ? "بوت جديد" : "New Bot"}</button><button type="button" role="menuitem" onClick={() => go({ new: "group" })}>{ar ? "جروب جديد" : "New Group Chat"}</button></div>}
        </div>
      </header>

      <div className="hub-home-scroll">
        {primary ? (
          <button type="button" className="hub-primary-button" onClick={() => openChat("bot", primary.id)}>
            <span className="hub-primary-character"><BotAvatar agent={primary} size={104} state="idle" /><i className="hub-primary-star"><Star size={13} fill="currentColor" strokeWidth={0} /></i></span>
            <strong>{isUnread(itemKey("bot", primary.id), latestFor(primary.id)?.createdAt) && <span className="hub-unread-dot" />}{primary.name}</strong>
          </button>
        ) : !ws.ready ? <div className="hub-primary-skeleton"><Loader2 size={24} className="animate-spin" /></div> : null}

        
        {ws.error && <div className="hub-workspace-error"><p>{ar ? "البوتات مش متاحة دلوقتي. المحادثة الأساسية لسه شغالة." : "Your bots are unavailable right now. Quick Chat still works."}</p><button type="button" onClick={() => void loadWorkspace(true)}>{ar ? "حاول تاني" : "Try again"}</button></div>}

        {ws.ready && (() => {
          const bots = orderedAgents.filter((agent) => !agent.isDefault && categoryFor("bot", agent.id) === "Unassigned" && !local.hidden.includes(itemKey("bot", agent.id)));
          const groups = local.groups.filter((group) => categoryFor("group", group.id, group) === "Unassigned" && !local.hidden.includes(itemKey("group", group.id)));
          if (!bots.length && !groups.length) return null;
          const hasSections = [...categories].some((c) => c !== "Unassigned" && (orderedAgents.some((a) => !a.isDefault && categoryFor("bot", a.id) === c && !local.hidden.includes(itemKey("bot", a.id))) || local.groups.some((g) => categoryFor("group", g.id, g) === c && !local.hidden.includes(itemKey("group", g.id)))));
          const rows = <div className="hub-category-rows hub-flat-rows">{sortPinned(groups, (g) => itemKey("group", g.id)).map((group) => renderGroupRow(group))}{sortPinned(bots, (a) => itemKey("bot", a.id)).map((agent) => renderBotRow(agent))}</div>;
          return hasSections ? <section className="hub-category"><div className="hub-category-title"><span>Unassigned</span><ChevronDown size={14} /></div>{rows}</section> : rows;
        })()}

        {ws.ready && [...categories].filter((category) => category !== "Unassigned").sort((a, b) => a.localeCompare(b)).map((category) => {
          const bots = orderedAgents.filter((agent) => !agent.isDefault && categoryFor("bot", agent.id) === category && !local.hidden.includes(itemKey("bot", agent.id)));
          const groups = local.groups.filter((group) => categoryFor("group", group.id, group) === category && !local.hidden.includes(itemKey("group", group.id)));
          if (!bots.length && !groups.length) return null;
          const isCollapsed = collapsed.has(category);
          return (
            <section className="hub-category" key={category}>
              <button type="button" className="hub-category-title" onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(category)) next.delete(category); else next.add(category); return next; })} aria-expanded={!isCollapsed}><span>{category}</span><ChevronDown size={14} /></button>
              {!isCollapsed && <div className="hub-category-rows">{groups.map((group) => renderGroupRow(group))}{bots.map((agent) => renderBotRow(agent))}</div>}
            </section>
          );
        })}


        {local.hidden.length > 0 && (
          <section className="hub-hidden-section">
            <button type="button" className="hub-hidden-title" onClick={() => setHiddenOpen((open) => !open)}><span>{ar ? "المحادثات المخفية" : "Hidden chats"}<small>{local.hidden.length}</small></span><ChevronRight size={15} /></button>
            {hiddenOpen && <div className="hub-category-rows">{local.groups.filter((group) => local.hidden.includes(itemKey("group", group.id))).map((group) => renderGroupRow(group, true))}{orderedAgents.filter((agent) => local.hidden.includes(itemKey("bot", agent.id))).map((agent) => renderBotRow(agent, true))}</div>}
          </section>
        )}
      </div>

      <div className="hub-home-bottom">
        <HubIconButton label="Connect apps" className="hub-apps-btn" onClick={() => nav("/settings/apps")}><Grid2x2Plus size={21} strokeWidth={1.8} /></HubIconButton>
        <button type="button" className="hub-search-trigger" onClick={() => setSearchOpen(true)}><Search size={18} /><span>{ar ? "بحث" : "Search"}</span></button>
      </div>
      {rowMenu && <div className="hub-backdrop" onPointerDown={() => setRowMenu(null)} />}
      {rowMenu && (() => {
        const key = itemKey(rowMenu.kind, rowMenu.id);
        const group = rowMenu.kind === "group" ? local.groups.find((g) => g.id === rowMenu.id) : undefined;
        const agent = rowMenu.kind === "bot" ? ws.agents.find((a) => a.id === rowMenu.id) : undefined;
        const close = () => setRowMenu(null);
        const top = Math.min(rowMenu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 330);
        const setCategory = (category: string) => {
          if (group) updateLocal((c) => ({ ...c, groups: c.groups.map((g) => g.id === group.id ? { ...g, category } : g) }));
          else updateLocal((c) => ({ ...c, categories: { ...c.categories, [key]: category } }));
          close();
        };
        const existing = [...categories].filter((c) => c !== "Unassigned");
        return (
          <div className="hub-menu hub-row-menu" role="menu" style={{ top: Math.max(12, top) }}>
            {!rowMenu.move ? (<>
              <button type="button" role="menuitem" onClick={() => { updateLocal((c) => ({ ...c, unread: [...new Set([...c.unread, key])] })); close(); }}><MessageSquareDot size={20} />Mark Unread</button>
              <button type="button" role="menuitem" onClick={() => { updateLocal((c) => ({ ...c, pinned: c.pinned.includes(key) ? c.pinned.filter((k) => k !== key) : [...c.pinned, key] })); close(); }}><Pin size={20} />{local.pinned.includes(key) ? "Unpin" : "Pin"}</button>
              <button type="button" role="menuitem" onClick={() => setRowMenu({ ...rowMenu, move: true })}><Folder size={20} />Move to<ChevronRight size={18} className="hub-menu-chev" /></button>
              <button type="button" role="menuitem" data-danger="true" onClick={() => { toggleHidden(key, true); close(); }}><EyeOff size={20} />Hide</button>
              <button type="button" role="menuitem" data-danger="true" onClick={() => { close(); if (group) void deleteGroup(group); else if (agent) void deleteBot(agent); }}><Trash2 size={20} />Delete</button>
            </>) : (<>
              <button type="button" role="menuitem" onClick={() => setRowMenu({ ...rowMenu, move: false })}><ChevronLeft size={20} />Back</button>
              {existing.map((c) => <button type="button" role="menuitem" key={c} onClick={() => setCategory(c)}><Folder size={20} />{c}</button>)}
              <button type="button" role="menuitem" onClick={() => { close(); void askText({ title: ar ? "قسم جديد" : "New section", placeholder: ar ? "اسم القسم" : "Section name", confirm: ar ? "إضافة" : "Add", cancel: ar ? "إلغاء" : "Cancel" }).then((name) => { if (name) setCategory(name.slice(0, 40)); }); }}><Plus size={20} />New section</button>
              {existing.length > 0 && <button type="button" role="menuitem" onClick={() => setCategory("Unassigned")}><Folder size={20} />Unassigned</button>}
            </>)}
          </div>
        );
      })()}
    </aside>
  );

  let content: ReactNode = null;

  if (newKind === "bot") content = <AgentForm lang={lang} busy={busy} error={formError} onSubmit={(value) => void saveAgent(value)} onCancel={goHome} />;
  else if (newKind === "group") content = <GroupForm lang={lang} agents={groupMembersAgents} busy={busy} error={formError} onSubmit={(value) => void saveGroup(value)} onCancel={goHome} />;
  else if (profileTarget && activeAgent) content = <ProfilePanel lang={lang} agent={activeAgent} group={activeGroup} agents={ws.agents} sessions={activeSessions} onBack={() => chatTarget ? openChat(chatTarget.kind, chatTarget.id, false, selectedSession) : goHome()} onEdit={() => go({ edit: itemKey(profileTarget.kind, profileTarget.id) })} onOpenChat={() => openChat(profileTarget.kind, profileTarget.id)} onRename={activeGroup ? (name) => void saveGroup({ name, memberIds: activeGroup.memberIds, category: activeGroup.category || "Unassigned" }, activeGroup) : undefined} onMakePrimary={!demo && !activeGroup && !activeAgent.isDefault ? () => { void askConfirm({ title: `Make ${activeAgent.name} your primary bot?`, body: "Your other bots and chat history stay saved.", confirm: "Replace" }).then(async (yes) => { if (!yes) return; try { await agentApi.makePrimary(activeAgent.id); await loadWorkspace(true); toast.success("Primary bot updated"); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not replace primary bot"); } }); } : undefined} onComputer={() => nav("/settings/computer")} onDelete={!activeAgent.isDefault ? () => activeGroup ? void deleteGroup(activeGroup) : void deleteBot(activeAgent) : undefined} />;
  else if (editTarget?.kind === "bot" && activeAgent) content = <AgentForm lang={lang} initial={activeAgent} category={categoryFor("bot", activeAgent.id)} voice={activeAgent.voiceSettings || voiceFor(local, activeAgent.id)} busy={busy} error={formError} onSubmit={(value) => void saveAgent(value, activeAgent)} onCancel={() => go({ profile: itemKey("bot", activeAgent.id) })} />;
  else if (editTarget?.kind === "group" && activeGroup) content = <GroupForm lang={lang} initial={activeGroup} agents={groupMembersAgents} busy={busy} error={formError} onSubmit={(value) => void saveGroup(value, activeGroup)} onCancel={() => go({ profile: itemKey("group", activeGroup.id) })} />;
  else if (chatTarget && activeAgent) content = <HubChat lang={lang} voiceSettings={activeAgent.voiceSettings || voiceFor(local, activeAgent.id)} voicePreferences={local.voices} agent={activeAgent} group={activeGroup} agents={ws.agents} sessions={activeSessions} sessionId={demo ? "demo" : selectedSession} tier={ws.tier} models={ws.models} demo={demo} onSession={(id) => openChat(chatTarget.kind, chatTarget.id, false, id)} onBack={goHome} onProfile={() => go({ profile: itemKey(chatTarget.kind, chatTarget.id) })} onHide={() => toggleHidden(itemKey(chatTarget.kind, chatTarget.id), true)} onDelete={!activeAgent.isDefault ? () => activeGroup ? void deleteGroup(activeGroup) : void deleteBot(activeAgent) : undefined} onMarkUnread={() => { const k = itemKey(chatTarget.kind, chatTarget.id); updateLocal((c) => ({ ...c, unread: [...new Set([...c.unread, k])] })); }} />;
  const contentOpen = content !== null;

  return (
    <div className="agent-hub" data-content-open={contentOpen} dir={ar ? "rtl" : "ltr"} data-no-translate>
      <SEOHead path="/" title={ar ? "Ceyo — بوتاتك وجروباتك" : "Ceyo — Your bots and groups"} description={ar ? "اتكلم مع Ceyo واعمل بوتات وجروبات ذكية لكل شغلك." : "Chat with Ceyo and create personal bots and coordinated groups for your work."} />
      {listContent}
      <main className="hub-content">{content}</main>
      {searchOpen && <SearchOverlay lang={lang} agents={orderedAgents} groups={local.groups} sessions={ws.sessions} onClose={() => setSearchOpen(false)} onBot={(id) => openChat("bot", id)} onGroup={(id) => openChat("group", id)} onSession={(session) => { const group = local.groups.find((item) => item.coordinatorId === session.agentId); openChat(group ? "group" : "bot", group?.id || session.agentId, false, session.id); }} />}
    </div>
  );
}

export function AgentHubNewPage() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/?new=bot", { replace: true }); }, [navigate]);
  return null;
}
