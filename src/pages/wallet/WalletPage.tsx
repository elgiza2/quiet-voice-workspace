import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownToLine, ChevronLeft, Copy, QrCode, Search, Send, Wallet, X } from "lucide-react";
import SEOHead from "@/components/common/SEOHead";
import "@/styles/wallet.css";

/** Phantom-style wallet shell. Addresses appear only once a wallet provider issues them; nothing is invented. */
const NETWORKS = ["Solana", "Ethereum", "Bitcoin", "BNB Chain", "Base", "Polygon", "Arbitrum", "TON"] as const;
type View = "home" | "receive" | "send";

export default function WalletPage() {
  const nav = useNavigate();
  const [view, setView] = useState<View>("home");
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  return (
    <div className="wl" dir="ltr">
      <SEOHead path="/wallet" title="Ceyo Wallet" description="Your multi-network crypto wallet inside Ceyo." />
      {view === "home" && (
        <>
          <header className="wl-top">
            <button type="button" className="wl-round" aria-label="Back" onClick={() => nav("/")}><ChevronLeft size={22} /></button>
            <span className="wl-pill wl-pill-on">Home</span>
          </header>
          <p className="wl-acct">Account 1</p>
          <h1 className="wl-bal">$0.00</h1>
          <p className="wl-delta">+$0.00 <span>0.00%</span></p>
          <div className="wl-actions">
            <button type="button" className="wl-btn" onClick={() => setView("send")}><Send size={18} />Send</button>
            <button type="button" className="wl-btn" onClick={() => setView("receive")}><ArrowDownToLine size={18} />Deposit</button>
          </div>
          <div className="wl-card wl-row"><Wallet size={22} /><strong>Cash</strong><span className="wl-end">$0.00</span></div>
          <h2 className="wl-h">Tokens</h2>
          <div className="wl-card wl-empty">No tokens yet. Deposit to get started.</div>
          <p className="wl-note">Your wallet addresses will be created automatically once wallet service is activated for your account.</p>
        </>
      )}

      {view === "receive" && (
        <>
          <header className="wl-top"><button type="button" className="wl-round" aria-label="Back" onClick={() => setView("home")}><ChevronLeft size={22} /></button><h2 className="wl-title">Receive</h2></header>
          <div className="wl-list">
            {NETWORKS.map((n) => (
              <div key={n} className="wl-card wl-net">
                <span className="wl-logo">{n[0]}</span>
                <span className="wl-net-copy"><strong>{n}</strong><small>Address pending</small></span>
                <button type="button" className="wl-sq" aria-label={`${n} QR`} disabled><QrCode size={18} /></button>
                <button type="button" className="wl-sq" aria-label={`Copy ${n}`} disabled><Copy size={18} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {view === "send" && (
        <>
          <header className="wl-top"><button type="button" className="wl-round" aria-label="Close" onClick={() => setView("home")}><X size={20} /></button><h2 className="wl-title">Send</h2></header>
          <label className="wl-search"><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" /></label>
          <div className="wl-chips">
            {["all", ...NETWORKS].map((n) => <button type="button" key={n} data-on={filter === n} onClick={() => setFilter(n)}>{n === "all" ? "All" : n}</button>)}
          </div>
          <div className="wl-card wl-empty">Nothing to send yet.</div>
        </>
      )}
    </div>
  );
}
