/** @doc Server-only loader for the Cerebras API key — the base text model.
 *
 *  Cerebras serves the default chat turn because it is the fastest text path by
 *  a wide margin (measured at roughly 900 output tokens/second after the first
 *  token, against seconds-per-turn on the agent harness). Keys live in the
 *  shared `provider_api_keys` pool with provider "cerebras"; the environment
 *  variable is only a fallback so a deploy can be brought up before the row
 *  exists.
 *
 *  Load is spread across every active key: candidates are ordered by
 *  least-recently-used, and each use stamps `last_used_at` so the next request
 *  picks a different key. Failures put a key on cooldown (or mark it disabled)
 *  so the pool self-heals without a deploy.
 *  Never import this from client code.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface CerebrasKey {
  id: string;
  table: "provider_api_keys" | "env";
  api_key: string;
  failure_count: number;
}

export const CEREBRAS_BASE = "https://api.cerebras.ai/v1";

/** The only two models Cerebras serves on shared inference. */
export const CEREBRAS_MODELS = {
  /** Cheapest, widest context, highest limits — the default for every turn. */
  text: "gpt-oss-120b",
  /** The only one that accepts images. */
  vision: "qwen-3.8-27b",
} as const;

function envKey(): string {
  return (process.env.CEREBRAS_API_KEY || process.env.VITE_CEREBRAS_API_KEY || "").trim();
}

function adminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** Every usable key, least-recently-used first. */
export async function getCerebrasKeys(): Promise<CerebrasKey[]> {
  const supabase = adminClient();
  const rows: CerebrasKey[] = [];
  if (supabase) {
    const now = Date.now();
    const { data } = await supabase
      .from("provider_api_keys")
      .select("id,api_key,last_used_at,cooldown_until,failure_count")
      .eq("provider", "cerebras")
      .eq("status", "active");
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const api_key = String(r.api_key ?? "").trim();
      if (!api_key) continue;
      const cd = r.cooldown_until as string | null;
      if (cd && new Date(cd).getTime() > now) continue;
      rows.push({
        id: String(r.id),
        table: "provider_api_keys",
        api_key,
        failure_count: Number(r.failure_count ?? 0),
      });
    }
    rows.sort((a, b) => a.failure_count - b.failure_count);
  }
  if (!rows.length) {
    const key = envKey();
    if (key) rows.push({ id: "env", table: "env", api_key: key, failure_count: 0 });
  }
  return rows;
}

export async function hasCerebrasKey(): Promise<boolean> {
  return (await getCerebrasKeys()).length > 0;
}

export async function markCerebrasUse(key: CerebrasKey): Promise<void> {
  if (key.table === "env") return;
  const supabase = adminClient();
  if (!supabase) return;
  await supabase
    .from("provider_api_keys")
    .update({ last_used_at: new Date().toISOString(), failure_count: 0, last_error: null })
    .eq("id", key.id);
}

/**
 * `status` 402 means the account is out of credit, 429 means rate limited —
 * both are temporary, so the key goes on cooldown and the pool tries the next
 * one. Anything else that is not 4xx-shaped gets disabled outright.
 */
export async function markCerebrasFailure(
  key: CerebrasKey,
  status: number,
  error: string,
  retryAfterSeconds?: number,
): Promise<void> {
  if (key.table === "env") return;
  const supabase = adminClient();
  if (!supabase) return;
  const temporary = status === 402 || status === 429 || status >= 500;
  const cooldownSeconds = retryAfterSeconds ?? (status === 429 ? 60 : 300);
  await supabase
    .from("provider_api_keys")
    .update({
      failure_count: key.failure_count + 1,
      last_error: `${status}: ${error}`.slice(0, 500),
      status: temporary ? "active" : "disabled",
      cooldown_until: temporary
        ? new Date(Date.now() + cooldownSeconds * 1000).toISOString()
        : null,
    })
    .eq("id", key.id);
}
