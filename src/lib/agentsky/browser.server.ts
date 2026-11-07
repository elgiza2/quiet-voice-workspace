/** Interactive cloud browser for the agent (server-only).
 *  Runs a real browser task through the deployed `computer-agent` function
 *  (Browser Use Cloud under the hood) and returns steps + result + files. */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/api/supabaseServerConfig";

const MAX_OUTPUT = 8000;
const clip = (s: string) => (s.length > MAX_OUTPUT ? `${s.slice(0, MAX_OUTPUT)}\n…[truncated]` : s);

export type BrowserResult = {
  ok: boolean;
  output: string;
  files?: { name: string; url: string; type?: string }[];
};

function serviceEnv(): { url: string; key: string } | null {
  // computer-agent lives next to media-video; reuse its edge config.
  const url = process.env.COMPUTER_AGENT_URL || process.env.MEDIA_VIDEO_URL || "";
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    SUPABASE_PUBLISHABLE_KEY;
  if (!url) return null;
  return { url, key };
}

export async function runAgentBrowserTask(
  userId: string,
  task: string,
  budgetMs = 600_000,
): Promise<BrowserResult> {
  const env = serviceEnv();
  if (!env) {
    // Fall back to the internal cloud-answer path when edge env is missing.
    try {
      const { runCloudAgentAnswer } = await import("@/lib/cloudAgentAnswer");
      const out = await runCloudAgentAnswer(task, { budgetMs });
      if (!out)
        return {
          ok: false,
          output: "Browser task returned nothing. Try web_fetch for simple pages.",
        };
      const steps = out.steps?.length ? `Steps:\n${out.steps.slice(-8).join("\n")}\n\n` : "";
      return { ok: Boolean(out.text), output: clip(`${steps}${out.text || "No result text."}`) };
    } catch (e: any) {
      return { ok: false, output: `Browser unavailable: ${String(e?.message || e).slice(0, 200)}` };
    }
  }
  try {
    const resp = await fetch(env.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.key, "x-user-id": userId },
      body: JSON.stringify({ kind: "agent", prompt: task, budget_ms: budgetMs }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok)
      return {
        ok: false,
        output: `Browser task failed (${resp.status}). Try web_fetch for simple pages.`,
      };
    const taskId = body?.task_id || body?.taskId;
    if (!taskId) {
      const text = String(body?.result_text || body?.text || "").trim();
      return text
        ? { ok: true, output: clip(text) }
        : { ok: false, output: "Browser task returned nothing." };
    }
    // Poll for completion within budget.
    const end = Date.now() + Math.min(budgetMs, 2 * 60 * 60_000);
    let last = "";
    while (Date.now() < end) {
      await new Promise((r) => setTimeout(r, 5000));
      const poll = await fetch(env.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: env.key, "x-user-id": userId },
        body: JSON.stringify({ kind: "agent-status", task_id: taskId }),
      })
        .then((r) => r.json().catch(() => ({})))
        .catch(() => ({}));
      const status = String(poll?.status || poll?.task?.status || "");
      const steps = Array.isArray(poll?.events)
        ? poll.events.map((e: any) => e?.title || e?.detail).filter(Boolean)
        : [];
      if (steps.length) last = steps.slice(-8).join("\n");
      if (status === "done") {
        const text = String(poll?.result_text || poll?.task?.result_text || last || "").trim();
        const files = Array.isArray(poll?.files) ? poll.files : [];
        return { ok: true, output: clip(text || "Done."), files };
      }
      if (status === "failed") {
        return {
          ok: false,
          output: clip(`Browser task failed. ${last || "Try web_fetch for simple pages."}`),
        };
      }
    }
    return {
      ok: false,
      output: clip(
        `Browser task timed out. Progress:\n${last || "none"}. Try a smaller task or web_fetch.`,
      ),
    };
  } catch (e: any) {
    return { ok: false, output: `Browser error: ${String(e?.message || e).slice(0, 300)}` };
  }
}
