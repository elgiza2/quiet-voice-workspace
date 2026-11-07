/** Called every minute by pg_cron. Sends due reminders/alarms and the daily morning plan
 *  to the user's phones through Firebase Cloud Messaging. Caller must send x-cron-key
 *  matching public.cron_secrets(name='reminders'). */
import { createFileRoute } from "@tanstack/react-router";

const FCM = "https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function sendToUser(admin: Admin, userId: string, title: string, body: string, data: Record<string, string>) {
  const lovable = process.env["LOVABLE_API_KEY"];
  const conn = process.env["FIREBASE_MESSAGING_API_KEY"];
  if (!lovable || !conn) return "not_configured";
  const { data: toks } = await admin.from("device_push_tokens").select("token").eq("user_id", userId).limit(10);
  let sent = 0;
  for (const { token } of toks ?? []) {
    const res = await fetch(FCM, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": conn, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data,
          android: { priority: "high", notification: { channel_id: data.kind === "alarm" ? "megsy_alarms" : "megsy_reminders" } },
        },
      }),
    });
    if (res.ok) sent++;
    else {
      const txt = await res.text();
      if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(txt)) await admin.from("device_push_tokens").delete().eq("token", token);
      else console.error(`FCM send failed [${res.status}]: ${txt}`);
    }
  }
  return sent;
}

function localParts(tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}

async function morningText(tasks: string[], goals: string[]) {
  const fallback = tasks.length ? `النهارده عندك: ${tasks.slice(0, 4).join("، ")}` : "يومك فاضي — قولّي عايز تنجز إيه النهارده.";
  const key = process.env["LOVABLE_API_KEY"];
  if (!key || (!tasks.length && !goals.length)) return fallback;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: `اكتب إشعار صباحي قصير جدًا (جملتين بحد أقصى، أقل من 180 حرف) بالعامية المصرية يلخّص يوم المستخدم ويشجعه. مهام النهارده: ${tasks.join(" | ") || "لا يوجد"}. أهدافه: ${goals.join(" | ") || "لا يوجد"}. اكتب النص بس.`,
      }),
    });
    if (!res.ok) return fallback;
    const j = (await res.json()) as { output_text?: string; output?: { content?: { text?: string }[] }[] };
    const text = j.output_text || j.output?.flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("") || "";
    return text.trim().slice(0, 240) || fallback;
  } catch {
    return fallback;
  }
}

export const Route = createFileRoute("/api/public/reminders-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
        const key = request.headers.get("x-cron-key") || "";
        const { data: sec } = await admin.from("cron_secrets").select("secret").eq("name", "reminders").maybeSingle();
        if (!sec?.secret || key !== sec.secret) return new Response("Unauthorized", { status: 401 });

        const now = new Date().toISOString();
        // Claim due reminders atomically so overlapping runs never double-send.
        const { data: due } = await admin
          .from("scheduled_nudges")
          .update({ push_sent_at: now })
          .is("push_sent_at", null)
          .lte("run_at", now)
          .gte("run_at", new Date(Date.now() - 6 * 3600_000).toISOString())
          .select("id,user_id,task_id,kind,title,body")
          .limit(200);
        let reminders = 0;
        for (const n of due ?? []) {
          const r = await sendToUser(admin, n.user_id, (n.kind === "alarm" ? "⏰ " : "🔔 ") + n.title, n.body || "ميغسي بتفكّرك", {
            kind: n.kind || "task",
            task_id: n.task_id || "",
            path: "/tasks",
          });
          if (typeof r === "number") reminders += r;
        }

        // Morning plan
        const { data: users } = await admin.from("life_settings").select("user_id,morning_time,tz,last_morning_date").eq("morning_enabled", true).limit(500);
        let mornings = 0;
        for (const u of users ?? []) {
          if (mornings >= 50) break;
          const { date, hm } = localParts(u.tz || "Africa/Cairo");
          if (hm < u.morning_time || u.last_morning_date === date) continue;
          await admin.from("life_settings").update({ last_morning_date: date }).eq("user_id", u.user_id);
          const [tk, gl] = await Promise.all([
            admin.from("life_tasks").select("title").eq("user_id", u.user_id).neq("status", "done").limit(8),
            admin.from("life_goals").select("title").eq("user_id", u.user_id).eq("done", false).limit(5),
          ]);
          const body = await morningText((tk.data ?? []).map((x) => x.title), (gl.data ?? []).map((x) => x.title));
          await sendToUser(admin, u.user_id, "☀️ صباح الخير", body, { kind: "morning", path: "/tasks" });
          mornings++;
        }
        return Response.json({ ok: true, reminders, mornings, fcm: !!process.env["FIREBASE_MESSAGING_API_KEY"] });
      },
    },
  },
});
