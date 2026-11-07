/** Agent scheduler: runs due `agent_schedules` rows.
 *  Trigger: cron (every 5 min) or manual POST with the cron token.
 *  Each due row spawns an AgentSky session with the saved prompt, then marks
 *  next_run_at from the cron expression. Failures are recorded, never thrown. */
import { createClient } from "npm:@supabase/supabase-js@2";
import { dataServiceKey, dataUrl } from "../_shared/dataProject.ts";
import { operatorAuthorized } from "../_shared/operatorAuthorization.ts";

const out = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
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

// Minimal cron next-run: supports "M H * * *" and "M */N * * *". Falls back to +24h.
function nextRun(cron: string, from = new Date()): Date {
  try {
    const [m, h] = String(cron || "")
      .trim()
      .split(/\s+/);
    const next = new Date(from);
    next.setSeconds(0, 0);
    if (/^\*\/\d+$/.test(h || "")) {
      const step = Math.max(1, parseInt((h || "").slice(2), 10) || 1);
      next.setMinutes(0);
      next.setHours(next.getHours() + step);
      const mm = /^\d+$/.test(m || "") ? parseInt(m, 10) % 60 : 0;
      next.setMinutes(mm);
      if (next <= from) next.setHours(next.getHours() + step);
      return next;
    }
    const hh = /^\d+$/.test(h || "") ? parseInt(h, 10) % 24 : 9;
    const mm = /^\d+$/.test(m || "") ? parseInt(m, 10) % 60 : 0;
    next.setHours(hh, mm);
    if (next <= from) next.setDate(next.getDate() + 1);
    return next;
  } catch {
    return new Date(from.getTime() + 24 * 60 * 60_000);
  }
}

Deno.serve(async (req: Request) => {
  const db = admin();
  if (!db) return out({ error: "misconfigured" }, 500);
  // Cron token check (same pattern as team-tick).
  const token = req.headers.get("x-team-cron-token") || "";
  const expected = Deno.env.get("TEAM_CRON_TOKEN") || "";
  if (!operatorAuthorized(expected, token)) return out({ error: "unauthorized" }, 401);

  const now = new Date().toISOString();
  const { data: due, error } = await db
    .from("agent_schedules")
    .select("id,user_id,title,prompt,timezone")
    .eq("active", true)
    .or(`next_run_at.is.null,next_run_at.lte.${now}`)
    .limit(10);
  if (error) return out({ error: error.message }, 500);
  if (!due?.length) return out({ ran: 0 });

  const agentKey = Deno.env.get("AGENTSKY_API_KEY") || "";
  const results: { id: string; status: string }[] = [];
  for (const row of due) {
    try {
      // Record the run first so a crash never double-fires the same row.
      await db
        .from("agent_schedules")
        .update({
          last_run_at: now,
          next_run_at: nextRun("", new Date()).toISOString(),
          last_status: "running",
          updated_at: now,
        })
        .eq("id", row.id);
      if (agentKey) {
        // Fire-and-forget: create the session; the agent works even if nobody watches.
        await fetch("https://api.agentsky.dev/v1/sessions", {
          method: "POST",
          headers: { Authorization: `Bearer ${agentKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            title: String(row.title || "Scheduled task").slice(0, 80),
            metadata: { owner: row.user_id, scheduled: true },
            idleTimeoutSeconds: 43200,
            initial_events: [
              {
                type: "user.message",
                content: [{ type: "text", text: String(row.prompt || "").slice(0, 8000) }],
              },
            ],
          }),
        }).catch(() => null);
      }
      await db
        .from("agent_schedules")
        .update({ last_status: "done", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      results.push({ id: row.id, status: "done" });
    } catch (e: any) {
      await db
        .from("agent_schedules")
        .update({
          last_status: `failed: ${String(e?.message || e).slice(0, 200)}`,
          next_run_at: nextRun("", new Date()).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .catch(() => null);
      results.push({ id: row.id, status: "failed" });
    }
  }
  return out({ ran: results.length, results });
});
