/** @doc App-wide call state: one active voice/video call and one ringing incoming call from a bot. */
import { useSyncExternalStore } from "react";
import type { AgentInfo } from "@/lib/agentsky/client";

export type CallKind = "voice" | "video";
export type ActiveCall = { key: string; kind: CallKind; agent: AgentInfo; agentIds: string[]; reason?: string; callId?: string; conversationId?: string | null };
export type IncomingCall = { callId: string; kind: CallKind; agent: AgentInfo; reason: string; conversationId?: string | null };

type State = { active: ActiveCall | null; incoming: IncomingCall | null; minimized: boolean };
let state: State = { active: null, incoming: null, minimized: false };
const subs = new Set<() => void>();
const settled = new Set<string>();
const set = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };

export const calls = {
  start(c: Omit<ActiveCall, "key">) { set({ active: { ...c, key: crypto.randomUUID() }, minimized: false }); },
  end() { set({ active: null, minimized: false }); },
  minimize(minimized: boolean) { set({ minimized }); },
  ring(c: IncomingCall) { if (!settled.has(c.callId) && !state.active && !state.incoming) set({ incoming: c }); },
  settle(callId: string) { settled.add(callId); if (state.incoming?.callId === callId) set({ incoming: null }); },
  isSettled(callId: string) { return settled.has(callId); },
  clearIncoming(callId?: string) { if (!callId || state.incoming?.callId === callId) set({ incoming: null }); },
  get: () => state,
};

export function useCalls(): State {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => state);
}
