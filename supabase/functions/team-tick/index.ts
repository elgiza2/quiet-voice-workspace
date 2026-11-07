import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { dataServiceKey, dataUrl } from "../_shared/dataProject.ts";
import { callCerebras, CEREBRAS_MODELS } from "../_shared/cerebras.ts";

const cors = {
  ...corsHeaders,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-team-cron-token",
};
const out = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function admin() {
  const url = dataUrl();
  const key = dataServiceKey();
  if (!url || !key) return null;
  try {
    return createClient(url, key, { auth: { persistSession: false } }) as any;
  } catch {
    return null;
  }
}

function secureEquals(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function parseResult(raw: string): { state: "continue" | "done" | "blocked" | "handoff"; result: string; next_task?: string; handoff_role?: string } | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(cleaned.slice(start, end + 1));
    const state = ["continue", "done", "blocked", "handoff"].includes(value?.state)
      ? value.state
      : "continue";
    const result = String(value?.result ?? "").trim().slice(0, 6000);
    if (!result) return null;
    return {
      state,
      result,
      ...(typeof value?.next_task === "string" ? { next_task: value.next_task.trim().slice(0, 400) } : {}),
      ...(typeof value?.handoff_role === "string" ? { handoff_role: value.handoff_role.trim().slice(0, 40) } : {}),
    };
  } catch {
    return null;
  }
}

