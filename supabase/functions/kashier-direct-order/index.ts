import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    headers: { ...headers, "Content-Type": "application/json" },
  });

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const tier = String(body.tier ?? "pro").toLowerCase();
  const requestedInterval =
    String(body.interval ?? "monthly").toLowerCase() === "yearly" ? "yearly" : "monthly";
  const slots = requestedInterval === "monthly" ? ["monthly_intro", "monthly"] : ["yearly"];
  let row: any = null;
  for (const slot of slots) {
    const { data } = await admin
      .from("billing_catalog")
      .select("tier,interval,base_interval,egp_price,credits")
      .eq("tier", tier)
      .eq("interval", slot)
      .eq("active", true)
      .maybeSingle();
    if (data) {
      row = data;
      break;
    }
  }
  const amount = Number(row?.egp_price ?? 0);
  if (!row || !Number.isFinite(amount) || amount <= 0)
    return json({ error: "This plan is not available for live payment." }, 400);

  const merchantId = Deno.env.get("KASHIER_MERCHANT_ID")?.trim();
  const paymentKey = (
    Deno.env.get("KASHIER_PAYMENT_API_KEY") || Deno.env.get("KASHIER_API_KEY")
  )?.trim();
  if (!merchantId || !paymentKey)
    return json({ error: "Kashier live payment credentials are not configured" }, 503);

  // Auto-renew needs the card on file, so ask Kashier to save the card and
  // sign the customer reference into the hash (required when card.save is sent).
  const save = body.save === true;

  const orderId = `ord_${crypto.randomUUID()}`;
  const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/kashier-webhook`;
  const redirectUrl = `${(Deno.env.get("SITE_URL") || "https://megsyai.com").replace(/\/$/, "")}/billing/success?provider=kashier&order=${encodeURIComponent(orderId)}`;
  const { error } = await admin.from("kashier_orders").insert({
    order_id: orderId,
    user_id: auth.user.id,
    amount,
    currency: "EGP",
    credits: Number(row.credits ?? 0),
    plan: tier,
    method: "card",
    status: "pending",
    raw: {
      interval: row.base_interval || requestedInterval,
      direct_api: true,
      mode: "live",
      save_card: save,
    },
  });
  if (error) return json({ error: error.message }, 500);

  const hash = await hmac(
    paymentKey,
    `/?payment=${merchantId}.${orderId}.${amount}.EGP${save ? `.${auth.user.id}` : ""}`,
  );
  return json({
    order_id: orderId,
    merchant_id: merchantId,
    amount,
    currency: "EGP",
    hash,
    endpoint: "https://fep.kashier.io/v3/orders/",
    webhook_url: webhookUrl,
    merchant_redirect: redirectUrl,
    customer_reference: auth.user.id,
    save_card: save,
  });
});
