/** Mounted once for the whole app: watches the user's bot calls, rings on time and hosts the call screens. */
import { useEffect, useRef } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { agentApi, type AgentInfo } from "@/lib/agentsky/client";
import { calls, useCalls, type IncomingCall } from "@/lib/calls/callStore";
import { sharedAudioContext, unlockCallAudio } from "@/lib/audio/voiceClient";
import { BotAvatar } from "@/pages/agent/hub/HubParts";
import { ActiveCallScreen } from "./CallScreen";
import "@/styles/agent.css";
import "@/styles/agent-hub.css";
import "@/styles/calls.css";

const db = supabase as any;
const RING_MS = 45_000;
const isAr = () => { try { return (localStorage.getItem("ceyo_language") || navigator.language || "").startsWith("ar"); } catch { return false; } };

type CallRow = { id: string; bot_id: string | null; reason: string; kind: "voice" | "video"; status: string; ring_at: string };

function startRingtone() {
  let stopped = false;
  const ctx = sharedAudioContext();
  const beep = () => {
    if (stopped) return;
    try { navigator.vibrate?.([700, 300, 700]); } catch { /* unsupported */ }
    if (ctx && ctx.state === "running") {
      for (const [at, f] of [[0, 880], [0.25, 660], [0.5, 880], [0.75, 660]] as const) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.22);
        o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + 0.24);
      }
    }
  };
  beep();
  const t = setInterval(beep, 2400);
  return () => { stopped = true; clearInterval(t); try { navigator.vibrate?.(0); } catch { /* unsupported */ } };
}

async function botFor(id: string | null): Promise<{ agent: AgentInfo; ids: string[] } | null> {
  const { agents } = await agentApi.bootstrap();
  const agent = agents.find((a) => a.id === id) || agents.find((a) => a.isDefault) || agents[0];
  return agent ? { agent, ids: agents.map((a) => a.id) } : null;
}

const agentIdsCache: Record<string, string[]> = {};

function IncomingScreen({ call }: { call: IncomingCall }) {
  const ar = isAr();
  useEffect(() => {
    const stop = startRingtone();
    const timeout = setTimeout(() => { void db.from("agent_calls").update({ status: "missed" }).eq("id", call.callId); calls.clearIncoming(call.callId); }, RING_MS);
    return () => { stop(); clearTimeout(timeout); };
  }, [call.callId]);
  const answer = (kind: "voice" | "video") => {
    unlockCallAudio();
    void db.from("agent_calls").update({ status: "answered" }).eq("id", call.callId);
    calls.clearIncoming(call.callId);
    calls.start({ kind, agent: call.agent, agentIds: agentIdsCache[call.callId] || [call.agent.id], reason: call.reason, callId: call.callId });
  };
  const decline = () => { void db.from("agent_calls").update({ status: "declined" }).eq("id", call.callId); calls.clearIncoming(call.callId); };
  return <div className="agent-hub cx-callscreen cx-incoming" role="alertdialog" aria-label={ar ? "مكالمة واردة" : "Incoming call"} dir="auto">
    <div className="cx-callscreen-who">
      <p className="cx-incoming-label">{call.kind === "video" ? (ar ? "مكالمة فيديو واردة" : "Incoming video call") : (ar ? "مكالمة صوتية واردة" : "Incoming voice call")}</p>
      <span className="cx-callscreen-avatar cx-incoming-pulse"><BotAvatar agent={call.agent} size={132} state="hello" /></span>
      <h2>{call.agent.name}</h2>
      {call.reason && <p className="cx-incoming-reason">{call.reason.startsWith("You finished the task") ? (ar ? "خلص المهمة اللي طلبتها" : "Finished your task") : call.reason.length > 140 ? `${call.reason.slice(0, 140)}…` : call.reason}</p>}
    </div>
    <footer className="cx-callscreen-controls cx-incoming-controls">
      <span><button type="button" className="cx-callscreen-btn cx-callscreen-end" aria-label={ar ? "رفض" : "Decline"} onClick={decline}><PhoneOff size={26} /></button><small>{ar ? "رفض" : "Decline"}</small></span>
      {call.kind === "voice" && <span><button type="button" className="cx-callscreen-btn" aria-label={ar ? "رد بالفيديو" : "Answer with video"} onClick={() => answer("video")}><Video size={24} /></button><small>{ar ? "فيديو" : "Video"}</small></span>}
      <span><button type="button" className="cx-callscreen-btn cx-callscreen-accept" aria-label={ar ? "رد" : "Answer"} onClick={() => answer(call.kind)}><Phone size={26} /></button><small>{ar ? "رد" : "Answer"}</small></span>
    </footer>
  </div>;
}

export default function CallHost() {
  const { incoming } = useCalls();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    let alive = true; let userId = ""; let channel: ReturnType<typeof supabase.channel> | null = null;
    const ring = async (row: CallRow) => {
      if (!alive || !["ringing", "scheduled"].includes(row.status)) return;
      const due = new Date(row.ring_at).getTime();
      if (due < Date.now() - 10 * 60_000) { void db.from("agent_calls").update({ status: "missed" }).eq("id", row.id); return; }
      if (due > Date.now() + 1000) {
        if (timers.current.has(row.id) || due - Date.now() > 24 * 3600_000) return;
        timers.current.set(row.id, setTimeout(() => { timers.current.delete(row.id); void ring({ ...row, ring_at: new Date().toISOString() }); }, due - Date.now()));
        return;
      }
      const bot = await botFor(row.bot_id).catch(() => null);
      if (!bot || !alive) return;
      agentIdsCache[row.id] = bot.ids;
      const ar = isAr();
      calls.ring({ callId: row.id, kind: row.kind === "video" ? "video" : "voice", agent: bot.agent, reason: row.reason });
      if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
        try { new Notification(`${bot.agent.name} ${ar ? "بيتصل بيك" : "is calling you"}`, { body: row.reason.slice(0, 120), tag: row.id, requireInteraction: true }); } catch { /* unsupported */ }
      }
    };
    const scan = async () => {
      if (!userId) return;
      const { data } = await db.from("agent_calls").select("id,bot_id,reason,kind,status,ring_at").eq("user_id", userId).in("status", ["ringing", "scheduled"]).order("ring_at").limit(20);
      for (const row of (data || []) as CallRow[]) await ring(row);
    };
    void supabase.auth.getUser().then(({ data }) => {
      if (!alive || !data.user) return;
      userId = data.user.id;
      void scan();
      channel = supabase.channel(`agent-calls-${userId}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_calls", filter: `user_id=eq.${userId}` }, (p: any) => void ring(p.new as CallRow))
        .subscribe();
    });
    const poll = setInterval(() => { if (document.visibilityState === "visible") void scan(); }, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") void scan(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false; clearInterval(poll); document.removeEventListener("visibilitychange", onVisible);
      timers.current.forEach(clearTimeout); timers.current.clear();
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  return <>
    {incoming && <IncomingScreen call={incoming} />}
    <ActiveCallScreen />
  </>;
}
