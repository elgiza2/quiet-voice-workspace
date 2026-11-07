/**
 * @doc team-orchestrate
 * Paid-only Team Workspace backend: turns one goal message into a named
 * agent team (each with a role + task), persisted for 24/7 execution.
 *
 * Auth: caller JWT verified against the data project; paid entitlement is
 * required (checked server-side, never trusted from UI).
 * The fast coordinator (gpt-oss-120b) proposes the team as JSON; this function
 * stores the workspace + agents and returns them for immediate render.
 * A scheduled ticker re-invokes per-agent turns so the team keeps running.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { dataAnonKey, dataServiceKey, dataUrl } from "../_shared/dataProject.ts";
import { callCerebras, CEREBRAS_MODELS } from "../_shared/cerebras.ts";

const cors = {
  ...corsHeaders,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const out = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
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

const TEAM_PROMPT = `You assemble a 24/7 agent team for ONE user goal.
Available roles: researcher, coder, analyst, writer, operator, designer, reviewer.
Return JSON ONLY:
{"agents":[{"name":"<short human name>","role":"<one of the roles>","task":"<self-contained task under 200 chars>"}]}
Rules:
- 2-4 agents, each with a distinct role and an independent self-contained task.
- Names are short and human (e.g. "Sara", "Omar"). No greetings, no extra keys.`;

function parseTeam(raw: string): Array<{ name: string; role: string; task: string }> {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      agents?: Array<{ name?: string; role?: string; task?: string }>;
    };
    const roles = new Set(["researcher", "coder", "analyst", "writer", "operator", "designer", "reviewer"]);
    return (parsed.agents ?? [])
      .filter((a) => a && typeof a.task === "string" && a.task.trim().length > 8)
      .slice(0, 4)
      .map((a, i) => ({
        name: String(a.name ?? `Agent ${i + 1}`).trim().slice(0, 40) || `Agent ${i + 1}`,
        role: roles.has(String(a.role ?? "").toLowerCase()) ? String(a.role).toLowerCase() : "operator",
        task: String(a.task).trim().slice(0, 400),
      }));
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!["POST", "GET", "PATCH"].includes(req.method)) {
    return out({ error: "Method not allowed" }, 405);
  }

  const db = admin();
  if (!db) return out({ error: "server misconfigured" }, 500);

  // Verify caller identity server-side.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const anon = dataAnonKey();
  if (!token || token === anon) return out({ error: "sign in required" }, 401);
  const url = dataUrl();
  const me = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
  });
  if (!me.ok) return out({ error: "invalid session" }, 401);
  const meBody = (await me.json().catch(() => null)) as { id?: string } | null;
  const userId = meBody?.id;
  if (!userId) return out({ error: "invalid session" }, 401);

  // The database entitlement is the server-side source of truth shared with the ticker.
  const { data: hasPaidPlan, error: planError } = await db.rpc("has_paid_plan", {
    p_user_id: userId,
  });
  if (planError || hasPaidPlan !== true) {
    return out({ error: "subscription required", code: "upgrade_required" }, 402);
  }

  if (req.method === "GET") {
    const { data: workspace } = await db
      .from("team_workspaces")
      .select("id, goal, status, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!workspace) return out({ workspace: null, agents: [] });
    const { data: agents, error } = await db
      .from("team_agents")
      .select("id, name, role, task, status, last_result, updated_at, cycles")
      .eq("workspace_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(24);
    if (error) return out({ error: "could not load workspace" }, 500);
    return out({ workspace, agents: agents ?? [] });
  }

  if (req.method === "PATCH") {
    const body = (await req.json().catch(() => null)) as { action?: string } | null;
    const status = body?.action === "pause" ? "paused" : body?.action === "resume" ? "active" : null;
    if (!status) return out({ error: "invalid action" }, 400);
    const { data: workspace } = await db
      .from("team_workspaces")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select("id, status")
      .maybeSingle();
    if (!workspace) return out({ error: "workspace not found" }, 404);
    return out({ workspace });
  }

  const body = (await req.json().catch(() => null)) as { goal?: string } | null;
  const goal = String(body?.goal ?? "").trim().slice(0, 2000);
  if (!goal) return out({ error: "goal required" }, 400);

  // Coordinator proposes the team.
  const res = await callCerebras([CEREBRAS_MODELS.fast], {
    model: CEREBRAS_MODELS.fast,
    stream: false,
    reasoning_effort: "low",
    temperature: 0.4,
    max_tokens: 800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: TEAM_PROMPT },
      { role: "user", content: goal },
    ],
  }, "fast", db);
  const raw = await res?.response?.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null;
  const team = parseTeam(String(raw?.choices?.[0]?.message?.content ?? ""));
  if (!team.length) return out({ error: "could not assemble team, try again" }, 502);

  // Persist workspace + agents (upsert: one workspace per user).
  const { data: ws } = await db
    .from("team_workspaces")
    .upsert({ user_id: userId, goal, status: "active", updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("id")
    .single();
  if (!ws?.id) return out({ error: "could not save workspace" }, 500);
  await db.from("team_agents").delete().eq("workspace_id", ws.id);
  const { data: agents } = await db
    .from("team_agents")
    .insert(team.map((a) => ({ workspace_id: ws.id, name: a.name, role: a.role, task: a.task, status: "running" })))
    .select("id, name, role, task, status, last_result, updated_at");

  return out({ workspace_id: ws.id, agents: agents ?? [] });
});
