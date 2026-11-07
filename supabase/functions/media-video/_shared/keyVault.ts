import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type KeyTable = "service_keys" | "provider_api_keys";
export type VaultKey = { id: string; key: string; table: KeyTable; lastUsedAt: string | null };

let client: any;
export function db() {
  return (client ??= createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  ));
}

async function decrypt(ciphertext: string, iv: string) {
  const secret = Deno.env.get("KEY_VAULT_SECRET")?.trim();
  if (!secret) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["decrypt"]);
  try {
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: Uint8Array.from(atob(iv), (x) => x.charCodeAt(0)) },
        key,
        Uint8Array.from(atob(ciphertext), (x) => x.charCodeAt(0)),
      ),
    );
  } catch {
    return null;
  }
}

function sortByUsage(a: VaultKey, b: VaultKey) {
  const ta = a.lastUsedAt ? Date.parse(a.lastUsedAt) : 0;
  const tb = b.lastUsedAt ? Date.parse(b.lastUsedAt) : 0;
  return ta - tb;
}

/** Returns both key pools, not one pool as a fallback for the other. */
export async function vaultKeys(provider: string, limit = 25): Promise<VaultKey[]> {
  const database = db();
  const all: VaultKey[] = [];
  const now = new Date().toISOString();

  const { data: serviceRows } = await database
    .from("service_keys")
    .select("id,key_cipher,key_iv,last_used_at")
    .eq("provider", provider)
    .eq("status", "active")
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  for (const row of serviceRows ?? []) {
    const key = await decrypt(String(row.key_cipher ?? ""), String(row.key_iv ?? ""));
    if (key)
      all.push({
        id: String(row.id),
        key,
        table: "service_keys",
        lastUsedAt: row.last_used_at ?? null,
      });
  }

  const { data: providerRows } = await database
    .from("provider_api_keys")
    .select("id,api_key,last_used_at")
    .eq("provider", provider)
    .eq("status", "active")
    .or(`cooldown_until.is.null,cooldown_until.lt.${now}`)
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  for (const row of providerRows ?? []) {
    if (row.api_key)
      all.push({
        id: String(row.id),
        key: String(row.api_key),
        table: "provider_api_keys",
        lastUsedAt: row.last_used_at ?? null,
      });
  }

  return all.sort(sortByUsage).slice(0, limit);
}

/** Claim a key before the provider request so concurrent calls spread out. */
export async function noteKeyAttempt(key: VaultKey) {
  await db().from(key.table).update({ last_used_at: new Date().toISOString() }).eq("id", key.id);
}

export async function noteKeyOk(key: VaultKey) {
  if (key.table === "service_keys") {
    await db()
      .from(key.table)
      .update({ fail_count: 0, last_error: null, last_used_at: new Date().toISOString() })
      .eq("id", key.id);
  } else {
    await db()
      .from(key.table)
      .update({
        failure_count: 0,
        last_error: null,
        cooldown_until: null,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", key.id);
  }
}

export async function noteKeyCooldown(key: VaultKey, error: string, seconds = 60) {
  const until = new Date(Date.now() + seconds * 1000).toISOString();
  if (key.table === "service_keys") {
    await db()
      .from(key.table)
      .update({ last_error: error.slice(0, 400), last_used_at: new Date().toISOString() })
      .eq("id", key.id);
  } else {
    await db()
      .from(key.table)
      .update({
        cooldown_until: until,
        last_error: error.slice(0, 400),
        last_used_at: new Date().toISOString(),
      })
      .eq("id", key.id);
  }
}

/** Mark a depleted key out of the active pool while retaining its audit row. */
export async function depleteKey(key: VaultKey, error: string) {
  const patch = {
    status: "depleted",
    last_error: error.slice(0, 400),
    banned_at: new Date().toISOString(),
    last_used_at: new Date().toISOString(),
  };
  await db().from(key.table).update(patch).eq("id", key.id);
}

export function isDepletedProviderError(status: number, message: string) {
  const text = message.toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    /not enough credits|insufficient credits|credit balance|quota exceeded|no credits|account.*(empty|depleted)|payment required/.test(
      text,
    )
  );
}

export function isRateLimited(status: number, message: string) {
  return (
    status === 429 ||
    /rate.?limit|too many requests|temporarily unavailable/.test(message.toLowerCase())
  );
}

export function providerError(status: number, body: string) {
  return `Runway ${status}: ${body.slice(0, 400)}`;
}

export async function noteKeyFail(key: VaultKey, error: string, status = 500) {
  if (isDepletedProviderError(status, error)) return depleteKey(key, error);
  if (isRateLimited(status, error)) return noteKeyCooldown(key, error);
  if (key.table === "service_keys") {
    const { data } = await db().from(key.table).select("fail_count").eq("id", key.id).maybeSingle();
    await db()
      .from(key.table)
      .update({
        fail_count: Number(data?.fail_count || 0) + 1,
        last_error: error.slice(0, 400),
        last_used_at: new Date().toISOString(),
      })
      .eq("id", key.id);
  } else {
    const { data } = await db()
      .from(key.table)
      .select("failure_count")
      .eq("id", key.id)
      .maybeSingle();
    await db()
      .from(key.table)
      .update({
        failure_count: Number(data?.failure_count || 0) + 1,
        last_error: error.slice(0, 400),
        last_used_at: new Date().toISOString(),
      })
      .eq("id", key.id);
  }
}

export async function resetDepletedKey(id: string, table: KeyTable) {
  const patch =
    table === "service_keys"
      ? { status: "active", banned_at: null, last_error: null }
      : { status: "active", banned_at: null, last_error: null, cooldown_until: null };
  await db().from(table).update(patch).eq("id", id);
}

export function keySummary(key: VaultKey) {
  return { id: key.id, table: key.table };
}
