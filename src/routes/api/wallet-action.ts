import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const noStore = { "Cache-Control": "no-store" };
const mint = z.string().regex(/^([1-9A-HJ-NP-Za-km-z]{32,44}|0x[0-9a-fA-F]{40}|[EU]Q[A-Za-z0-9_-]{46}|BTC\.BTC|ETH\.ETH)$/);
const network = z.enum(["solana", "ethereum", "binance-smart-chain", "polygon-pos", "base", "arbitrum-one", "avalanche", "ton", "bitcoin"]).default("solana");
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), token: z.string().max(60), to: z.string().min(20).max(120), amount: z.string().regex(/^\d+(\.\d+)?$/) }),
  z.object({ action: z.literal("quote"), network, inputMint: mint, outputMint: mint, amount: z.number().positive() }),
  z.object({ action: z.literal("swap"), network, inputMint: mint, outputMint: mint, amount: z.number().positive() }),
  z.object({ action: z.literal("balance"), network, mint }),
]);

/** Signed-in caller's own wallet actions: real transfers and Solana trades. Keys never leave the server. */
export const Route = createFileRoute("/api/wallet-action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticate } = await import("@/lib/ceyo/auth.server");
        const auth = await authenticate(request).catch(() => null);
        if (!auth) return Response.json({ error: "Please sign in" }, { status: 401, headers: noStore });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400, headers: noStore });
        const b = parsed.data;
        try {
          const s = await import("@/lib/wallet/send.server");
          const { getOrCreateWallet } = await import("@/lib/wallet/wallet.server");
          const addrs = await getOrCreateWallet(auth.userId);
          const owner = addrs.solana;
          if (b.action === "send") return Response.json({ tx: await s.sendToken(auth.userId, b.token, b.to, b.amount) }, { headers: noStore });
          if (b.network === "ton" || b.network === "bitcoin") {
            const t = await import("@/lib/wallet/tradeTonBtc.server");
            const bal = (m: string) => b.network === "ton" ? t.tonBalance(addrs.ton, m) : m === t.BTC_ASSET ? t.btcBalance(addrs.bitcoin) : t.ethBalance(addrs.evm);
            if (b.action === "balance") return Response.json({ balance: await bal(b.mint) }, { headers: noStore });
            if (b.action === "quote") return Response.json(b.network === "ton" ? await t.tonQuote(b.inputMint, b.outputMint, b.amount) : await t.btcQuote(b.inputMint, b.outputMint, b.amount, b.outputMint === t.BTC_ASSET ? addrs.bitcoin : addrs.evm), { headers: noStore });
            if ((await bal(b.inputMint)) < b.amount) return Response.json({ error: "Not enough balance" }, { status: 400, headers: noStore });
            return Response.json({ tx: b.network === "ton" ? await t.tonSwap(auth.userId, b.inputMint, b.outputMint, b.amount) : await t.btcSwap(auth.userId, b.inputMint, b.outputMint, b.amount, addrs) }, { headers: noStore });
          }
          if (b.network !== "solana") {
            const n = b.network;
            const isEvm = (m: string) => /^0x[0-9a-fA-F]{40}$/.test(m);
            if (b.action === "balance") { if (!isEvm(b.mint)) throw new Error("Invalid token"); return Response.json({ balance: await s.evmBalance(n, addrs.evm, b.mint) }, { headers: noStore }); }
            if (!isEvm(b.inputMint) || !isEvm(b.outputMint)) throw new Error("Invalid token");
            if (b.action === "quote") return Response.json(await s.evmQuote(n, b.inputMint, b.outputMint, b.amount), { headers: noStore });
            if ((await s.evmBalance(n, addrs.evm, b.inputMint)) < b.amount) return Response.json({ error: "Not enough balance" }, { status: 400, headers: noStore });
            return Response.json({ tx: await s.evmSwap(auth.userId, n, b.inputMint, b.outputMint, b.amount) }, { headers: noStore });
          }
          if (b.action === "balance") return Response.json({ balance: await s.splBalance(owner, b.mint) }, { headers: noStore });
          if (b.action === "quote") { const q = await s.quote(b.inputMint, b.outputMint, b.amount); return Response.json({ out: q.out, impact: q.impact }, { headers: noStore }); }
          const have = await s.splBalance(owner, b.inputMint);
          if (have < b.amount) return Response.json({ error: "Not enough balance" }, { status: 400, headers: noStore });
          return Response.json({ tx: await s.executeSwap(auth.userId, owner, b.inputMint, b.outputMint, b.amount) }, { headers: noStore });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message.slice(0, 200) : "Action failed" }, { status: 400, headers: noStore });
        }
      },
    },
  },
});
