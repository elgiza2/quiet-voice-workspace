import { createFileRoute } from "@tanstack/react-router";

const NETS = ["solana", "ethereum", "binance-smart-chain", "polygon-pos", "base", "arbitrum-one", "avalanche", "the-open-network"];
let cache: { at: number; ids: string[] } | null = null;

/** Public market metadata: CoinGecko ids that have a token on a network the wallet can trade. Cached 6h. */
export const Route = createFileRoute("/api/tradeable-assets")({
  server: {
    handlers: {
      GET: async () => {
        if (!cache || Date.now() - cache.at > 6 * 3600_000) {
          try {
            const list = await (await fetch("https://api.coingecko.com/api/v3/coins/list?include_platform=true")).json() as { id: string; platforms?: Record<string, string> }[];
            if (Array.isArray(list)) cache = { at: Date.now(), ids: list.filter((c) => NETS.some((n) => c.platforms?.[n])).map((c) => c.id) };
          } catch { /* keep previous cache */ }
        }
        return Response.json({ ids: cache?.ids ?? null }, { headers: { "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
