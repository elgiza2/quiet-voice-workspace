import type { CallTurn } from "@/lib/audio/realtimeCall";
export function hasCallConversation(turns: CallTurn[]) { return turns.some(t => t.role === "user" && t.text.trim()); }