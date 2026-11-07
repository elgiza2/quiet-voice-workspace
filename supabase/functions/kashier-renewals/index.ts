/**
 * @doc Monthly auto-renew engine (runs on a schedule through pg_cron).
 *
 *   • charges due subscriptions with the saved card through Kashier's
 *     Pay with Token API (CONTAUTH), once per billing cycle;
 *   • a successful charge flips the order to `paid`, which fires the existing
 *     fulfilment triggers (credits + a fresh period on the subscription);
 *   • a declined card marks the subscription past_due and, after three failed
 *     cycles, switches auto-renew off instead of charging forever;
 *   • subscriptions the customer stopped renewing expire and drop back to free.
 *
 * The saved card is read from the subscription, or recovered from the paid order
 * that carried it (cardDataToken on the redirect / webhook payload).
 * Call with `?dry=1` to see what it would do without charging anything.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

type SubRow = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
  card_token: string | null;
  card_agreement_id: string | null;
  renewal_failures: number | null;
};

/** The saved card: on the subscription, or inside the order that stored it. */
async function resolveCard(
  sub: SubRow,
  dry: boolean,
): Promise<{ token: string; agreement: string | null } | null> {
  if (sub.card_token) return { token: sub.card_token, agreement: sub.card_agreement_id ?? null };

  const { data: rows } = await admin
    .from("kashier_orders")
    .select("order_id,raw")
    .eq("user_id", sub.user_id)
    .eq("status", "paid")
    .not("plan", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);

  for (const row of rows ?? []) {
    const raw = (row.raw ?? {}) as Record<string, any>;
    const holders = [raw, raw.params, raw.data, raw.response];
    const pick = (...keys: string[]) => {
      for (const holder of holders) {
        if (!holder || typeof holder !== "object") continue;
        for (const key of keys) {
          const value = String((holder as Record<string, unknown>)[key] ?? "").trim();
          if (value) return value;
        }
      }
      return "";
    };
    const token =
      pick("cardDataToken", "cardToken") ||
      String(raw?.response?.paymentMethod?.card?.cardToken ?? "").trim();
    if (!token) continue;
    const agreement = pick("cardAgreementId", "agreementId") || null;
    const masked = pick("maskedCard") || null;
    if (!dry)
      await admin
        .from("subscriptions")
        .update({ card_token: token, card_agreement_id: agreement, card_masked: masked })
        .eq("id", sub.id);
    return { token, agreement };
  }
  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { data: secretRow } = await admin
    .from("app_cron_secrets")
    .select("value")
    .eq("name", "renewals")
    .maybeSingle();
  const expected = String(secretRow?.value ?? "").trim();
  const provided = (request.headers.get("x-cron-secret") || "").trim();
  if (!expected || provided !== expected) return json({ error: "unauthorized" }, 401);

  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 25) || 25, 1), 50);

  const merchantId = Deno.env.get("KASHIER_MERCHANT_ID")?.trim();
  const paymentKey = (
    Deno.env.get("KASHIER_PAYMENT_API_KEY") || Deno.env.get("KASHIER_API_KEY")
  )?.trim();
  const mode =
    (Deno.env.get("KASHIER_MODE") || "live").trim().toLowerCase() === "test" ? "test" : "live";
  const fepBase = mode === "test" ? "https://test-fep.kashier.io" : "https://fep.kashier.io";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const siteUrl = (Deno.env.get("SITE_URL") || "https://megsyai.com").replace(/\/$/, "");
  if (!merchantId || !paymentKey || !supabaseUrl)
    return json({ error: "Kashier credentials are not configured" }, 503);

  const webhookUrl = `${supabaseUrl}/functions/v1/kashier-webhook`;
  const nowIso = new Date().toISOString();
  const results: Record<string, unknown[]> = { expired: [], charged: [], failed: [], skipped: [] };

  /* 1 ── plans the customer stopped renewing end when their period ends ---- */
  const { data: expiring } = await admin
    .from("subscriptions")
    .select("id,user_id,plan,current_period_end")
    .eq("auto_renew", false)
    .in("status", ["active", "trialing", "past_due"])
    .not("current_period_end", "is", null)
    .lte("current_period_end", nowIso)
    .limit(limit);

  for (const sub of expiring ?? []) {
    if (dry) {
      results.expired.push({ subscription: sub.id, user: sub.user_id, dry: true });
      continue;
    }
    await admin
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", sub.id);
    const { data: other } = await admin
      .from("subscriptions")
      .select("id")
      .eq("user_id", sub.user_id)
      .eq("status", "active")
      .neq("id", sub.id)
      .limit(1);
    if (!other?.length)
      await admin
        .from("profiles")
        .update({ plan: "free", updated_at: new Date().toISOString() })
        .eq("id", sub.user_id);
    results.expired.push({ subscription: sub.id, user: sub.user_id });
  }

  /* 2 ── charge what is due ------------------------------------------------ */
  const { data: due } = await admin
    .from("subscriptions")
    .select(
      "id,user_id,plan,status,current_period_end,card_token,card_agreement_id,renewal_failures",
    )
    .eq("auto_renew", true)
    .in("status", ["active", "trialing", "past_due"])
    .not("current_period_end", "is", null)
    .lte("current_period_end", nowIso)
    .order("current_period_end", { ascending: true })
    .limit(limit);

  for (const sub of (due ?? []) as SubRow[]) {
    // One attempt per cycle: never charge twice for the same period.
    const since = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const { data: recent } = await admin
      .from("kashier_orders")
      .select("order_id,status,created_at")
      .eq("user_id", sub.user_id)
      .gte("created_at", since)
      .contains("raw", { renewal_for: sub.id })
      .limit(1);
    if (recent?.length) {
      results.skipped.push({ subscription: sub.id, reason: "already attempted this cycle" });
      continue;
    }

    // Price the cycle exactly like the plan the customer bought.
    const { data: last } = await admin
      .from("kashier_orders")
      .select("amount,currency,credits,plan,raw")
      .eq("user_id", sub.user_id)
      .eq("status", "paid")
      .not("plan", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const amount = Number(last?.amount ?? 0);
    if (!last || !Number.isFinite(amount) || amount <= 0) {
      results.skipped.push({ subscription: sub.id, reason: "no previous plan payment" });
      continue;
    }

    const card = await resolveCard(sub, dry);
    if (!card) {
      results.skipped.push({ subscription: sub.id, reason: "no saved card" });
      continue;
    }

    const raw = (last.raw ?? {}) as Record<string, unknown>;
    const interval = String(raw.interval ?? "monthly") === "yearly" ? "yearly" : "monthly";
    const currency = String(last.currency || "EGP");
    const orderId = `ren_${crypto.randomUUID()}`;

    if (dry) {
      results.charged.push({
        subscription: sub.id,
        user: sub.user_id,
        order_id: orderId,
        amount,
        currency,
        interval,
        dry: true,
      });
      continue;
    }

    const { error: insertError } = await admin.from("kashier_orders").insert({
      order_id: orderId,
      user_id: sub.user_id,
      amount,
      currency,
      credits: Number(last.credits ?? 0),
      plan: last.plan,
      method: "card",
      status: "pending",
      raw: {
        interval,
        provider: "kashier",
        renewal: true,
        renewal_for: sub.id,
        saved_card: card.agreement ? "agreement" : "token",
      },
    });
    if (insertError) {
      results.failed.push({ subscription: sub.id, reason: insertError.message });
      continue;
    }

    const hash = await hmacHex(
      paymentKey,
      `/?payment=${merchantId}.${orderId}.${amount}.${currency}.${sub.user_id}`,
    );
    const cardPayload: Record<string, unknown> = { enable3DS: false, cardToken: card.token };
    if (card.agreement) cardPayload.agreement = { id: card.agreement };

    let parsed: Record<string, any> = {};
    let status = 0;
    try {
      const response = await fetch(`${fepBase}/v3/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "kashier-hash": hash },
        body: JSON.stringify({
          apiOperation: "PAY",
          paymentMethod: { type: "CARD", card: cardPayload },
          order: { reference: orderId, amount: String(amount), currency },
          interactionSource: "CONTAUTH",
          reconciliation: {
            webhookUrl,
            merchantRedirect: `${siteUrl}/billing/success?provider=kashier&order=${encodeURIComponent(orderId)}`,
          },
          merchantId,
          customer: { reference: sub.user_id },
        }),
      });
      status = response.status;
      const text = await response.text();
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text.slice(0, 300) };
      }
    } catch (cause) {
      results.failed.push({
        subscription: sub.id,
        reason: cause instanceof Error ? cause.message : "network error",
      });
      continue;
    }

    const paid =
      parsed?.status === "SUCCESS" &&
      (parsed?.response?.result === "SUCCESS" || parsed?.response?.status === "CAPTURED");

    if (paid) {
      // Flipping the order to paid runs the same fulfilment path as a manual buy.
      await admin
        .from("kashier_orders")
        .update({
          status: "paid",
          kashier_ref: String(parsed?.response?.transactionId ?? "") || null,
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", orderId)
        .neq("status", "paid");
      await admin
        .from("subscriptions")
        .update({ status: "active", renewal_failures: 0, updated_at: new Date().toISOString() })
        .eq("id", sub.id);
      results.charged.push({ subscription: sub.id, order_id: orderId, amount, currency });
      continue;
    }

    const reason =
      parsed?.messages?.en ||
      parsed?.response?.transactionResponseMessage?.en ||
      parsed?.message ||
      `Kashier declined the charge (${status}).`;
    const failures = Number(sub.renewal_failures ?? 0) + 1;
    await admin
      .from("kashier_orders")
      .update({
        status: "failed",
        raw: { ...parsed, renewal_for: sub.id },
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .neq("status", "paid");
    await admin
      .from("subscriptions")
      .update({
        status: "past_due",
        renewal_failures: failures,
        // Stop retrying after three cycles so nobody gets charged forever.
        auto_renew: failures < 3,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
    results.failed.push({ subscription: sub.id, order_id: orderId, reason, failures });
  }

  return json({ ok: true, mode, dry, at: nowIso, ...results });
});
