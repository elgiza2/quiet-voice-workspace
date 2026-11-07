/** Mounted once for the whole app: watches the user's bot calls, rings on time and hosts the call screens. */
import { useEffect, useRef } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { agentApi, type AgentInfo } from "@/lib/agentsky/client";
import { calls, useCalls, type IncomingCall } from "@/lib/calls/callStore";
import { sharedAudioContext, unlockCallAudio } from "@/lib/audio/voiceClient";
import { BotAvatar } from "@/pages/agent/hub/HubParts";
import { cancelNativeCall, hasNativeCalls, nativeCallEnded, nativeCallStarted, onNativeCallAction, scheduleNativeCall, showNativeIncomingCall, takeAnswerCallParam } from "@/lib/native/callBridge";
import { ActiveCallScreen, CallBackdrop, CallButton } from "./CallScreen";
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
    const timeout = setTimeout(() => { cancelNativeCall(call.callId); void db.from("agent_calls").update({ status: "missed" }).eq("id", call.callId); calls.clearIncoming(call.callId); }, RING_MS);
    return () => { stop(); clearTimeout(timeout); };
  }, [call.callId]);
  const answer = (kind: "voice" | "video") => {
    unlockCallAudio();
    cancelNativeCall(call.callId);
    void db.from("agent_calls").update({ status: "answered" }).eq("id", call.callId);
    calls.clearIncoming(call.callId);
    calls.start({ kind, agent: call.agent, agentIds: agentIdsCache[call.callId] || [call.agent.id], reason: call.reason, callId: call.callId });
  };
  const decline = () => { cancelNativeCall(call.callId); void db.from("agent_calls").update({ status: "declined" }).eq("id", call.callId); calls.clearIncoming(call.callId); };
  return <div className="agent-hub ig-call ig-call--incoming" role="alertdialog" aria-label={ar ? "مكالمة واردة" : "Incoming call"} dir="auto">
    <CallBackdrop agent={call.agent} />
    <div className="ig-call-scrim" aria-hidden />
    <div className="ig-call-center">
      <span className="ig-call-avatar ig-call-ringing"><BotAvatar agent={call.agent} size={112} state="hello" /></span>
      <h2>{call.agent.name}</h2>
      <p>{call.kind === "video" ? (ar ? "مكالمة فيديو…" : "Video call…") : (ar ? "مكالمة صوتية…" : "Audio call…")}</p>
      {call.reason && <p className="ig-call-reason">{call.reason.startsWith("You finished the task") ? (ar ? "خلص المهمة اللي طلبتها" : "Finished your task") : call.reason.length > 140 ? `${call.reason.slice(0, 140)}…` : call.reason}</p>}
    </div>
    <footer className="ig-call-answer">
      <span><CallButton label={ar ? "رفض" : "Decline"} danger onClick={decline}><PhoneOff size={28} /></CallButton><small>{ar ? "رفض" : "Decline"}</small></span>
      <span><CallButton label={ar ? "رد" : "Accept"} accept onClick={() => answer(call.kind)}>{call.kind === "video" ? <Video size={28} /> : <Phone size={28} />}</CallButton><small>{ar ? "رد" : "Accept"}</small></span>
    </footer>
  </div>;
}

