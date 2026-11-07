// The single Megsy agent: Browser Use Cloud (v2) on the DeepSeek model.
// Served by the media-video function under body.kind === "agent" (new edge
// functions can't be created from this project).
// Actions: create | poll | stop — same response shape as the old computer-agent.
import { noteKeyAttempt, noteKeyFail, noteKeyOk, vaultKeys } from "./_shared/keyVault.ts";

// v4 "runs" API: the only one where DeepSeek (UI name "DeepSeek V4.1 Flash") is free-plan.
const BU = "https://api.browser-use.com/api/v4";
// v4 accepts "deepseek-v4.1-flash" (the dashboard's free "DeepSeek V4.1 Flash").
const LLM = "deepseek-v4.1-flash";
// Tried only if the main model is locked on the account.
const FREE_FALLBACKS = ["deepseek-v4-flash-vision", "glm-5.3-flash", "mimo-v2.6-flash"];
const PROVIDER = "browser-use";

const SYSTEM = `You are Megsy, a general-purpose agent. Decide yourself what the task needs.
- If the answer needs no website, answer directly with the done action; do not open a browser.
- Only browse when the task truly needs live web data or a web interaction.
- When asked to build a website, document, spreadsheet, code or any file, write it as a file and return it.
- Do not generate images or videos yourself.
- Reply in the same language the user wrote in.
- Before any sensitive or irreversible action (sending a message or email, posting, buying or paying, deleting, submitting a form with personal data, signing in to an account), STOP. Do not do it. Finish with the done action, explain briefly, and end your reply with exactly one line: [[APPROVAL: short description of the action]]. Only do it after the user replies "Approved".
- You also manage the user's tasks, reminders, alarms and goals inside the Megsy app. No browser is needed for this. When the user asks to be reminded, add a task, set an alarm or a goal, answer with the done action, confirm briefly, and add one line per item at the end:
  [[TASK: title | YYYY-MM-DDTHH:mm]]  (user's local time, based on the "[user local time: ...]" line; drop "| time" if none)
  [[ALARM: title | YYYY-MM-DDTHH:mm]]
  [[GOAL: title]]
  These lines are saved automatically. Never say you cannot set reminders.`;

async function bu(key: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${BU}${path}`, {
    ...init,
    headers: {
      "X-Browser-Use-API-Key": key,
      "Content-Type": "application/json",
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Browser Use ${res.status}: ${text.slice(0, 300)}`);
    (err as any).providerStatus = res.status;
    throw err;
  }
  return data;
}

function mapStatus(s: string) {
  if (s === "completed" || s === "finished") return "done";
  if (s === "failed" || s === "stopped" || s === "cancelled") return "failed";
  return "running";
}

