/** Server-only: one self-custodial wallet per account, phrase encrypted with AES-GCM and kept in
 *  non-user-editable auth app_metadata; balances read from free, keyless public endpoints. */
import { createClient } from "@supabase/supabase-js";
import { deriveAddresses, newMnemonic, type WalletAddresses } from "./derive";

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) throw new Error("Wallet service is not configured");
  return createClient(url, service, { auth: { persistSession: false } });
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function encryptionKey(db: ReturnType<typeof admin>) {
  const read = () => db.from("provider_api_keys").select("api_key").eq("provider", "wallet_encryption").order("created_at").limit(1).maybeSingle();
  let { data } = await read();
  if (!data?.api_key) {
    await db.from("provider_api_keys").insert({ provider: "wallet_encryption", api_key: b64(crypto.getRandomValues(new Uint8Array(32))) });
    ({ data } = await read());
  }
  if (!data?.api_key) throw new Error("Wallet encryption unavailable");
  return crypto.subtle.importKey("raw", unb64(data.api_key), "AES-GCM", false, ["encrypt", "decrypt"]);
}

type SealedWallet = { addresses: WalletAddresses; iv: string; phrase: string };
/** Wallets created before TON support gain a TON address from their existing phrase. */
async function addTon(db: ReturnType<typeof admin>, user: { id: string; app_metadata: Record<string, unknown> }, w: SealedWallet) {
  const phrase = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(w.iv) }, await encryptionKey(db), unb64(w.phrase)));
  const addresses = deriveAddresses(phrase);
  await db.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, wallet: { ...w, addresses } } });
  return addresses;
}

export async function getOrCreateWallet(userId: string): Promise<WalletAddresses> {
  const db = admin();
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error("Account not found");
  const existing = data.user.app_metadata?.wallet as { addresses?: WalletAddresses } | undefined;
  if (existing?.addresses?.evm && existing.addresses.ton) return existing.addresses;
  if (existing?.addresses?.evm) return addTon(db, data.user, existing as SealedWallet);
  const phrase = newMnemonic();
  const addresses = deriveAddresses(phrase);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(db), new TextEncoder().encode(phrase)));
  const { error: saveError } = await db.auth.admin.updateUserById(userId, {
    app_metadata: { ...data.user.app_metadata, wallet: { v: 1, addresses, iv: b64(iv), phrase: b64(sealed), created_at: new Date().toISOString() } },
  });
  if (saveError) throw new Error("Could not create wallet");
  return addresses;
}

const EVM_RPC = {
  ethereum: "https://ethereum-rpc.publicnode.com",
  bsc: "https://bsc-rpc.publicnode.com",
  base: "https://base-rpc.publicnode.com",
  polygon: "https://polygon-bor-rpc.publicnode.com",
  arbitrum: "https://arbitrum-one-rpc.publicnode.com",
} as const;

async function rpc(url: string, method: string, params: unknown[]) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json() as { result?: any };
  return j.result;
}
const hexToNum = (hex: string | undefined, decimals: number) => (hex && hex !== "0x" ? Number(BigInt(hex)) / 10 ** decimals : 0);
const erc20 = async (chain: keyof typeof EVM_RPC, token: string, owner: string, decimals: number) =>
  hexToNum(await rpc(EVM_RPC[chain], "eth_call", [{ to: token, data: "0x70a08231" + owner.slice(2).toLowerCase().padStart(64, "0") }, "latest"]), decimals);

/** Balances keyed by token id from walletTokens.ts; a failed network reads as 0 instead of breaking the page. */
export async function walletBalances(a: WalletAddresses): Promise<Record<string, number>> {
  const safe = (p: Promise<number>) => p.catch(() => 0);
  const [btc, eth, sol, bnb, pol, usdt, usdc, arb, ton] = await Promise.all([
    safe(fetch(`https://mempool.space/api/address/${a.bitcoin}`).then((r) => r.json()).then((j: any) => (j.chain_stats.funded_txo_sum - j.chain_stats.spent_txo_sum) / 1e8)),
    safe(rpc(EVM_RPC.ethereum, "eth_getBalance", [a.evm, "latest"]).then((h) => hexToNum(h, 18))),
    safe(rpc("https://solana-rpc.publicnode.com", "getBalance", [a.solana]).then((r) => (r?.value ?? 0) / 1e9)),
    safe(rpc(EVM_RPC.bsc, "eth_getBalance", [a.evm, "latest"]).then((h) => hexToNum(h, 18))),
    safe(rpc(EVM_RPC.polygon, "eth_getBalance", [a.evm, "latest"]).then((h) => hexToNum(h, 18))),
    safe(erc20("ethereum", "0xdAC17F958D2ee523a2206206994597C13D831ec7", a.evm, 6)),
    safe(erc20("base", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", a.evm, 6)),
    safe(erc20("arbitrum", "0x912CE59144191C1204E64559FE8253a0e49E6548", a.evm, 18)),
    safe(fetch(`https://toncenter.com/api/v2/getAddressBalance?address=${a.ton}`).then((r) => r.json()).then((j: any) => Number(j.result || 0) / 1e9)),
  ]);
  return { bitcoin: btc, ethereum: eth, solana: sol, binancecoin: bnb, "polygon-ecosystem-token": pol, tether: usdt, "usd-coin": usdc, arbitrum: arb, "the-open-network": ton };
}
