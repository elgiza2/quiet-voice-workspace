/**
 * @doc Apple Pay on our own checkout page.
 *
 * Kashier renders the Apple Pay button through their web SDK, but it needs a
 * payment session created server-side. This function prices the plan from
 * `billing_catalog`, opens the session on Kashier's v3 API and hands the
 * session id back to the browser, which passes it to kashierSDK.load().
 *
 * Requires (per Kashier's Apple Pay guide):
 *   • KASHIER_MERCHANT_ID, KASHIER_API_KEY and the merchant secret key
 *   • megsyai.com verified with Apple through Kashier support, with the
 *     domain association file served from /.well-known/
 */
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
  egp_price: number | null;
  credits: number;
  trial_days: number;
}

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

async function resolveRow(
  tier: string,
  interval: "monthly" | "yearly",
  opts: { trial?: boolean; winback?: boolean },
): Promise<CatalogRow | null> {
  const slot = catalogSlot(interval, opts);
  return (await catalogRow(tier, slot)) ?? (await catalogRow(tier, interval));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  let payload: Record<string, unknown> = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const tier = String(payload.tier ?? "pro").toLowerCase();
  const interval: "monthly" | "yearly" =
    String(payload.interval ?? "monthly").toLowerCase() === "yearly" ? "yearly" : "monthly";
  const trial = payload.trial === true;
  const winback = payload.winback === true;

  const row = await resolveRow(tier, interval, { trial, winback });
  const amount = Number(row?.egp_price ?? 0);
  if (!row || !amount || amount <= 0)
    return json({ error: "This plan isn't available for local payment yet." }, 400);

  const merchantId = Deno.env.get("KASHIER_MERCHANT_ID")?.trim();
  const apiKey = (
    Deno.env.get("KASHIER_API_KEY") || Deno.env.get("KASHIER_PAYMENT_API_KEY")
  )?.trim();
  const secretKey = (
    Deno.env.get("KASHIER_SECRET") || Deno.env.get("KASHIER_SECRET_KEY")
  )?.trim();
  const missing = [
    !merchantId && "KASHIER_MERCHANT_ID",
    !apiKey && "KASHIER_API_KEY",
    !secretKey && "KASHIER_SECRET",
  ].filter(Boolean) as string[];
  if (missing.length)
    return json(
      { error: `Apple Pay needs the merchant secret key: ${missing.join(", ")}` },
      503,
    );

  const mode =
    (Deno.env.get("KASHIER_MODE") || "live").trim().toLowerCase() === "test" ? "test" : "live";
  const apiBase = mode === "test" ? "https://test-api.kashier.io" : "https://api.kashier.io";

  const orderId = `ord_${crypto.randomUUID()}`;
  const currency = "EGP";
  const siteUrl = (Deno.env.get("SITE_URL") || "https://megsyai.com").replace(/\/$/, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!supabaseUrl) return json({ error: "Payment callback is not configured" }, 503);
  const redirectUrl = `${siteUrl}/billing/success?provider=kashier&order=${encodeURIComponent(orderId)}`;

  const { error: insertError } = await admin.from("kashier_orders").insert({
    order_id: orderId,
    user_id: user.id,
    amount,
    currency,
    credits: Number(row.credits ?? 0),
    plan: row.tier,
    method: "apple_pay",
    status: "pending",
    raw: {
      slot: row.interval,
      interval: row.base_interval,
      provider: "kashier",
      channel: "apple_pay_sdk",
    },
  });
  if (insertError) return json({ error: insertError.message }, 500);

  const body = {
    expireAt: new Date(Date.now() + 45 * 60_000).toISOString(),
    maxFailureAttempts: 3,
    paymentType: "credit",
    amount: String(amount),
    currency,
    merchantId,
    merchantOrderId: orderId,
    merchantRedirect: redirectUrl,
    display: "en",
    type: "one-time",
    allowedMethods: "apple_pay",
    defaultMethod: "apple_pay",
    description: `Megsy ${row.tier} ${row.base_interval}`,
    manualCapture: false,
    failureRedirect: false,
    customer: { reference: user.id, email: user.email ?? "" },
    saveCard: "optional",
    interactionSource: "ECOMMERCE",
    // Apple Pay carries its own authentication, so no separate 3DS step.
    enable3DS: false,
    serverWebhook: `${supabaseUrl}/functions/v1/kashier-webhook`,
  };

  let res: Response;
  try {
    res = await fetch(`${apiBase}/v3/payment/sessions`, {
      method: "POST",
      headers: {
        Authorization: secretKey!,
        "api-key": apiKey!,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    return json(
      { error: cause instanceof Error ? cause.message : "Couldn't reach Kashier." },
      502,
    );
  }

  const text = await res.text();
  let parsed: Record<string, any> = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  if (!res.ok || !parsed?._id) {
    const reason =
      parsed?.messages?.en ||
      parsed?.message ||
      parsed?.error ||
      text.slice(0, 200) ||
      `Kashier rejected the session (${res.status}).`;
    return json({ error: reason }, res.ok ? 502 : res.status);
  }

  return json({
    ok: true,
    session_id: parsed._id as string,
    session_url: (parsed.sessionUrl as string) ?? null,
    mode,
    order_id: orderId,
    amount,
    currency,
  });
});
