import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { walletAction, type TradeTarget } from "./walletTokens";

/** Buy/sell a token with its network's main coin (real on-chain trade: Jupiter on Solana, KyberSwap on EVM). */
export default function TradePanel({ target: net, symbol, side, onClose }: { target: TradeTarget; symbol: string; side: "buy" | "sell"; onClose: () => void }) {
  const network = net.network, mint = net.token;
  const input = side === "buy" ? net.pay : mint, output = side === "buy" ? mint : net.pay;
  const inSym = side === "buy" ? net.paySym : symbol, outSym = side === "buy" ? symbol : net.paySym;
  const [amount, setAmount] = useState("");
  const [bal, setBal] = useState<number | null>(null);
  const [q, setQ] = useState<{ out: number; impact: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tx, setTx] = useState("");
  const n = Number(amount);

  useEffect(() => { walletAction<{ balance: number }>({ action: "balance", network, mint: input }).then((r) => setBal(r.balance)).catch(() => setBal(0)); }, [input, network]);
  useEffect(() => {
    setQ(null); setErr("");
    if (!(n > 0)) return;
    const t = setTimeout(() => walletAction<{ out: number; impact: number }>({ action: "quote", network, inputMint: input, outputMint: output, amount: n }).then(setQ).catch((e) => setErr(e.message)), 450);
    return () => clearTimeout(t);
  }, [n, input, output, network]);

  const go = async () => {
    setBusy(true); setErr("");
    try { const r = await walletAction<{ tx: string }>({ action: "swap", network, inputMint: input, outputMint: output, amount: n }); setTx(String(r.tx)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Trade failed"); }
    setBusy(false);
  };

  return (
    <div className="wl-sheet" role="dialog" aria-label={`${side} ${symbol}`} onClick={onClose}>
      <div className="wl-card wl-trade" onClick={(e) => e.stopPropagation()}>
        <header><strong>{side === "buy" ? `Buy ${symbol}` : `Sell ${symbol}`}</strong><button type="button" className="wl-round" aria-label="Close" onClick={onClose}><X size={18} /></button></header>
        {tx ? (<><p className="wl-sub">Trade sent. Your balance updates in a few seconds.</p><a className="wl-textbtn" href={tx.startsWith("seqno:") ? `${net.explorer}` : `${net.explorer}${tx}`} target="_blank" rel="noreferrer">View transaction</a><button type="button" className="wl-btn wl-btn-main wl-full" onClick={onClose}>Done</button></>) : (<>
          <label className="wl-field"><span>You pay</span>
            <div className="wl-amtin"><input inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" /><b>{inSym}</b>{bal ? <button type="button" onClick={() => setAmount(String(side === "buy" ? Math.max(0, bal - (inSym === "SOL" ? 0.01 : inSym === "TON" ? 0.3 : inSym === "USDT" ? 0 : 0.002)) : bal))}>Max</button> : null}</div>
          </label>
          <p className="wl-sub">Available {bal === null ? "…" : bal.toLocaleString("en-US", { maximumFractionDigits: 6 })} {inSym}</p>
          <div className="wl-receive"><span>You receive</span><strong>{q ? q.out.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—"} {outSym}</strong>{q && q.impact > 1 && <small className="wl-err">Price impact {q.impact.toFixed(2)}%</small>}</div>
          {bal !== null && n > bal && <p className="wl-err">Not enough {inSym}</p>}
          {err && <p className="wl-err">{err}</p>}
          <button type="button" className="wl-btn wl-btn-main wl-full" disabled={!q || busy || (bal !== null && n > bal)} onClick={go}>{busy && <Loader2 className="wl-spin" size={18} />}{side === "buy" ? "Buy" : "Sell"}</button>
          <p className="wl-disclaimer">{`Trades run on ${net.label} with 1% max slippage. A small ${net.paySym} network fee applies.`}</p>
        </>)}
      </div>
    </div>
  );
}
