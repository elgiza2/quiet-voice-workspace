/** Tokens always listed in every wallet (zero balance until a provider reports holdings). */
export const WALLET_TOKENS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", network: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", network: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana", network: "Solana" },
  { id: "binancecoin", symbol: "BNB", name: "BNB", network: "BNB Chain" },
  { id: "tether", symbol: "USDT", name: "Tether", network: "Ethereum" },
  { id: "usd-coin", symbol: "USDC", name: "USD Coin", network: "Base" },
  { id: "the-open-network", symbol: "TON", name: "Toncoin", network: "TON" },
  { id: "polygon-ecosystem-token", symbol: "POL", name: "Polygon", network: "Polygon" },
  { id: "arbitrum", symbol: "ARB", name: "Arbitrum", network: "Arbitrum" },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", network: "Avalanche" },
  { id: "tron", symbol: "TRX", name: "TRON", network: "Tron" },
  { id: "tether-tron", symbol: "USDT", name: "Tether", network: "Tron", priceId: "tether" },
] as { id: string; symbol: string; name: string; network: string; priceId?: string }[];

export type Addresses = { evm: string; solana: string; bitcoin: string; ton: string; tron?: string };
/** Which account address receives each token. */
export const addressFor = (network: string, a: Addresses) => network === "Bitcoin" ? a.bitcoin : network === "Solana" ? a.solana : network === "TON" ? a.ton : network === "Tron" ? a.tron || "" : a.evm;

export async function fetchWallet(): Promise<{ addresses: Addresses; balances: Record<string, number> }> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Please sign in");
  const res = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${data.session.access_token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Wallet unavailable");
  return body;
}

/** Platform fee on outgoing transfers, in basis points (50 = 0.5%). */



export type Market = { id: string; image: string; current_price: number; price_change_percentage_24h: number | null };

export async function fetchMarkets(signal?: AbortSignal): Promise<Record<string, Market>> {
  const ids = [...new Set(WALLET_TOKENS.map((t) => t.priceId ?? t.id))].join(",");
  const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}`, { signal });
  if (!res.ok) throw new Error(`Prices unavailable (${res.status})`);
  const list = (await res.json()) as Market[];
  const map: Record<string, Market> = Object.fromEntries(list.map((m) => [m.id, m]));
  for (const t of WALLET_TOKENS) if (t.priceId && map[t.priceId]) map[t.id] = map[t.priceId];
  return map;
}

/** Authenticated wallet actions (send, Solana quote/swap/balance). */
export async function walletAction<T = any>(body: Record<string, unknown>): Promise<T> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Please sign in");
  const res = await fetch("/api/wallet-action", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Action failed");
  return j as T;
}
export const SOL_MINT = "So11111111111111111111111111111111111111112";

/** Networks where any token can be bought/sold, with the coin you pay in. */
export const TON_NATIVE = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
export const NATIVE = "0xEeeeeEeeeEeEeEeEeEeEEEeeeeEeeeeeeeEEeEeE";
export const TRADE_NETS: Record<string, { pay: string; paySym: string; label: string; explorer: string }> = {
  solana: { pay: SOL_MINT, paySym: "SOL", label: "Solana", explorer: "https://solscan.io/tx/" },
  ethereum: { pay: NATIVE, paySym: "ETH", label: "Ethereum", explorer: "https://etherscan.io/tx/" },
  "binance-smart-chain": { pay: NATIVE, paySym: "BNB", label: "BNB Chain", explorer: "https://bscscan.com/tx/" },
  base: { pay: NATIVE, paySym: "ETH", label: "Base", explorer: "https://basescan.org/tx/" },
  "arbitrum-one": { pay: NATIVE, paySym: "ETH", label: "Arbitrum", explorer: "https://arbiscan.io/tx/" },
  "polygon-pos": { pay: NATIVE, paySym: "POL", label: "Polygon", explorer: "https://polygonscan.com/tx/" },
  avalanche: { pay: NATIVE, paySym: "AVAX", label: "Avalanche", explorer: "https://snowtrace.io/tx/" },
  "the-open-network": { pay: TON_NATIVE, paySym: "TON", label: "TON", explorer: "https://tonviewer.com/" },
};
export const TON_USDT = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
export type TradeTarget = { network: string; token: string; pay: string; paySym: string; label: string; explorer: string };
/** Pick where a CoinGecko asset trades: Solana, EVM, then TON; Bitcoin and Toncoin themselves have dedicated pairs. */
export function tradeTarget(platforms: Record<string, string> | undefined, id?: string): TradeTarget | null {
  if (id === "bitcoin") return { network: "bitcoin", token: "BTC.BTC", pay: "ETH.ETH", paySym: "ETH", label: "Bitcoin (THORChain)", explorer: "https://mempool.space/tx/" };
  if (id === "the-open-network") return { network: "ton", token: TON_NATIVE, pay: TON_USDT, paySym: "USDT", label: "TON", explorer: "https://tonviewer.com/" };
  if (!platforms) return null;
  for (const net of Object.keys(TRADE_NETS)) if (platforms[net]) {
    const n = TRADE_NETS[net];
    return { network: net === "the-open-network" ? "ton" : net, token: platforms[net], pay: n.pay, paySym: n.paySym, label: n.label, explorer: n.explorer };
  }
  return null;
}
