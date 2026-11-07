/** @doc dodo-reconcile — settle missed Dodo Payments webhooks against Dodo's own records.
 *
 *  A webhook can be lost, rejected, or arrive before the order row exists. Without a
 *  reconciliation pass those orders stay `pending` forever and the customer pays
 *  without ever receiving credits or the plan. This function asks Dodo directly and
 *  grants what was actually paid — exactly once.
 *
 *  Grants are idempotent: every credit movement carries a deterministic description
 *  (`reconcile:dodo:<order_id>`), and a second pass finds it and skips.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { operatorAuthorized } from "../_shared/operatorAuthorization.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-reconcile-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const API_BASE =
  (Deno.env.get("DODO_PAYMENTS_ENVIRONMENT") || "live_mode") === "test_mode"
    ? "https://test.dodopayments.com"
    : "https://live.dodopayments.com";

/** Dodo subscription statuses that mean the customer really has the plan. */
const LIVE = new Set(["active"]);
/** Statuses that mean this attempt will never produce a payment. */
const DEAD = new Set(["cancelled", "failed", "expired"]);
/** How long a checkout may sit without any subscription before we call it abandoned. */
const ABANDON_HOURS = 24;

type OrderRow = {
  order_id: string;
  user_id: string | null;
  credits: number | null;
  plan: string | null;
  dodo_subscription_id: string | null;
  created_at: string;
};

async function fetchSubscription(id: string, apiKey: string) {
  const res = await fetch(`${API_BASE}/subscriptions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) return { ok: false as const, status: res.status, detail: text.slice(0, 200) };
  try {
    return { ok: true as const, sub: JSON.parse(text) };
  } catch {
    return { ok: false as const, status: res.status, detail: "bad json" };
  }
}

/** True when this order was already granted, so a repeat pass never double-pays. */
async function alreadyGranted(orderId: string) {
  const { data } = await admin
    .from("credit_transactions")
    .select("id")
    .eq("description", `reconcile:dodo:${orderId}`)
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function grant(row: OrderRow, sub: any) {
  const orderId = row.order_id;
  const userId = row.user_id;
  if (!userId) return { granted: false, reason: "no_user" };
  if (await alreadyGranted(orderId)) return { granted: false, reason: "already_granted" };

  const credits = Number(row.credits ?? 0);
  if (credits > 0) {
    await admin.rpc("add_credits", {
      p_user_id: userId,
      p_amount: credits,
      p_description: `reconcile:dodo:${orderId}`,
    });
  }

  const plan = String(row.plan ?? "pro");
  await admin.from("profiles").update({ plan, trial_ends_at: null }).eq("id", userId);

  const periodEnd = sub?.next_billing_date ?? null;
  const amountCents = Math.round(Number(sub?.recurring_pre_tax_amount ?? 0));
  const rowSub = {
    plan,
    status: "active",
    currency: "USD",
    amount_cents: amountCents,
    current_period_end: periodEnd,
    auto_renew: sub?.has_payment_method !== false,
  };
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.id) await admin.from("subscriptions").update(rowSub).eq("id", existing.id);
  else await admin.from("subscriptions").insert({ user_id: userId, ...rowSub });

  return { granted: true, credits, plan };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "method not allowed" }, 405);

  const guard = Deno.env.get("RECONCILE_SECRET")?.trim();
  if (!operatorAuthorized(guard, req.headers.get("x-reconcile-secret"))) return json({ error: "unauthorized" }, 401);

  const apiKey = Deno.env.get("DODO_PAYMENTS_API_KEY");
  if (!apiKey) return json({ error: "Dodo Payments is not configured" }, 503);

  let p: any = {};
  if (req.method === "POST") {
    try {
      p = await req.json();
    } catch {
      p = {};
    }
  }

  const one = String(p.order_id ?? "").trim();
  const dry = p.dry_run === true;
  const age = Number(p.min_age_minutes ?? 10);
  const limit = Math.min(Math.max(Number(p.limit ?? 50), 1), 100);

  let q = admin
    .from("dodo_orders")
    .select("order_id,user_id,credits,plan,dodo_subscription_id,created_at")
    .eq("status", "pending");
  q = one
    ? q.eq("order_id", one)
    : q
        .lt("created_at", new Date(Date.now() - age * 60_000).toISOString())
        .order("created_at", { ascending: true })
        .limit(limit);

  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);

  let paid = 0;
  let dead = 0;
  let pending = 0;
  let abandoned = 0;
  let granted = 0;
  let errors = 0;
  const results: any[] = [];

  for (const raw of (data ?? []) as OrderRow[]) {
    const id = raw.order_id;

    // A checkout that never became a subscription cannot be reconciled against
    // Dodo, so an old one is closed as abandoned instead of lingering forever.
    if (!raw.dodo_subscription_id) {
      const hours = (Date.now() - new Date(raw.created_at).getTime()) / 3_600_000;
      if (hours >= ABANDON_HOURS) {
        if (!dry) {
          await admin.from("dodo_orders").update({ status: "abandoned" }).eq("order_id", id).eq("status", "pending");
        }
        abandoned++;
        results.push({ order_id: id, action: dry ? "would_abandon" : "marked_abandoned" });
      } else {
        pending++;
        results.push({ order_id: id, action: "left_pending", reason: "no_subscription_yet" });
      }
      continue;
    }

    const r = await fetchSubscription(raw.dodo_subscription_id, apiKey);
    if (!r.ok) {
      errors++;
      results.push({ order_id: id, action: "error", status: r.status, detail: r.detail });
      continue;
    }

    const st = String(r.sub?.status ?? "").toLowerCase();
    let next: string | null = null;
    if (LIVE.has(st)) next = "paid";
    else if (DEAD.has(st)) next = "failed";

    if (next === "paid") {
      if (!dry) {
        await admin
          .from("dodo_orders")
          .update({ status: "paid", raw: r.sub })
          .eq("order_id", id)
          .eq("status", "pending");
        const g = await grant(raw, r.sub);
        if (g.granted) granted++;
      }
      paid++;
    } else if (next === "failed") {
      if (!dry) {
        await admin
          .from("dodo_orders")
          .update({ status: "failed", raw: r.sub })
          .eq("order_id", id)
          .eq("status", "pending");
      }
      dead++;
    } else {
      pending++;
    }

    results.push({
      order_id: id,
      dodo_status: st || "(none)",
      action: dry ? `would_${next ?? "leave"}` : next ? `marked_${next}` : "left_pending",
    });
  }

  return json({
    ok: true,
    dry_run: dry,
    checked: results.length,
    marked_paid: paid,
    granted,
    marked_failed: dead,
    marked_abandoned: abandoned,
    still_pending: pending,
    errors,
    results,
  });
});
