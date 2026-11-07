import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-kashier-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++)
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

function signedKeys(data: Record<string, unknown>) {
  return Array.isArray(data.signatureKeys)
    ? (data.signatureKeys as unknown[])
        .filter((key): key is string => typeof key === "string")
        .sort()
    : [];
}

/** Kashier docs sign the raw (unencoded) string; older code encoded values. Accept both. */
async function matchesSignature(secret: string, pairs: Array<[string, unknown]>, signature: string) {
  if (!signature || !pairs.length) return false;
  const raw = pairs.map(([k, v]) => `${k}=${String(v ?? "")}`).join("&");
  const encoded = pairs.map(([k, v]) => `${k}=${encodeURIComponent(String(v ?? ""))}`).join("&");
  const sig = signature.toLowerCase();
  for (const candidate of [raw, encoded]) {
    if (safeEqual((await hmacHex(secret, candidate)).toLowerCase(), sig)) return true;
  }
  return false;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const paymentKey = (
    Deno.env.get("KASHIER_API_KEY") ||
    Deno.env.get("KASHIER_PAYMENT_API_KEY") ||
    Deno.env.get("KASHIER_SECRET")
  )?.trim();
  if (!paymentKey) return json({ error: "Kashier is not configured" }, 503);

  let event: Record<string, unknown>;
  try {
    event = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  let data: Record<string, unknown>;
  if (event.type === "redirect" && event.params && typeof event.params === "object") {
    // The buyer's browser forwards Kashier's signed redirect query in the background.
    // The signature (made with our secret key) is the proof, not the browser.
    const params = event.params as Record<string, unknown>;
    const pairs = Object.entries(params).filter(([k]) => k !== "signature" && k !== "mode");
    if (!(await matchesSignature(paymentKey, pairs, String(params.signature ?? "").trim()))) {
      console.error("kashier redirect: invalid signature", params.merchantOrderId);
      return json({ error: "invalid signature" }, 401);
    }
    data = { ...params, status: params.paymentStatus };
  } else {
    data = (event.data ?? {}) as Record<string, unknown>;
    const signature = request.headers.get("x-kashier-signature")?.trim() ?? "";
    const pairs = signedKeys(data).map((k) => [k, data[k]] as [string, unknown]);
    if (!(await matchesSignature(paymentKey, pairs, signature))) {
      console.error("kashier webhook: invalid signature", data.merchantOrderId, event.event);
      return json({ error: "invalid signature" }, 401);
    }
  }

  const orderId = String(data.merchantOrderId ?? data.orderId ?? "");
  if (!orderId) return json({ error: "missing order id" }, 400);

  const status = String(data.status ?? "").toUpperCase();
  const nextStatus =
    status === "SUCCESS" || status === "PAID"
      ? "paid"
      : status === "FAILURE" || status === "FAILED" || status === "DECLINED" || status === "REJECT"
        ? "failed"
        : "pending";

  // Keep checkout metadata (interval, sku, trial) that fulfilment reads from raw.
  const { data: existing } = await admin
    .from("kashier_orders")
    .select("raw")
    .eq("order_id", orderId)
    .maybeSingle();
  const prevRaw = (existing?.raw && typeof existing.raw === "object" ? existing.raw : {}) as Record<string, unknown>;

  const { data: updated, error } = await admin
    .from("kashier_orders")
    .update({
      status: nextStatus,
      kashier_ref: String(data.transactionId ?? data.kashierOrderId ?? "") || null,
      raw: { ...prevRaw, ...event, interval: prevRaw.interval, sku: prevRaw.sku, trial_days: prevRaw.trial_days },
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", orderId)
    .neq("status", "paid")
    .select("id, status, amount, currency, credits, plan, user_id")
    .maybeSingle();

  if (error) {
    console.error("kashier order update failed", orderId, error.message);
    return json({ error: error.message }, 500);
  }
  console.log("kashier order", orderId, status, "->", updated?.status ?? "unchanged");

  // The saved card (returned with the payment when card.save was sent) is what
  // the renewal engine charges every month, so keep it on the subscription.
  if (updated && nextStatus === "paid") {
    const saved = data as Record<string, any>;
    const cardToken = String(
      saved.cardDataToken ??
        saved.cardToken ??
        saved.response?.paymentMethod?.card?.cardToken ??
        "",
    ).trim();
    const agreementId = String(
      saved.cardAgreementId ?? saved.agreementId ?? saved.agreement?.id ?? "",
    ).trim();
    const masked = String(
      saved.maskedCard ?? saved.response?.paymentMethod?.card?.number ?? "",
    ).trim();
    if (cardToken) {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("id")
        .eq("user_id", updated.user_id as string)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sub?.id) {
        await admin
          .from("subscriptions")
          .update({
            card_token: cardToken,
            card_agreement_id: agreementId || null,
            card_masked: masked || null,
            renewal_failures: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);
      }
    }
  }

  // The browser copy of CompletePayment only fires when the buyer actually
  // lands back on the success page. This server copy is authoritative and
  // shares the same event_id, so TikTok deduplicates the two.
  if (updated && nextStatus === "paid") {
    await sendTikTokPurchase({
      eventId: orderId,
      contentId: updated.plan ? `plan:${updated.plan}` : `credits:${updated.credits}`,
      value: Number(updated.amount),
      currency: String(updated.currency || "EGP"),
      productName: updated.plan ? `${updated.plan} Plan` : `${updated.credits} MC top-up`,
      userId: updated.user_id as string | null,
      email: (data.customerEmail ?? null) as string | null,
      phone: (data.customerPhone ?? null) as string | null,
    });
  }

  return json({ ok: true, order_id: orderId, status: updated?.status ?? "unchanged" });
});

const TIKTOK_PIXEL_ID = "DAKS6DRC77UES9754TBG";
const TIKTOK_ENDPOINT = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** TikTok wants E.164 without "+" or separators. */
function normalizePhone(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  // Local Egyptian numbers (01xxxxxxxxx) carry no country code.
  if (digits.startsWith("01") && digits.length === 11) return `2${digits}`;
  return digits;
}

async function sendTikTokPurchase(input: {
  eventId: string;
  contentId: string;
  value: number;
  currency: string;
  productName: string;
  userId: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const token = Deno.env.get("TIKTOK_EVENTS_ACCESS_TOKEN")?.trim();
  if (!token) return;

  const user: Record<string, string> = {};
  let email = input.email?.trim() || "";
  let phone = input.phone?.trim() || "";

  if (input.userId) {
    user.external_id = await sha256(input.userId);
    try {
      const { data } = await admin.auth.admin.getUserById(input.userId);
      if (!email && data?.user?.email) email = data.user.email;
      const meta = (data?.user?.user_metadata ?? {}) as Record<string, unknown>;
      if (!phone) phone = String(data?.user?.phone || meta.phone || meta.phone_number || "");
    } catch {
      /* identifiers are optional */
    }
  }

  if (email) user.email = await sha256(email);
  const normalizedPhone = phone ? normalizePhone(phone) : "";
  if (normalizedPhone) user.phone = await sha256(normalizedPhone);

  try {
    const response = await fetch(TIKTOK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": token },
      body: JSON.stringify({
        event_source: "web",
        event_source_id: TIKTOK_PIXEL_ID,
        data: [
          {
            event: "CompletePayment",
            event_time: Math.floor(Date.now() / 1000),
            event_id: input.eventId,
            user,
            properties: {
              content_type: "product",
              content_id: input.contentId,
              content_name: input.productName,
              value: Number.isFinite(input.value) ? input.value : undefined,
              currency: input.currency.toUpperCase(),
              contents: [
                {
                  content_id: input.contentId,
                  content_name: input.productName,
                  quantity: 1,
                  price: Number.isFinite(input.value) ? input.value : undefined,
                },
              ],
            },
          },
        ],
      }),
    });
    const text = await response.text();
    if (!response.ok) console.error(`TikTok Events API failed [${response.status}]: ${text}`);
    else console.log(`TikTok Events API accepted ${input.eventId}: ${text}`);
  } catch (err) {
    console.error("TikTok Events API request threw", err);
  }
}
