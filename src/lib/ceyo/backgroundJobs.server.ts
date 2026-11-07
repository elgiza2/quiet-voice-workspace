/** Free built-in background jobs (replaces Inngest).
 *  A job is a persisted agent_jobs row. It is started by a signed request to
 *  /api/public/ceyo-jobs on this same app, and any job left queued is picked up
 *  again by the scheduled routines endpoint. A job is claimed atomically
 *  (queued → running) so it never runs twice, and its result is delivered once
 *  with the job id as the message id. */
import { runAgentLoop } from "./agentLoop.server";

export function backgroundReady(): boolean {
  return Boolean(process.env.LOVABLE_CRON_SECRET);
}

export async function runJob(jobId: string): Promise<string> {
  if (!/^[a-f0-9-]{36}$/i.test(jobId)) throw new Error("Invalid job");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: job } = await db
    .from("agent_jobs")
    .update({ status: "running" })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();
  if (!job) return "skipped";
  let cursor = job.cursor_at;
  const poll = async () => {
    const { data } = await db.from("messages").select("content,created_at").eq("conversation_id", job.conversation_id).eq("user_id", job.user_id).eq("role", "user").gt("created_at", cursor).order("created_at");
    if (data?.length) cursor = data[data.length - 1].created_at;
    return (data || []).map((m) => m.content);
  };
  try {
    const text = await runAgentLoop(
      job.system_prompt + "\nComplete this background research or writing job and return the finished deliverable. No workspace or integration actions are available in this background job; do not claim them.",
      [{ role: "user", content: job.goal }], () => {}, new AbortController().signal, poll, { maxSteps: 25 },
    );
    if (!text.trim()) throw new Error("No completed answer");
    const { error } = await db.from("messages").upsert(
      { id: job.id, user_id: job.user_id, conversation_id: job.conversation_id, bot_id: job.bot_id, role: "assistant", content: text, metadata: { fromJob: job.id } },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    await db.from("agent_jobs").update({ status: "completed", result: text }).eq("id", job.id);
    await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", job.conversation_id);
    return "completed";
  } catch (e) {
    await db.from("agent_jobs").update({ status: "failed", error: "Background work failed" }).eq("id", job.id);
    throw e;
  }
}

/** Picks up jobs that were queued but never started (e.g. the trigger was lost). */
export async function runStaleJobs(): Promise<{ id: string; status: string }[]> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const before = new Date(Date.now() - 60_000).toISOString();
  const { data } = await db.from("agent_jobs").select("id").eq("status", "queued").lt("created_at", before).limit(3);
  const out: { id: string; status: string }[] = [];
  for (const j of data || []) {
    try { out.push({ id: j.id, status: await runJob(j.id) }); } catch { out.push({ id: j.id, status: "failed" }); }
  }
  return out;
}

export async function startLongTask(payload: { origin: string; system: string; goal: string; userId: string; conversationId: string; botId: string | null; cursorAt: string }): Promise<string> {
  const secret = process.env.LOVABLE_CRON_SECRET;
  if (!secret) throw new Error("Background jobs are not configured");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: conv } = await db.from("conversations").select("id").eq("id", payload.conversationId).eq("user_id", payload.userId).maybeSingle();
  if (!conv) throw new Error("Conversation not found");
  const { data: job, error } = await db.from("agent_jobs").insert({ user_id: payload.userId, conversation_id: payload.conversationId, bot_id: payload.botId, goal: payload.goal, system_prompt: payload.system, cursor_at: payload.cursorAt }).select("id").single();
  if (error || !job) throw new Error("Could not save job");
  // Fire the signed trigger; if it is lost, runStaleJobs picks the job up.
  void fetch(`${payload.origin}/api/public/ceyo-jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ jobId: job.id }),
  }).catch(() => undefined);
  return job.id;
}