const WORKER_SYSTEM = `You are one member of a persistent AI team, running one bounded work session.
Use only the workspace goal, your assigned task, and the saved team notes provided. You have no browser, shell, web search, connected-app, or file tools. Never claim that you performed an external action or verified live information.
Make concrete progress by producing analysis, a draft, a plan, or a useful next step. Continue only when another bounded step can add value. Mark blocked when the task needs a real integration, permission, or fresh external data that you do not have.
Return JSON only: {"state":"continue|done|blocked|handoff","result":"concise progress or blocker","next_task":"optional revised task","handoff_role":"optional target role"}.
Use "handoff" only when another named teammate can clearly do the next step; do not loop without meaningful progress.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405);

  const db = admin();
  if (!db) return out({ error: "server misconfigured" }, 500);

  const supplied = req.headers.get("x-team-cron-token") || "";
  const { data: secretRow, error: secretError } = await db
    .from("team_runner_secrets")
    .select("token")
    .eq("singleton", true)
    .maybeSingle();
  if (secretError || !secretRow?.token || !secureEquals(supplied, String(secretRow.token))) {
    return out({ error: "forbidden" }, 403);
  }

  const { data: claimed, error: claimError } = await db.rpc("claim_team_agent");
  if (claimError) {
    console.error("team-tick claim failed", claimError.message);
    return out({ error: "claim failed" }, 500);
  }
  const agent = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!agent?.agent_id) return out({ processed: false, reason: "no_due_agents" });

  const prior = String(agent.last_result || "").slice(-5000);
  const prompt = [
    `Workspace goal: ${String(agent.goal || "").slice(0, 2000)}`,
    `Your name and role: ${String(agent.agent_name || "Agent")} (${String(agent.agent_role || "operator")})`,
    `Current task: ${String(agent.task || "").slice(0, 1000)}`,
    `Saved progress from your previous session: ${prior || "No previous progress."}`,
    `Completed work sessions: ${Number(agent.cycles || 0)}`,
    "Produce the next useful increment. If complete, say done. If another role should take the next step, use handoff and name that role.",
  ].join("\n\n");

  let parsed: ReturnType<typeof parseResult> = null;
  try {
    const result = await callCerebras([CEREBRAS_MODELS.worker], {
      model: CEREBRAS_MODELS.worker,
      stream: false,
      reasoning_effort: "low",
      temperature: 0.4,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: WORKER_SYSTEM },
        { role: "user", content: prompt },
      ],
    }, "worker", db);
    const body = await result?.response?.json().catch(() => null) as {
      choices?: Array<{ message?: { content?: string } }>;
    } | null;
    parsed = parseResult(String(body?.choices?.[0]?.message?.content ?? ""));
  } catch (error) {
    console.error("team-tick model call failed", error);
  }

  if (!parsed) {
    const message = "العامل مش قادر يكمل الجولة دي دلوقتي؛ هنجرب تاني بعد 5 دقايق.";
    await db.from("team_agents").update({
      status: "running",
      last_result: message,
      next_run_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", agent.agent_id);
    await db.from("team_agent_events").insert({
      workspace_id: agent.workspace_id,
      agent_id: agent.agent_id,
      user_id: agent.user_id,
      event_type: "retry",
      content: message,
    });
    return out({ processed: true, state: "retry" });
  }

  let nextTask = parsed.next_task || String(agent.task || "");
  let finalState = parsed.state;
  let finalResult = parsed.result;
  let handoffAgentId: string | null = null;
  if (parsed.state === "handoff") {
    if (!parsed.next_task || !parsed.handoff_role) {
      finalState = "blocked";
      nextTask = String(agent.task || "");
      finalResult = `${parsed.result}\n\nHandoff blocked: a target role and next_task are required.`.slice(0, 6000);
    } else {
      const { data: target } = await db
        .from("team_agents")
        .select("id, last_result")
        .eq("workspace_id", agent.workspace_id)
        .eq("role", parsed.handoff_role)
        .neq("id", agent.agent_id)
        .maybeSingle();
      if (target?.id) {
        const handoffNote = `Handoff from ${String(agent.agent_name || "Agent")} (${String(agent.agent_role || "teammate")}): ${parsed.result}`;
        const targetProgress = [String(target.last_result || "").slice(-3000), handoffNote]
          .filter(Boolean)
          .join("\n\n")
          .slice(-5000);
        const { error: handoffError } = await db.from("team_agents").update({
          task: parsed.next_task,
          last_result: targetProgress,
          status: "running",
          next_run_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", target.id);
        if (handoffError) {
          finalState = "blocked";
          nextTask = String(agent.task || "");
          finalResult = `${parsed.result}\n\nHandoff blocked: could not save the receiving agent's task.`.slice(0, 6000);
        } else {
          handoffAgentId = target.id;
          await db.from("team_agent_events").insert({
            workspace_id: agent.workspace_id,
            agent_id: target.id,
            user_id: agent.user_id,
            event_type: "handoff_received",
            content: handoffNote,
          });
        }
      } else {
        finalState = "blocked";
        nextTask = String(agent.task || "");
        finalResult = `${parsed.result}\n\nHandoff blocked: no teammate with role '${parsed.handoff_role}' exists.`.slice(0, 6000);
      }
    }
  }

  const status = finalState === "done" || (finalState === "handoff" && !!handoffAgentId)
    ? "done"
    : finalState === "blocked"
      ? "blocked"
      : "running";
  const { error: updateError } = await db.from("team_agents").update({
    task: nextTask,
    status,
    last_result: finalResult,
    cycles: Number(agent.cycles || 0) + 1,
    next_run_at: status === "running"
      ? new Date(Date.now() + 5 * 60_000).toISOString()
      : new Date(Date.now() + 365 * 24 * 60 * 60_000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", agent.agent_id);
  if (updateError) console.error("team-tick save failed", updateError.message);

  await db.from("team_agent_events").insert({
    workspace_id: agent.workspace_id,
    agent_id: agent.agent_id,
    user_id: agent.user_id,
    event_type: handoffAgentId ? "handoff" : status,
    content: finalResult,
  });

  if (status !== "running") {
    const { data: remaining } = await db
      .from("team_agents")
      .select("id")
      .eq("workspace_id", agent.workspace_id)
      .eq("status", "running")
      .limit(1);
    if (!remaining?.length) {
      await db.from("team_workspaces").update({ status: status === "blocked" ? "needs_attention" : "completed", updated_at: new Date().toISOString() })
        .eq("id", agent.workspace_id);
    }
  }

  return out({ processed: true, state: status, handoff_agent_id: handoffAgentId });
});
