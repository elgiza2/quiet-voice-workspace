import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

interface CatalogRow {
  tier: string;
  interval: string;
  base_interval: string;
  usd_price: number;
  egp_price: number | null;
  credits: number;
  kashier_sku: string | null;
  trial_days: number;
}

/** Same rule the pricing page applies, kept in one place on both sides. */
function catalogSlot(
  interval: "monthly" | "yearly",
  opts: { trial?: boolean; winback?: boolean },
): string {
  if (interval === "yearly") return opts.winback ? "yearly_winback" : "yearly";
  if (opts.trial) return "monthly_trial";
  return opts.winback ? "monthly_winback" : "monthly_intro";
}

async function catalogRow(tier: string, slot: string): Promise<CatalogRow | null> {
  const { data } = await admin
    .from("billing_catalog")
    .select("*")
    .eq("tier", tier)
    .eq("interval", slot)
    .eq("active", true)
    .maybeSingle();
  return (data as CatalogRow | null) ?? null;
}

/** Resolve the row for a choice, falling back to the plain interval row. */
async function resolveRow(
  tier: string,
  interval: "monthly" | "yearly",
  opts: { trial?: boolean; winback?: boolean },
): Promise<CatalogRow | null> {
  const slot = catalogSlot(interval, opts);
  return (await catalogRow(tier, slot)) ?? (await catalogRow(tier, interval));
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const tier = String(payload.tier ?? "pro").toLowerCase();
  const interval: "monthly" | "yearly" =
    String(payload.interval ?? "monthly").toLowerCase() === "yearly" ? "yearly" : "monthly";
  const trial = payload.trial === true || payload.free_trial === true;
  const winback = payload.winback === true || payload.offer === "second_month";
  const provider = String(payload.provider ?? "kashier").toLowerCase();

  // Kashier is the single site-wide payment provider. Reject legacy callers
  // instead of silently routing them to another gateway.
  if (provider !== "kashier") return json({ error: "Only Kashier payments are supported" }, 400);

  // ---- Kashier (Egypt: local cards + mobile wallets) ------------------------
  const method = String(payload.method ?? "card").toLowerCase();
  const display = payload.display === "ar" ? "ar" : "en";
  const allowedMethods = new Set(["card", "wallet", "bank_installments", "bnpl"]);
  if (!allowedMethods.has(method)) return json({ error: "invalid payment method" }, 400);

  // Legacy callers still send a raw sku; new callers send tier + interval.
  const legacySku = String(payload.sku ?? "").trim();
  let row: CatalogRow | null = null;
  if (legacySku) {
    const { data } = await admin
      .from("billing_catalog")
      .select("*")
      .eq("kashier_sku", legacySku)
      .eq("active", true)
      .maybeSingle();
    row = (data as CatalogRow | null) ?? null;
  }
  const isPack = row?.tier === "credits";
  if (isPack) {
    const { data: prof } = await admin
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();
    if (String((prof as any)?.plan ?? "free") === "free")
      return json({ error: "Credit packs are available for Pro members." }, 403);
  }
  if (!row) row = await resolveRow(tier, interval, { trial, winback });
  if (!row) return json({ error: "This plan isn't available for local payment yet." }, 400);

  const amount = Number(row.egp_price ?? 0);
  if (!amount || amount <= 0)
    return json({ error: "This plan isn't available for local payment yet." }, 400);

  const merchantId = Deno.env.get("KASHIER_MERCHANT_ID")?.trim();
  const paymentKey = (
    Deno.env.get("KASHIER_API_KEY") ||
    Deno.env.get("KASHIER_PAYMENT_API_KEY") ||
    Deno.env.get("KASHIER_SECRET")
  )?.trim();
  if (!merchantId || !paymentKey) return json({ error: "Kashier is not configured" }, 503);

  const orderId = `ord_${crypto.randomUUID()}`;
  const currency = "EGP";
  const { error: insertError } = await admin.from("kashier_orders").insert({
    order_id: orderId,
    user_id: user.id,
    amount,
    currency,
    credits: Number(row.credits ?? 0),
    plan: isPack ? null : row.tier,
    method,
    status: "pending",
    raw: {
      sku: row.kashier_sku,
      slot: row.interval,
      interval: row.base_interval,
      display,
      trial_days: Number(row.trial_days ?? 0),
    },
  });
  if (insertError) return json({ error: insertError.message }, 500);

  const path = `/?payment=${merchantId}.${orderId}.${amount}.${currency}`;
  const hash = await hmacHex(paymentKey, path);
  const siteUrl = (Deno.env.get("SITE_URL") || "https://megsyai.com").replace(/\/$/, "");
  const redirectUrl = `${siteUrl}/billing/success?provider=kashier&order=${encodeURIComponent(orderId)}`;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!supabaseUrl) return json({ error: "Payment callback is not configured" }, 503);
  const webhookUrl = `${supabaseUrl}/functions/v1/kashier-webhook`;
  const mode =
    (Deno.env.get("KASHIER_MODE") || "live").trim().toLowerCase() === "test" ? "test" : "live";

  const params = new URLSearchParams({
    merchantId,
    orderId,
    amount: String(amount),
    currency,
    hash,
    mode,
    merchantRedirect: redirectUrl,
    serverWebhook: webhookUrl,
    display,
    // Kashier's hosted page expects the official comma-separated method list.
    allowedMethods: "card,bank_installments,wallet,bnpl",
    defaultMethod: method,
  });

  return json({
    ok: true,
    checkout_url: `https://checkout.kashier.io/?${params.toString()}`,
    order_id: orderId,
    amount,
    currency,
    slot: row.interval,
  });
});
