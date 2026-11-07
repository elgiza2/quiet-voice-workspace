/**
 * @doc Real subscription controls for the signed-in account: read the current
 * state, turn monthly auto-renew on or off, and stop renewing at the period end.
 * The renewal engine (kashier-renewals) only charges rows with auto_renew = true.
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

type SubRow = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
  amount_cents: number | null;
  currency: string | null;
  auto_renew: boolean | null;
};

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
  const action = String(payload.action ?? "read").toLowerCase();
  if (!["read", "auto-renew-on", "auto-renew-off", "cancel"].includes(action))
    return json({ error: "invalid action" }, 400);

  const { data: latest } = await admin
    .from("subscriptions")
    .select("id,user_id,plan,status,current_period_end,amount_cents,currency,auto_renew")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sub = (latest as SubRow | null) ?? null;
  if (!sub) return json({ ok: true, subscription: null, auto_renew: false });

  const live = sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";

  if (action === "read") {
    return json({ ok: true, auto_renew: Boolean(sub.auto_renew), live, subscription: sub });
  }

  if (!live && action !== "auto-renew-off")
    return json({ error: "There is no active subscription to change." }, 409);

  const next = action === "auto-renew-on";
  const patch: Record<string, unknown> = {
    auto_renew: next,
    updated_at: new Date().toISOString(),
  };
  // Stopping renewals keeps access until the paid period ends; the engine then
  // expires the row instead of charging it.
  if (!next) patch.cancelled_at = new Date().toISOString();

  const { data: updated, error } = await admin
    .from("subscriptions")
    .update(patch)
    .eq("id", sub.id)
    .select("id,plan,status,current_period_end,auto_renew")
    .single();
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, auto_renew: next, subscription: updated, live: true });
});
