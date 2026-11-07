import { createFileRoute } from "@tanstack/react-router";

const noStore = { "Cache-Control": "no-store" };

/** Signed-in caller's own wallet: addresses (created on first visit) plus live balances. Never returns the phrase. */
export const Route = createFileRoute("/api/wallet")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticate } = await import("@/lib/ceyo/auth.server");
        const auth = await authenticate(request).catch(() => null);
        if (!auth) return Response.json({ error: "Please sign in" }, { status: 401, headers: noStore });
        try {
          const { getOrCreateWallet, walletBalances } = await import("@/lib/wallet/wallet.server");
          const addresses = await getOrCreateWallet(auth.userId);
          const balances = await walletBalances(addresses);
          return Response.json({ addresses, balances }, { headers: noStore });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Wallet unavailable" }, { status: 500, headers: noStore });
        }
      },
    },
  },
});
