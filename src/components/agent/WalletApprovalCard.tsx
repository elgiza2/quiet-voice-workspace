import { useEffect, useState } from "react";
import { Wallet, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { walletAction } from "@/pages/wallet/walletTokens";

/** Agent-proposed wallet send/trade. Nothing moves until the user taps Confirm here. */
export function WalletApprovalCard({ data }: { data: Record<string, any> }) {
  const key = `wallet-approval:${data.id}`;
  const [status, setStatus] = useState<"pending" | "running" | "done" | "declined" | "failed">("pending");
  const [tx, setTx] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { const v = localStorage.getItem(key); if (v) { const [s, t] = v.split("|"); setStatus(s as any); setTx(t || ""); } }, [key]);
  const save = (s: typeof status, t = "") => { setStatus(s); setTx(t); localStorage.setItem(key, `${s}|${t}`); };
  const net = data.pay ? { pay: String(data.pay), paySym: String(data.paySym), label: String(data.label) } : undefined;
  const confirm = async () => {
    setStatus("running"); setError("");
    try {
      const r = data.action === "send"
        ? await walletAction<{ tx: string }>({ action: "send", token: data.token, to: data.to, amount: String(data.amount) })
        : await walletAction<{ tx: string }>({ action: "swap", network: data.network, inputMint: data.side === "buy" ? net!.pay : data.token, outputMint: data.side === "buy" ? data.token : net!.pay, amount: Number(data.amount) });
      save("done", String(r.tx));
    } catch (e) { setStatus("failed"); setError(e instanceof Error ? e.message : "Action failed"); }
  };
  const title = data.action === "send" ? `Send ${data.amount} ${data.symbol}` : `${data.side === "buy" ? "Buy" : "Sell"} ${data.symbol} · ${data.amount} ${data.side === "buy" ? net?.paySym : data.symbol}`;
  return <div className="cx-card border border-border rounded-lg p-3">
    <div className="flex items-center gap-2"><Wallet size={17} /><strong>{title}</strong></div>
    {data.action === "send" ? <p className="text-xs text-muted-foreground break-all mt-1">To {String(data.to)}</p> : <p className="text-xs text-muted-foreground mt-1">On {net?.label}, 1% max slippage</p>}
    {data.note && <p className="text-sm mt-2">{String(data.note)}</p>}
    <div className="mt-3">
      {status === "pending" || status === "failed" ? <div className="flex gap-2"><Button size="sm" onClick={() => void confirm()}><Check />Confirm</Button><Button size="sm" variant="ghost" onClick={() => save("declined")}><X />Decline</Button></div>
        : status === "running" ? <p className="text-sm flex items-center gap-2"><Loader2 className="animate-spin" size={14} />Working…</p>
        : <p className="text-sm break-all" role="status">{status === "done" ? `Sent${tx ? ` · ${tx.slice(0, 12)}…` : ""}` : "Declined"}</p>}
    </div>
    {error && <p className="text-destructive text-sm mt-2">{error}</p>}
  </div>;
}
