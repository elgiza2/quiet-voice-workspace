/** Server-only: first usable key for a provider from `provider_api_keys`
 *  (least-recently-used), falling back to the environment variable. */
import { createClient } from "@supabase/supabase-js";

export type KeyProvider = "cerebras" | "browserbase" | "composio";

const ENV: Record<KeyProvider, string> = {
  cerebras: "CEREBRAS_API_KEY",
  browserbase: "BROWSERBASE_API_KEY",
  composio: "COMPOSIO_API_KEY",
};

export async function getProviderKey(provider: KeyProvider): Promise<string | null> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && service) {
    const db = createClient(url, service, { auth: { persistSession: false } });
    const { data } = await db
      .from("provider_api_keys")
      .select("id,api_key,cooldown_until")
      .eq("provider", provider)
      .eq("status", "active")
      .order("last_used_at", { ascending: true, nullsFirst: true })
      .limit(5);
    const row = (data ?? []).find(
      (r) => !r.cooldown_until || new Date(r.cooldown_until).getTime() < Date.now(),
    );
    if (row?.api_key) {
      void db.from("provider_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
      return row.api_key;
    }
  }
  return process.env[ENV[provider]]?.trim() || null;
}