export default function CallHost() {
  const { incoming, active } = useCalls();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const handedToPhone = useRef(new Set<string>());

  // Keep the phone's ongoing-call notification alive so the call keeps running in the background.
  useEffect(() => {
    if (!active) return;
    const id = active.callId || active.key;
    nativeCallStarted(id, active.agent.name, active.kind);
    return () => nativeCallEnded(id);
  }, [active?.key]);

  useEffect(() => {
    let alive = true; let userId = ""; let channel: ReturnType<typeof supabase.channel> | null = null;
    const ring = async (row: CallRow) => {
      if (!alive || !["ringing", "scheduled"].includes(row.status)) return;
      const due = new Date(row.ring_at).getTime();
      if (due < Date.now() - 10 * 60_000) { void db.from("agent_calls").update({ status: "missed" }).eq("id", row.id); return; }
      if (due > Date.now() + 1000) {
        if (!handedToPhone.current.has(row.id)) {
          const bot = await botFor(row.bot_id).catch(() => null);
          if (bot && scheduleNativeCall({ id: row.id, botName: bot.agent.name, kind: row.kind === "video" ? "video" : "voice", reason: row.reason, at: due })) handedToPhone.current.add(row.id);
        }
        if (timers.current.has(row.id) || due - Date.now() > 24 * 3600_000) return;
        timers.current.set(row.id, setTimeout(() => { timers.current.delete(row.id); void ring({ ...row, ring_at: new Date().toISOString() }); }, due - Date.now()));
        return;
      }
      const bot = await botFor(row.bot_id).catch(() => null);
      if (!bot || !alive) return;
      agentIdsCache[row.id] = bot.ids;
      const ar = isAr();
      const kind = row.kind === "video" ? "video" : "voice";
      // App is on screen: ring here only, so the phone's scheduled ring doesn't double up.
      if (document.visibilityState === "visible" && handedToPhone.current.has(row.id)) cancelNativeCall(row.id);
      calls.ring({ callId: row.id, kind, agent: bot.agent, reason: row.reason });
      // In the Android app the phone shows its own call screen (lock screen, other apps, app closed).
      if (document.visibilityState !== "visible" && hasNativeCalls()) {
        if (!handedToPhone.current.has(`now:${row.id}`)) { handedToPhone.current.add(`now:${row.id}`); showNativeIncomingCall({ id: row.id, botName: bot.agent.name, kind, reason: row.reason, at: Date.now() }); }
      } else if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
        try { new Notification(`${bot.agent.name} ${ar ? "بيتصل بيك" : "is calling you"}`, { body: row.reason.slice(0, 120), tag: row.id, requireInteraction: true }); } catch { /* unsupported */ }
      }
    };
    const scan = async () => {
      if (!userId) return;
      const { data } = await db.from("agent_calls").select("id,bot_id,reason,kind,status,ring_at").eq("user_id", userId).in("status", ["ringing", "scheduled"]).order("ring_at").limit(20);
      for (const row of (data || []) as CallRow[]) await ring(row);
    };
    // Answer/decline tapped on the phone's own call screen.
    const answerById = async (id: string) => {
      const { data: row } = await db.from("agent_calls").select("id,bot_id,reason,kind,status,ring_at").eq("id", id).maybeSingle();
      if (!alive || !row || !["ringing", "scheduled"].includes(row.status) || calls.get().active) return;
      const bot = await botFor(row.bot_id).catch(() => null);
      if (!bot || !alive) return;
      unlockCallAudio();
      await db.from("agent_calls").update({ status: "answered" }).eq("id", id);
      calls.clearIncoming(id);
      calls.start({ kind: row.kind === "video" ? "video" : "voice", agent: bot.agent, agentIds: bot.ids, reason: row.reason, callId: id });
    };
    const stopNative = onNativeCallAction((id, action) => {
      if (action === "answer") { void answerById(id); return; }
      void db.from("agent_calls").update({ status: action === "decline" ? "declined" : "missed" }).eq("id", id).in("status", ["ringing", "scheduled"]);
      calls.clearIncoming(id);
    });
    const answerParam = takeAnswerCallParam();
    void supabase.auth.getUser().then(({ data }) => {
      if (!alive || !data.user) return;
      userId = data.user.id;
      if (answerParam) void answerById(answerParam);
      void scan();
      channel = supabase.channel(`agent-calls-${userId}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_calls", filter: `user_id=eq.${userId}` }, (p: any) => void ring(p.new as CallRow))
        .subscribe();
    });
    const poll = setInterval(() => { if (document.visibilityState === "visible") void scan(); }, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") void scan(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false; stopNative(); clearInterval(poll); document.removeEventListener("visibilitychange", onVisible);
      timers.current.forEach(clearTimeout); timers.current.clear();
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  return <>
    {incoming && <IncomingScreen call={incoming} />}
    <ActiveCallScreen />
  </>;
}
