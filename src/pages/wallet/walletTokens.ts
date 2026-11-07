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
  { id: "ripple", symbol: "XRP", name: "XRP", network: "XRP Ledger" },
] as const;

/** Platform fee on outgoing transfers, in basis points (50 = 0.5%). */
export const PLATFORM_FEE_BPS = 50;
export const platformFee = (amount: number) => Math.round(amount * PLATFORM_FEE_BPS) / 10000;

export type Market = { id: string; image: string; current_price: number; price_change_percentage_24h: number | null };

export async function fetchMarkets(signal?: AbortSignal): Promise<Record<string, Market>> {
  const ids = WALLET_TOKENS.map((t) => t.id).join(",");
  const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}`, { signal });
  if (!res.ok) throw new Error(`Prices unavailable (${res.status})`);
  const list = (await res.json()) as Market[];
  return Object.fromEntries(list.map((m) => [m.id, m]));
}
