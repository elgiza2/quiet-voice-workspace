/** Telegram bot for the app's service keys (Cerebras / Browserbase / Composio).
 *  Only Telegram (verified by the webhook secret header) can call it, and only
 *  the configured owner account can add, list or remove keys. Keys go to the
 *  server-only `provider_api_keys` pool that the app reads at runtime.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

export function telegramWebhookSecret(token: string) {
  return createHash("sha256").update(`megsy-keys:${token}`).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

type ProviderId = "cerebras" | "browserbase" | "composio";
const PROVIDERS: Record<ProviderId, { label: string; icon: string; use: string }> = {
  cerebras: { label: "Cerebras", icon: "🧠", use: "ردود الوكلاء" },
  browserbase: { label: "Browserbase", icon: "🌐", use: "الكمبيوتر وتصفح الويب" },
  composio: { label: "Composio", icon: "🔌", use: "التكاملات الخارجية" },
};
const IDS = Object.keys(PROVIDERS) as ProviderId[];

export function normalizeProvider(raw: string): ProviderId | null {
  const v = raw.trim().toLowerCase();
  if (v === "cerebras" || v === "c") return "cerebras";
  if (v === "browserbase" || v === "browser" || v === "b") return "browserbase";
  if (v === "composio" || v === "x") return "composio";
  return null;
}

async function validateKey(p: ProviderId, key: string): Promise<boolean> {
  try {
    const res =
      p === "cerebras"
        ? await fetch("https://api.cerebras.ai/v1/models", { headers: { Authorization: `Bearer ${key}` } })
        : p === "browserbase"
          ? await fetch("https://api.browserbase.com/v1/projects", { headers: { "X-BB-API-Key": key } })
          : await fetch("https://backend.composio.dev/api/v3/auth_configs?limit=1", { headers: { "x-api-key": key } });
    return res.ok;
  } catch {
    return false;
  }
}

const HELP = [
  "🔑 <b>مفاتيح الخدمات</b>",
  "",
  ...IDS.map((id) => `${PROVIDERS[id].icon} <b>${PROVIDERS[id].label}</b> — ${PROVIDERS[id].use}`),
  "",
  "اضغط على الخدمة وابعت المفتاح، أو مباشرة:",
  "<code>/add_cerebras KEY</code>",
  "<code>/add_browserbase KEY</code>",
  "<code>/add_composio KEY</code>",
  "",
  "/keys — عرض المفاتيح",
  "/del رقم — حذف مفتاح",
].join("\n");

const menu = () => ({
  inline_keyboard: [
    IDS.map((id) => ({ text: `${PROVIDERS[id].icon} ${PROVIDERS[id].label}`, callback_data: `keys:provider:${id}` })),
    [{ text: "📊 المفاتيح الحالية", callback_data: "keys:list" }],
  ],
});

const pendingProvider = new Map<number, ProviderId>();

export const Route = createFileRoute("/api/public/telegram-keys")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getTelegramBotToken, telegramRequest } = await import("@/lib/keys/telegram.server");
        const token = await getTelegramBotToken().catch(() => null);
        if (!token) return new Response("not configured", { status: 500 });
        const header = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(header, telegramWebhookSecret(token))) return new Response("Unauthorized", { status: 401 });

        const update = await request.json().catch(() => null);
        const tg = (method: string, body: unknown) => telegramRequest(token, method, body);
        const send = (chatId: number, text: string, markup?: unknown) =>
          tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...(markup ? { reply_markup: markup } : {}) });

        const owners = (process.env.TELEGRAM_ADMIN_IDS || "6657246146").split(",").map((v) => Number(v.trim())).filter(Boolean);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;

        const listKeys = async () => {
          const { data } = await db
            .from("provider_api_keys")
            .select("id,provider,api_key,status,cooldown_until,created_at")
            .order("created_at", { ascending: true });
          return (data ?? []) as Array<{ id: string; provider: ProviderId; api_key: string; status: string; cooldown_until: string | null }>;
        };
        const showKeys = async (chatId: number) => {
          const rows = await listKeys();
          const lines = ["📊 <b>المفاتيح الحالية</b>", ""];
          IDS.forEach((id) => {
            const mine = rows.filter((r) => r.provider === id);
            lines.push(`${PROVIDERS[id].icon} <b>${PROVIDERS[id].label}</b> (${mine.length})`);
            if (!mine.length) lines.push("   — لا يوجد");
          });
          lines.push("");
          rows.forEach((r, i) => {
            const state = r.status !== "active" ? "⛔" : r.cooldown_until && new Date(r.cooldown_until) > new Date() ? "⏳" : "✅";
            lines.push(`${i + 1}. ${state} ${PROVIDERS[r.provider]?.label ?? r.provider}`);
          });
          if (rows.length) lines.push("", "للحذف: <code>/del رقم</code>");
          await send(chatId, lines.join("\n"), menu());
        };
        const addKey = async (chatId: number, p: ProviderId, key: string) => {
          if (key.length < 12 || /\s/.test(key)) return send(chatId, "ده مش شكل مفتاح صحيح ❌");
          await send(chatId, "⏳ بتأكد من المفتاح…");
          if (!(await validateKey(p, key))) return send(chatId, `المفتاح مرفوض من ${PROVIDERS[p].label} ❌`);
          const { error } = await db.from("provider_api_keys").upsert(
            { provider: p, api_key: key, status: "active", failure_count: 0, last_error: null, cooldown_until: null },
            { onConflict: "provider,api_key" },
          );
          if (error) return send(chatId, "حصلت مشكلة في الحفظ ❌");
          return send(chatId, `${PROVIDERS[p].icon} اتحفظ مفتاح ${PROVIDERS[p].label} ✅\nشغال فورًا في التطبيق.`, menu());
        };

        const callback = update?.callback_query;
        if (callback) {
          const fromId = Number(callback?.from?.id);
          const chatId = Number(callback?.message?.chat?.id);
          const data = String(callback?.data ?? "");
          await tg("answerCallbackQuery", { callback_query_id: callback.id }).catch(() => undefined);
          if (!chatId || !owners.includes(fromId) || callback?.message?.chat?.type !== "private") return Response.json({ ok: true });
          if (data === "keys:list") await showKeys(chatId);
          const picked = data.startsWith("keys:provider:") ? normalizeProvider(data.slice(14)) : null;
          if (picked) {
            pendingProvider.set(fromId, picked);
            await send(chatId, `${PROVIDERS[picked].icon} <b>${PROVIDERS[picked].label}</b>\n\nابعت المفتاح دلوقتي كرسالة، أو:\n<code>/add_${picked} KEY</code>`);
          }
          return Response.json({ ok: true });
        }

        const msg = update?.message;
        const chatId = Number(msg?.chat?.id);
        const fromId = Number(msg?.from?.id);
        const text = String(msg?.text ?? "").trim();
        if (!chatId || !fromId || !text) return Response.json({ ok: true });
        if (!owners.includes(fromId) || msg?.chat?.type !== "private") {
          await send(chatId, "غير مسموح.");
          return Response.json({ ok: true });
        }
        // Remove the message that carried a key from the chat history.
        const dropMessage = () => tg("deleteMessage", { chat_id: chatId, message_id: msg.message_id }).catch(() => undefined);

        const add = text.match(/^\/add_([a-z]+)(?:@\w+)?\s+(\S+)$/i);
        const del = text.match(/^\/del(?:@\w+)?\s+(\d+)$/i);
        if (add) {
          const p = normalizeProvider(add[1]);
          await dropMessage();
          if (!p) await send(chatId, "الخدمة دي مش معروفة.", menu());
          else await addKey(chatId, p, add[2]);
        } else if (del) {
          const rows = await listKeys();
          const row = rows[Number(del[1]) - 1];
          if (!row) await send(chatId, "الرقم ده مش موجود.");
          else {
            await db.from("provider_api_keys").delete().eq("id", row.id);
            await send(chatId, `اتحذف ${PROVIDERS[row.provider]?.label ?? row.provider} ✅`);
          }
        } else if (/^\/keys/i.test(text)) {
          await showKeys(chatId);
        } else if (!text.startsWith("/") && pendingProvider.has(fromId)) {
          const p = pendingProvider.get(fromId);
          pendingProvider.delete(fromId);
          await dropMessage();
          if (p) await addKey(chatId, p, text);
        } else {
          await send(chatId, HELP, menu());
        }
        return Response.json({ ok: true });
      },
    },
  },
});
