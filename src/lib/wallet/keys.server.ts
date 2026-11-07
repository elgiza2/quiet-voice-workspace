/** Server-only: unseal a user's phrase and derive signing keys. Never return these to the browser. */
import { mnemonicToSeedSync } from "@scure/bip39";
import { HDKey } from "@scure/bip32";
import { HDKey as EdHDKey } from "micro-key-producer/slip10.js";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) throw new Error("Wallet service is not configured");
  return createClient(url, service, { auth: { persistSession: false } });
}
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export type WalletKeys = { evm: Uint8Array; btc: Uint8Array; btcPub: Uint8Array; sol: Uint8Array; solPub: Uint8Array; ton: Uint8Array };

export async function loadKeys(userId: string): Promise<WalletKeys> {
  const db = admin();
  const { data } = await db.auth.admin.getUserById(userId);
  const w = data.user?.app_metadata?.wallet as { iv?: string; phrase?: string } | undefined;
  if (!w?.iv || !w.phrase) throw new Error("Open your wallet first");
  const { data: k } = await db.from("provider_api_keys").select("api_key").eq("provider", "wallet_encryption").order("created_at").limit(1).maybeSingle();
  if (!k?.api_key) throw new Error("Wallet encryption unavailable");
  const key = await crypto.subtle.importKey("raw", unb64(k.api_key), "AES-GCM", false, ["decrypt"]);
  const phrase = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(w.iv) }, key, unb64(w.phrase)));
  const seed = mnemonicToSeedSync(phrase);
  const root = HDKey.fromMasterSeed(seed);
  const btc = root.derive("m/84'/0'/0'/0/0");
  const sol = EdHDKey.fromMasterSeed(seed).derive("m/44'/501'/0'/0'");
  const ton = EdHDKey.fromMasterSeed(seed).derive("m/44'/607'/0'");
  return { evm: root.derive("m/44'/60'/0'/0/0").privateKey!, btc: btc.privateKey!, btcPub: btc.publicKey!, sol: sol.privateKey, solPub: sol.publicKeyRaw, ton: ton.privateKey };
}

/** Optional platform fee receiver per chain family (provider_api_keys rows `wallet_fee_<family>`). Unset = no fee. */
export async function feeAddress(family: "evm" | "solana" | "ton" | "bitcoin"): Promise<string | null> {
  const { data } = await admin().from("provider_api_keys").select("api_key").eq("provider", `wallet_fee_${family}`).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data?.api_key || null;
}
