import { useState } from "react";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { walletAction } from "./walletTokens";

type Props = { token: { id: string; name: string; symbol: string; network: string }; balance: number; price: number; image?: string; onBack: () => void; onDone: () => void };

export default function SendForm({ token, balance, price, image, onBack, onDone }: Props) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "sending" | "done">("form");
  const [err, setErr] = useState("");
  const [tx, setTx] = useState("");
  const n = Number(amount);
  const valid = to.trim().length >= 20 && n > 0 && n <= balance;

  const send = async () => {
    setStep("sending"); setErr("");
    try { const r = await walletAction<{ tx: string }>({ action: "send", token: token.id, to: to.trim(), amount }); setTx(String(r.tx)); setStep("done"); }
    catch (e) { setErr(e instanceof Error ? e.message : "Send failed"); setStep("confirm"); }
  };

  if (step === "done") return (
    <div className="wl-done">
      <span className="wl-done-ic"><Check size={36} /></span>
      <h2 className="wl-title">Sent</h2>
      <p className="wl-sub">{amount} {token.symbol} is on its way. It can take a few minutes to arrive.</p>
      {tx && <code className="wl-tx">{tx}</code>}
      <button type="button" className="wl-btn wl-btn-main" onClick={onDone}>Done</button>
    </div>
  );

  return (
    <>
      <header className="wl-top"><button type="button" className="wl-round" aria-label="Back" onClick={step === "confirm" ? () => setStep("form") : onBack}><ChevronLeft size={22} /></button><h2 className="wl-title">Send {token.symbol}</h2></header>
      {step === "form" ? (
        <div className="wl-form">
          <label className="wl-field"><span>To ({token.network} address)</span><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient address" autoComplete="off" spellCheck={false} /></label>
          <label className="wl-field"><span>Amount</span>
            <div className="wl-amtin"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" /><b>{token.symbol}</b><button type="button" onClick={() => setAmount(String(balance))}>Max</button></div>
          </label>
          <p className="wl-sub">≈ ${(n * price || 0).toFixed(2)} · Available {balance.toLocaleString("en-US", { maximumFractionDigits: 6 })} {token.symbol}</p>
          {n > balance && <p className="wl-err">More than your balance</p>}
          <button type="button" className="wl-btn wl-btn-main wl-full" disabled={!valid} onClick={() => setStep("confirm")}>Review</button>
        </div>
      ) : (
        <div className="wl-form">
          <div className="wl-card wl-confirm">
            {image && <img src={image} alt="" />}
            <strong>{amount} {token.symbol}</strong>
            <span>≈ ${(n * price).toFixed(2)}</span>
          </div>
          <dl className="wl-stats"><dt>To</dt><dd className="wl-addr">{to.slice(0, 8)}…{to.slice(-6)}</dd><dt>Network</dt><dd>{token.network}</dd><dt>Network fee</dt><dd>Paid from your {token.network} balance</dd></dl>
          {err && <p className="wl-err">{err}</p>}
          <button type="button" className="wl-btn wl-btn-main wl-full" disabled={step === "sending"} onClick={send}>{step === "sending" ? <Loader2 className="wl-spin" size={18} /> : null}Send now</button>
        </div>
      )}
    </>
  );
}