export async function handleAgent(
  db: any,
  userId: string,
  body: any,
  out: (b: unknown, s?: number) => Response,
) {
  if (body.action === "create") {
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return out({ error: "prompt is required" }, 400);
    const keys = await vaultKeys(PROVIDER);
    if (!keys.length) return out({ error: "no_capacity" }, 503);
    const cost = 1;
    const opKey = String(body?.request_id || crypto.randomUUID());
    const isPromo = Date.now() >= 1791247929000 && Date.now() <= 1791334329000;
    const spent = isPromo ? { data: { success: true } } : await db.rpc("charge_credits_once", {
      p_operation_key: opKey,
      p_user_id: userId,
      p_amount: cost,
      p_action_type: "agent_run",
      p_description: "Megsy agent task",
    });
    if (spent.error || spent.data?.success === false) {
      return out({ error: "insufficient_credits", required_credits: cost, message: "You need at least 1 credit to start an agent task." }, 402);
    }
    const refund = async () => {
      if (isPromo) return;
      await db.rpc("refund_credits_once", { p_operation_key: opKey, p_reason: "Refund for failed agent start" });
    };
    let lastError = "provider_error";
    let planLockedKeys = 0;
    const createRun = async (apiKey: string) => {
      // DeepSeek first; if the plan locks it, fall back to free Browser Use models.
      let err: unknown;
      for (const model of [LLM, ...FREE_FALLBACKS]) {
        try {
          return await bu(apiKey, "/runs", {
            method: "POST",
            body: JSON.stringify({ task: `${SYSTEM}\n\nUser task:\n${prompt}`, model }),
          });
        } catch (e) {
          err = e;
          const st = Number((e as any)?.providerStatus || 500);
          const msg = e instanceof Error ? e.message : "";
          const locked = st === 402 || (st === 403 && /free plan|buy credits|not available/i.test(msg));
          if (!locked && st !== 422 && st !== 400) throw e;
        }
      }
      throw err;
    };
    for (const key of keys) {
      await noteKeyAttempt(key);
      try {
        const task = await createRun(key.key);
        await noteKeyOk(key);
        const { data: row, error } = await db
          .from("computer_tasks")
          .insert({
            user_id: userId,
            prompt,
            status: "running",
            conversation_id: body.conversation_id ?? null,
            message_id: body.message_id ?? null,
            provider_task_id: String(task.id),
            provider_session_id: task.sessionId ? String(task.sessionId) : null,
            provider_key_ref: key.id,
            files: [],
          })
          .select("id")
          .single();
        if (error) {
          await refund();
          return out({ error: error.message }, 500);
        }
        return out({ task_id: row.id, status: "running", estimated_credits: "1–50", credits_charged: cost });
      } catch (e) {
        lastError = e instanceof Error ? e.message : lastError;
        const status = Number((e as any)?.providerStatus || 500);
        // Model/plan errors are tied to the Browser Use project behind this
        // key. Keep trying: another configured key may belong to an eligible
        // project. Never mark a healthy key as depleted for account limits.
        if (status === 403 && /free plan|buy credits|not available/i.test(lastError)) {
          planLockedKeys += 1;
          continue;
        }
        await noteKeyFail(key, lastError, status);
        if (status === 400 || status === 422) break;
      }
    }
    if (planLockedKeys === keys.length) {
      await refund();
      return out(
        {
          error: "agent_plan_locked",
          message:
            "Browser Use allows this DeepSeek model in its dashboard, but every configured API key is blocked from using it through the API.",
        },
        402,
      );
    }
    await refund();
    return out({ error: "provider_error", message: lastError }, 502);
  }

  const { data: row } = await db
    .from("computer_tasks")
    .select("*")
    .eq("id", String(body.task_id || ""))
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return out({ error: "not found" }, 404);
  const key = (await vaultKeys(PROVIDER)).find((k) => k.id === row.provider_key_ref);
  if (!key) return out({ error: "no_capacity" }, 503);

  if (body.action === "stop") {
    await bu(key.key, `/runs/${row.provider_task_id}/cancel`, { method: "POST" }).catch(() => null);
    await db.from("computer_tasks").update({ status: "failed", error: "stopped" }).eq("id", row.id);
    return out({ ok: true });
  }

  const t = await bu(key.key, `/runs/${row.provider_task_id}`);
  const status = mapStatus(String(t?.status || ""));
  const ev = await bu(
    key.key,
    `/runs/${row.provider_task_id}/events?limit=500&include_output=true`,
  ).catch(() => null);
  const steps: any[] = Array.isArray(ev?.events) ? ev.events : [];
  const urlOf = (e: any) => e?.data?.url ?? e?.data?.page_url ?? null;
  // The computer is only shown when the agent actually opened a real page.
  const browsed = steps.some((e) => {
    const u = urlOf(e);
    return u && !/^(about:blank|chrome:)/.test(String(u));
  });
  const sessionId = t?.sessionId ? String(t.sessionId) : row.provider_session_id;

  let liveUrl: string | null = null;
  if (status === "running" && browsed && sessionId) {
    const s = await bu(key.key, `/browsers/${sessionId}`).catch(() => null);
    liveUrl = s?.liveUrl ?? null;
  }

  // Files only when the agent really produced some (workspace files).
  const files: any[] = Array.isArray(row.files) ? row.files : [];
  // The file check is spaced out: at most every ~15s while running, plus once at the end.
  const lastCheck = Date.parse(row.updated_at || row.created_at || "") || 0;
  const dueCheck = status !== "running" || Date.now() - lastCheck > 15_000;
  if (dueCheck && t?.workspaceId) {
    const list = await bu(key.key, `/workspaces/${t.workspaceId}/files`).catch(() => null);
    const seen = new Set(files.map((f: any) => f?.url));
    for (const f of list?.files ?? []) {
      if (f?.url && !seen.has(f.url)) files.push({ name: String(f.path).split("/").pop(), url: f.url });
    }
    if (status === "running")
      await db
        .from("computer_tasks")
        .update({ files, updated_at: new Date().toISOString() })
        .eq("id", row.id);
  }

  const textOf = (e: any) =>
    e?.data?.next_goal ?? e?.data?.nextGoal ?? e?.data?.summary ?? e?.data?.text ?? e?.data?.message ??
    e?.data?.goal ?? e?.data?.title ?? e?.data?.thinking ?? e?.data?.reasoning ?? null;
  // Internal reasoning, streamed through exactly as the provider emits it.
  const thoughtOf = (e: any) => {
    const d = e?.data ?? {};
    const parts = [
      d.thinking ?? d.reasoning,
      d.evaluation_previous_goal ?? d.evaluationPreviousGoal,
      d.memory,
    ].filter((x: unknown) => typeof x === "string" && x.trim());
    const joined = parts.join("\n\n");
    return joined && joined !== textOf(e) ? joined : null;
  };
  const last = [...steps].reverse().find((e) => textOf(e));
  const task = {
    id: row.id,
    status,
    progress: last ? String(textOf(last)) : null,
    result_text:
      status === "done"
        ? String(t?.result ?? (typeof t?.output === "string" ? t.output : JSON.stringify(t?.output ?? "")))
        : null,
    files,
    error: status === "failed" ? String(t?.error || t?.status || "failed") : null,
    prompt: row.prompt,
    live_url: liveUrl,
    created_at: row.created_at,
    updated_at: row.updated_at,
    provider_session_id: browsed ? sessionId : null,
  };
  if (status !== "running")
    await db
      .from("computer_tasks")
      .update({ status, result_text: task.result_text, error: task.error, files })
      .eq("id", row.id)
      .eq("status", "running");

  const events = steps
    .filter((e) => textOf(e))
    .map((e) => ({
      id: `${row.id}-${e.id}`,
      title: String(textOf(e)),
      detail: thoughtOf(e),
      url: browsed ? urlOf(e) : null,
      created_at: e.ts ?? row.created_at,
      kind: browsed ? "browser" : "think",
      duration: null,
      screenshot_url: browsed ? (e?.data?.screenshot_url ?? e?.data?.screenshotUrl ?? null) : null,
    }));
  if (events.length) {
    await db.from("computer_events").upsert(
      events.map((event) => ({
        ...event,
        task_id: row.id,
        user_id: userId,
      })),
      { onConflict: "id" },
    );
  }
  return out({ task, events });
}
