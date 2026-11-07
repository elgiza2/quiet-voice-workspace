import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownToLine, ChevronLeft, Copy, QrCode, Search, Send, X } from "lucide-react";
import SEOHead from "@/components/common/SEOHead";
import { fetchMarkets, PLATFORM_FEE_BPS, WALLET_TOKENS, type Market } from "./walletTokens";
import "@/styles/wallet.css";

type View = "home" | "receive" | "send";
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 4 : 2 });

function TokenIcon({ m, symbol }: { m?: Market; symbol: string }) {
  return m?.image ? <img className="wl-logo wl-img" src={m.image} alt="" loading="lazy" /> : <span className="wl-logo">{symbol[0]}</span>;
}

export default function WalletPage() {
  const nav = useNavigate();
  const [view, setView] = useState<View>("home");
  const [q, setQ] = useState("");
  const [markets, setMarkets] = useState<Record<string, Market>>({});
  const [priceError, setPriceError] = useState(false);

  useEffect(() => {
    let ctrl = new AbortController();
    const load = () => fetchMarkets(ctrl.signal).then((m) => { setMarkets(m); setPriceError(false); }).catch((e) => { if (!ctrl.signal.aborted) setPriceError(true); void e; });
    load();
    const t = setInterval(() => { ctrl.abort(); ctrl = new AbortController(); load(); }, 60000);
    return () => { clearInterval(t); ctrl.abort(); };
  }, []);

  const filtered = useMemo(() => WALLET_TOKENS.filter((t) => `${t.name} ${t.symbol} ${t.network}`.toLowerCase().includes(q.toLowerCase())), [q]);

  const rows = (list: readonly (typeof WALLET_TOKENS)[number][], action?: "send" | "receive") => (
    <div className="wl-list">
      {list.map((t) => {
        const m = markets[t.id]; const ch = m?.price_change_percentage_24h ?? null;
        return (
          <div key={t.id} className="wl-card wl-net">
            <TokenIcon m={m} symbol={t.symbol} />
            <span className="wl-net-copy">
              <strong>{t.name}</strong>
              <small>{m ? usd(m.current_price) : "—"}{ch !== null && <em data-up={ch >= 0}> {ch >= 0 ? "+" : ""}{ch.toFixed(2)}%</em>}</small>
            </span>
            {action === "receive" ? (
              <><button type="button" className="wl-sq" aria-label={`${t.symbol} QR`} disabled><QrCode size={18} /></button>
              <button type="button" className="wl-sq" aria-label={`Copy ${t.symbol}`} disabled><Copy size={18} /></button></>
            ) : (
              <span className="wl-amt"><strong>$0.00</strong><small>0 {t.symbol}</small></span>
            )}
          </div>
        );
      })}
    </div>
  );

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
            <button type="button" className="wl-btn" onClick={() => setView("receive")}><ArrowDownToLine size={18} />Receive</button>
          </div>
          <h2 className="wl-h">Tokens</h2>
          {priceError && <p className="wl-note">Live prices are unavailable right now.</p>}
          {rows(WALLET_TOKENS)}
        </>
      )}
      {view === "receive" && (
        <>
          <header className="wl-top"><button type="button" className="wl-round" aria-label="Back" onClick={() => setView("home")}><ChevronLeft size={22} /></button><h2 className="wl-title">Receive</h2></header>
          {rows(WALLET_TOKENS, "receive")}
          <p className="wl-note">Addresses appear once the wallet service is activated for your account.</p>
        </>
      )}
      {view === "send" && (
        <>
          <header className="wl-top"><button type="button" className="wl-round" aria-label="Close" onClick={() => setView("home")}><X size={20} /></button><h2 className="wl-title">Send</h2></header>
          <label className="wl-search"><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" /></label>
          <div style={{ height: 14 }} />
          {rows(filtered)}
          <p className="wl-note">A {PLATFORM_FEE_BPS / 100}% service fee applies to transfers. You have no balance to send yet.</p>
        </>
      )}
    </div>
  );
}
