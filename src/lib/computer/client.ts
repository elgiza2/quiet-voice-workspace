/** @doc Browser client for the Computer Agent (Supabase edge function `computer-agent`).
 *
 * The underlying provider is Browser Use Cloud (https://cloud.browser-use.com):
 * it is the base agent for both plain chat turns that need real work and the
 * in-chat computer surface. The provider name never reaches the UI. */
import { supabase } from "@/integrations/supabase/legacyClient";
import { edgeAnonKey, edgeUrl } from "@/lib/edgeRuntime";

export interface ComputerFile {
  name: string;
  url: string;
  type?: string;
}

export interface ComputerTask {
  id: string;
  status: "pending" | "running" | "done" | "failed" | string;
  progress: string | null;
  result_text: string | null;
  files: ComputerFile[];
  error: string | null;
  prompt: string;
  live_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  provider_session_id?: string | null;
}

export interface ComputerEvent {
  id: string;
  title: string;
  detail: string | null;
  url: string | null;
  created_at: string;
  kind?: string | null;
  duration?: number | null;
  screenshot_url?: string | null;
}


const SIGN_IN_MESSAGE = "سجّل الدخول أولاً لتشغيل مهام الكمبيوتر. / Please sign in to run computer tasks.";

// The single agent (Browser Use Cloud, DeepSeek) is served by `media-video`
// under `kind: "agent"`.
const SUPABASE_ANON_KEY = edgeAnonKey("media-video");
const COMPUTER_AGENT_URL = edgeUrl("media-video");


async function call<T>(body: Record<string, unknown>): Promise<T> {
  let { data: sess } = await supabase.auth.getSession();
  let token = sess.session?.access_token;
  if (!token) {
    // Session may still be rehydrating or the access token expired.
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed.session?.access_token;
  }
  if (!token) {
    // Visitors who have not signed up still get the agent: a throwaway
    // anonymous identity carries the same RLS scoping without a signup wall.
    const { data: anon } = await supabase.auth.signInAnonymously();
    token = anon.session?.access_token;
  }
  if (!token) throw new Error(SIGN_IN_MESSAGE);

  const resp = await fetch(COMPUTER_AGENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      ...body,
      // Local time lets the agent schedule reminders in the user's own clock.
      ...(typeof (body as { prompt?: unknown }).prompt === "string"
        ? { prompt: `[user local time: ${localNow()}]\n${(body as { prompt: string }).prompt}` }
        : {}),
      kind: "agent",
    }),
  });
  const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (resp.status === 401) throw new Error(SIGN_IN_MESSAGE);
  if (!resp.ok) {
    const code = typeof data.error === "string" ? data.error : `HTTP ${resp.status}`;
    const detail = typeof data.message === "string" ? data.message : null;
    throw new Error(computerErrorMessage(code, detail));
  }
  return data as T;

}

export function createComputerTask(input: {
  prompt: string;
  conversation_id?: string | null;
  message_id?: string | null;
  attachments?: string[];
}) {
  return call<{ task_id: string; status: string; error?: string; message?: string }>({
    action: "create",
    ...input,
  });
}

/**
 * Polls a task and — when the provider reports a terminal state — writes that
 * state back onto the `computer_tasks` row.
 *
 * The poll response is transient: the deployed function reads the provider live
 * but leaves the row on `running`, so a task that really finished stayed
 * "running" forever in the database. Anything that reads the row instead of
 * polling (reopened conversations, usage, background continuation) then saw a
 * task that never ends. Persisting here keeps the row authoritative and can
 * only ever move a task forward: `done`/`failed` are written once, never back.
 */
export async function pollComputerTask(taskId: string) {
  const res = await call<{ task: ComputerTask; events: ComputerEvent[] }>({
    action: "poll",
    task_id: taskId,
  });
  void persistTerminalState(res.task);
  return res;
}

/**
 * Reads a task and its steps straight from the database.
 *
 * Reopening a conversation must never depend on the provider still knowing
 * about a session that already finished — that is what made finished results
 * (text, files and the whole step list) vanish on re-entry. The stored row is
 * rendered first, and the live poll only continues for tasks still running.
 */
export async function loadStoredComputerTask(
  taskId: string,
): Promise<{ task: ComputerTask; events: ComputerEvent[] } | null> {
  try {
    const [{ data: row }, { data: rows }] = await Promise.all([
      supabase.from("computer_tasks").select("*").eq("id", taskId).maybeSingle(),
      supabase
        .from("computer_events")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true }),
    ]);
    if (!row) return null;
    const r = row as Record<string, any>;
    const files = Array.isArray(r.files) ? (r.files as ComputerFile[]) : [];
    const task: ComputerTask = {
      id: r.id,
      status: r.status,
      progress: typeof r.progress === "string" ? r.progress : null,
      result_text: r.result_text ?? null,
      files,
      error: r.error ?? null,
      prompt: r.prompt ?? "",
      live_url: null,
      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,
      provider_session_id: r.provider_session_id ?? null,
    };
    const events: ComputerEvent[] = ((rows as Record<string, any>[]) || []).map((e) => ({
      id: e.id,
      title: e.title ?? "",
      detail: e.detail ?? null,
      url: e.url ?? null,
      created_at: e.created_at,
      kind: e.kind ?? null,
      duration: e.duration ?? null,
      screenshot_url: e.screenshot_url ?? null,
    }));
    return { task, events };
  } catch {
    return null;
  }
}

const persisted = new Set<string>();

async function persistTerminalState(task: ComputerTask | null | undefined) {
  if (!task?.id) return;
  const terminal = task.status === "done" || task.status === "failed";
  if (!terminal || persisted.has(task.id)) return;
  persisted.add(task.id);
  try {
    const { data } = await supabase
      .from("computer_tasks")
      .select("status")
      .eq("id", task.id)
      .maybeSingle();
    const current = (data as { status?: string } | null)?.status;
    if (!current || current === "done" || current === "failed") return;
    await supabase
      .from("computer_tasks")
      .update({
        status: task.status,
        result_text: task.result_text ?? null,
        error: task.error ?? null,
        // Produced files were only ever held in the live poll response, so a
        // reopened conversation lost them. They are part of the result.
        ...(task.files?.length ? { files: task.files as unknown as never } : {}),
      })
      .eq("id", task.id);
  } catch {
    // Best-effort bookkeeping: the live poll already drives the UI.
    persisted.delete(task.id);
  }
}

export function stopComputerTask(taskId: string) {
  return call<{ ok: boolean }>({ action: "stop", task_id: taskId });
}

/** Human-friendly message for backend failure codes (no provider names). */
export function computerErrorMessage(
  code: string | null | undefined,
  providerMessage?: string | null,
): string {
  switch (code) {
    case "no_capacity":
      return "Computer agent is unavailable right now. Please try again shortly.";
    case "rate_limited":
      return "Too many computer tasks at once — try again in a minute.";
    case "agent_plan_locked":
      return (
        providerMessage?.trim() ||
        "Browser Use has blocked the selected DeepSeek model for the configured API keys."
      );
    case "stopped":
      return "Task stopped.";
    case "provider_error":
      return providerMessage?.trim() || "The computer task couldn't be started. Please try again.";
    default:
      return providerMessage?.trim() || code || "";
  }
}

function localNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const day = d.toLocaleDateString("en-US", { weekday: "long" });
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())} (${day})`;
}
