/** @doc Bridge to the Ceyo Android app (WebView JavascriptInterface `MegsyAndroid`).
 *  Real alarms/reminders are scheduled on the phone; the push token is stored per user.
 *  See docs/android-bridge.md for the native side. No-ops in a normal browser. */
import { supabase } from "@/integrations/supabase/legacyClient";

type NativeApi = {
  scheduleAlarm?: (json: string) => void;
  scheduleReminder?: (json: string) => void;
  cancel?: (id: string) => void;
  requestPushToken?: () => void;
};

declare global {
  interface Window {
    MegsyAndroid?: NativeApi;
    megsyNativePushToken?: (token: string) => void;
  }
}

export type NativeTask = { id: string; title: string; kind: string | null; remind_at: string | null; status?: string | null };

function api(): NativeApi | null {
  return typeof window !== "undefined" && window.MegsyAndroid ? window.MegsyAndroid : null;
}

export const isNativeApp = () => !!api();

/** Schedule (or reschedule) a task on the phone. Done/past/timeless tasks get cancelled. */
export function syncNativeTask(t: NativeTask): void {
  const a = api();
  if (!a) return;
  try {
    const at = t.remind_at ? new Date(t.remind_at).getTime() : 0;
    if (!at || at < Date.now() || t.status === "done") {
      a.cancel?.(t.id);
      return;
    }
    const payload = JSON.stringify({ id: t.id, title: t.title, at, path: "/tasks" });
    if (t.kind === "alarm") a.scheduleAlarm?.(payload);
    else a.scheduleReminder?.(payload);
  } catch {
    /* ignore bridge errors */
  }
}

export function cancelNativeTask(id: string): void {
  try {
    api()?.cancel?.(id);
  } catch {
    /* ignore */
  }
}

async function saveToken(token: string) {
  if (!token) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase
    .from("device_push_tokens")
    .upsert({ user_id: data.user.id, token, platform: "android", last_seen_at: new Date().toISOString() }, { onConflict: "token" });
}

/** Call once after sign-in: registers the push token and re-syncs upcoming tasks to the phone. */
export async function bootNativeBridge(): Promise<void> {
  const a = api();
  if (!a) return;
  window.megsyNativePushToken = (token) => void saveToken(token);
  try {
    a.requestPushToken?.();
  } catch {
    /* ignore */
  }
  const { data } = await supabase
    .from("life_tasks")
    .select("id,title,kind,remind_at,status")
    .neq("status", "done")
    .gt("remind_at", new Date().toISOString())
    .limit(100);
  for (const t of data ?? []) syncNativeTask(t);
}
