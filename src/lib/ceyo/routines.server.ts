import { nextRoutineRun } from "./content";
import { runAgentLoop } from "./agentLoop.server";
import { agentPrompt } from "./prompt";

/** Called only after a verified operator/scheduler credential. No user-account actions. */
export async function runDueRoutines() {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: routines, error } = await db.rpc("claim_agent_routines");
  if (error) throw new Error(error.message);
  const results: { id: string; status: string }[] = [];
  for (const routine of routines || []) {
    const { data: run, error: claimError } = await db.from("agent_routine_runs").insert({ routine_id: routine.id, user_id: routine.user_id, scheduled_at: routine.next_run_at }).select("id").single();
    if (claimError || !run) {
      await db.from("agent_routines").update({ active: false, last_error: "Previous run needs review; paused to prevent duplicate execution", lease_until: null }).eq("id", routine.id);
      continue;
    }
    try {
      const { data: current } = await db.from("agent_routines").select("active").eq("id", routine.id).single();
      if (!current?.active) throw new Error("Routine paused");
      const { data: conv } = await db.from("conversations").select("id,bot_id").eq("id", routine.conversation_id).eq("user_id", routine.user_id).single();
      if (!conv) throw new Error("Conversation unavailable");
      const { data: memory } = await db.from("agent_memories").select("content").eq("user_id", routine.user_id).limit(100);
      const text = await runAgentLoop(agentPrompt("Ceyo") + `\nScheduled research/writing only. No account actions, computer or code execution available. User context: ${JSON.stringify(memory)}`, [{ role: "user", content: routine.goal }], () => {}, new AbortController().signal, async () => [], { maxSteps: 12 });
      const { error: deliveryError } = await db.from("messages").upsert({ id: run.id, user_id: routine.user_id, conversation_id: conv.id, bot_id: conv.bot_id, role: "assistant", content: `${routine.title}\n\n${text}`, metadata: { routine_id: routine.id } }, { onConflict: "id", ignoreDuplicates: true });
      if (deliveryError) throw new Error("Could not deliver routine result");
      await db.from("agent_routine_runs").update({ status: "completed", result: text }).eq("id", run.id);
      await db.from("agent_routines").update({ next_run_at: nextRoutineRun(routine.interval_hours), lease_until: null, last_error: null, last_result: text }).eq("id", routine.id);
      await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conv.id);
      results.push({ id: routine.id, status: "completed" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Routine failed";
      await db.from("agent_routine_runs").update({ status: "failed", error: message }).eq("id", run.id);
      await db.from("agent_routines").update({ active: false, lease_until: null, last_error: message }).eq("id", routine.id);
      results.push({ id: routine.id, status: "paused" });
      if (/AI error (402|403|429)/.test(message)) {
        await db.from("agent_routines").update({ active: false, last_error: "Provider access or quota failure; resume only after resolving it" }).eq("active", true);
        break;
      }
    }
  }
  return results;
}