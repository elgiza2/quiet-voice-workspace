import { supabase } from "@/integrations/supabase/client";
import type { ActiveCall } from "./callStore";
import type { CallTurn } from "@/lib/audio/realtimeCall";
import { hasCallConversation } from "./callConversation";

export async function sendCallFollowup(call: ActiveCall, turns: CallTurn[], language: string) {
  if (!hasCallConversation(turns)) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Please sign in");
  const response = await fetch("/api/call-followup", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ callId: call.key, conversationId: call.conversationId, botId: call.agent.id, kind: call.kind, language, turns: turns.slice(-100).map(t => ({ ...t, text: t.text.slice(0, 4000) })) }),
  });
  window.dispatchEvent(new Event("ceyo-action-completed"));
  if (!response.ok) throw new Error("Could not send the call follow-up.");
}