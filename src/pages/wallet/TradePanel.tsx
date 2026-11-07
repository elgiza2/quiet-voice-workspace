import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { SOL_MINT, walletAction } from "./walletTokens";

/** Buy/sell a Solana token with SOL (real on-chain trade through Jupiter). */
export default function TradePanel({ mint, symbol, side, onClose }: { mint: string; symbol: string; side: "buy" | "sell"; onClose: () => void }) {
  const input = side === "buy" ? SOL_MINT : mint, output = side === "buy" ? mint : SOL_MINT;
  const inSym = side === "buy" ? "SOL" : symbol, outSym = side === "buy" ? symbol : "SOL";
  const [amount, setAmount] = useState("");
  const [bal, setBal] = useState<number | null>(null);
  const [q, setQ] = useState<{ out: number; impact: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tx, setTx] = useState("");
  const n = Number(amount);

  useEffect(() => { walletAction<{ balance: number }>({ action: "balance", mint: input }).then((r) => setBal(r.balance)).catch(() => setBal(0)); }, [input]);
  useEffect(() => {
    setQ(null); setErr("");
    if (!(n > 0)) return;
    const t = setTimeout(() => walletAction<{ out: number; impact: number }>({ action: "quote", inputMint: input, outputMint: output, amount: n }).then(setQ).catch((e) => setErr(e.message)), 450);
    return () => clearTimeout(t);
  }, [n, input, output]);

  const go = async () => {
    setBusy(true); setErr("");
    try { const r = await walletAction<{ tx: string }>({ action: "swap", inputMint: input, outputMint: output, amount: n }); setTx(String(r.tx)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Trade failed"); }
    setBusy(false);
  };

  return (
    <div className="wl-sheet" role="dialog" aria-label={`${side} ${symbol}`} onClick={onClose}>
      <div className="wl-card wl-trade" onClick={(e) => e.stopPropagation()}>
        <header><strong>{side === "buy" ? `Buy ${symbol}` : `Sell ${symbol}`}</strong><button type="button" className="wl-round" aria-label="Close" onClick={onClose}><X size={18} /></button></header>
        {tx ? (<><p className="wl-sub">Trade sent. Your balance updates in a few seconds.</p><a className="wl-textbtn" href={`https://solscan.io/tx/${tx}`} target="_blank" rel="noreferrer">View on Solscan</a><button type="button" className="wl-btn wl-btn-main wl-full" onClick={onClose}>Done</button></>) : (<>
          <label className="wl-field"><span>You pay</span>
            <div className="wl-amtin"><input inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" /><b>{inSym}</b>{bal ? <button type="button" onClick={() => setAmount(String(side === "buy" ? Math.max(0, bal - 0.01) : bal))}>Max</button> : null}</div>
          </label>
          <p className="wl-sub">Available {bal === null ? "…" : bal.toLocaleString("en-US", { maximumFractionDigits: 6 })} {inSym}</p>
          <div className="wl-receive"><span>You receive</span><strong>{q ? q.out.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—"} {outSym}</strong>{q && q.impact > 1 && <small className="wl-err">Price impact {q.impact.toFixed(2)}%</small>}</div>
          {bal !== null && n > bal && <p className="wl-err">Not enough {inSym}</p>}
          {err && <p className="wl-err">{err}</p>}
          <button type="button" className="wl-btn wl-btn-main wl-full" disabled={!q || busy || (bal !== null && n > bal)} onClick={go}>{busy && <Loader2 className="wl-spin" size={18} />}{side === "buy" ? "Buy" : "Sell"}</button>
          <p className="wl-disclaimer">Trades run on Solana through Jupiter with 1% max slippage. A small SOL network fee applies.</p>
        </>)}
      </div>
    </div>
  );
}
