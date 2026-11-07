import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, ArrowDownToLine, Check, ChevronLeft, Copy, QrCode, Search, Send, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import SEOHead from "@/components/common/SEOHead";
import { addressFor, fetchMarkets, fetchWallet, WALLET_TOKENS, type Addresses, type Market } from "./walletTokens";
import MarketsView, { CoinDetail } from "./MarketsView";
import "@/styles/wallet.css";

type View = "home" | "receive" | "send";
type Token = (typeof WALLET_TOKENS)[number];
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n > 0 && n < 1 ? 4 : 2 });
const amount = (n: number) => (n ? n.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "0");
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function TokenIcon({ m, symbol }: { m?: Market; symbol: string }) {
  return m?.image ? <img className="wl-logo wl-img" src={m.image} alt="" loading="lazy" /> : <span className="wl-logo">{symbol[0]}</span>;
}

export default function WalletPage() {
  const nav = useNavigate();
  const [view, setView] = useState<View>("home");
  const [tab, setTab] = useState<"home" | "trade">("home");
  const [coin, setCoin] = useState<string | null>(null);
  useEffect(() => { window.scrollTo(0, 0); }, [coin, view, tab]);
  const [q, setQ] = useState("");
  const [markets, setMarkets] = useState<Record<string, Market>>({});
  const [priceError, setPriceError] = useState(false);
  const [addresses, setAddresses] = useState<Addresses | null>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [walletError, setWalletError] = useState("");
  const [qr, setQr] = useState<Token | null>(null);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let ctrl = new AbortController();
    const load = () => fetchMarkets(ctrl.signal).then((m) => { setMarkets(m); setPriceError(false); }).catch(() => { if (!ctrl.signal.aborted) setPriceError(true); });
    const loadWallet = () => fetchWallet().then((w) => { setAddresses(w.addresses); setBalances(w.balances); setWalletError(""); }).catch((e) => setWalletError(e instanceof Error ? e.message : "Wallet unavailable"));
    load(); void loadWallet();
    const t = setInterval(() => { ctrl.abort(); ctrl = new AbortController(); load(); void loadWallet(); }, 60000);
    return () => { clearInterval(t); ctrl.abort(); };
  }, []);

  const value = (t: Token) => (balances[t.id] || 0) * (markets[t.id]?.current_price || 0);
  const total = WALLET_TOKENS.reduce((s, t) => s + value(t), 0);
  const filtered = useMemo(() => WALLET_TOKENS.filter((t) => (balances[t.id] || 0) > 0 && `${t.name} ${t.symbol} ${t.network}`.toLowerCase().includes(q.toLowerCase())), [q, balances]);
  // One row per network: tokens on the same chain (e.g. USDT on Ethereum) arrive at that chain's address.
  const receiveList = useMemo(() => WALLET_TOKENS.filter((t, i) => WALLET_TOKENS.findIndex((o) => addressFor(o.network, { evm: "e", solana: "s", bitcoin: "b", ton: "t" }) === addressFor(t.network, { evm: "e", solana: "s", bitcoin: "b", ton: "t" })) === i), []);
  const copy = (t: Token) => { if (!addresses) return; void navigator.clipboard.writeText(addressFor(t.network, addresses)); setCopied(t.id); setTimeout(() => setCopied(""), 1500); };

  const rows = (list: readonly Token[], action?: "receive") => (
    <div className="wl-list">
      {list.map((t) => {
        const m = markets[t.id]; const ch = m?.price_change_percentage_24h ?? null;
        return (
          <div key={t.id} className={`wl-card wl-net ${action ? "" : "wl-tap"}`} role={action ? undefined : "button"} tabIndex={action ? undefined : 0}
            onClick={action ? undefined : () => { if (view === "send") return; setCoin(t.id); }}>
            <TokenIcon m={m} symbol={t.symbol} />
            <span className="wl-net-copy">
              <strong>{t.name}</strong>
              {action === "receive"
                ? <small>{t.network === "Ethereum" ? "Ethereum, Base, BNB, Polygon, Arbitrum + tokens (USDT, USDC…)" : t.network} · {addresses ? short(addressFor(t.network, addresses)) : "…"}</small>
                : <small>{m ? usd(m.current_price) : "—"}{ch !== null && <em data-up={ch >= 0}> {ch >= 0 ? "+" : ""}{ch.toFixed(2)}%</em>}</small>}
            </span>
            {action === "receive" ? (
              <><button type="button" className="wl-sq" aria-label={`${t.symbol} QR`} disabled={!addresses} onClick={() => setQr(t)}><QrCode size={18} /></button>
              <button type="button" className="wl-sq" aria-label={`Copy ${t.symbol} address`} disabled={!addresses} onClick={() => copy(t)}>{copied === t.id ? <Check size={18} /> : <Copy size={18} />}</button></>
            ) : (
              <span className="wl-amt"><strong>{usd(value(t))}</strong><small>{amount(balances[t.id] || 0)} {t.symbol}</small></span>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="wl" dir="ltr">
      <SEOHead path="/wallet" title="Ceyo Wallet" description="Your multi-network crypto wallet inside Ceyo." />
      {coin && <CoinDetail id={coin} balance={balances[coin] || 0} onBack={() => setCoin(null)} onReceive={() => { setCoin(null); setView("receive"); }} onSend={() => { setCoin(null); setView("send"); }} />}
      {!coin && view === "home" && (
        <>
          <header className="wl-top">
            <button type="button" className="wl-round" aria-label="Back" onClick={() => nav("/")}><ChevronLeft size={22} /></button>
            <div className="wl-tabs">
              <button type="button" className={`wl-pill ${tab === "home" ? "wl-pill-on" : ""}`} onClick={() => setTab("home")}>Home</button>
              <button type="button" className={`wl-pill ${tab === "trade" ? "wl-pill-on" : ""}`} onClick={() => setTab("trade")}>Markets</button>
            </div>
          </header>
          {tab === "trade" ? <MarketsView onOpen={setCoin} /> : <>
          <p className="wl-acct">Account 1</p>
          <h1 className="wl-bal">{usd(total)}</h1>
          <p className="wl-acct" style={{ marginTop: 6 }}>{WALLET_TOKENS.length} coins · prices update live</p>
          <div className="wl-qa">
            <button type="button" onClick={() => setView("receive")}><span><ArrowDownToLine size={22} /></span>Receive</button>
            <button type="button" onClick={() => setView("send")}><span><Send size={22} /></span>Send</button>
            <button type="button" onClick={() => setTab("trade")}><span><TrendingUp size={22} /></span>Markets</button>
          </div>
          <h2 className="wl-h">Tokens</h2>
          {walletError && <p className="wl-note" role="alert">{walletError}</p>}
          {priceError && <p className="wl-note">Live prices are unavailable right now.</p>}
          {rows(WALLET_TOKENS)}
          </>}
        </>
      )}
      {!coin && view === "receive" && (
        <>
          <header className="wl-top"><button type="button" className="wl-round" aria-label="Back" onClick={() => setView("home")}><ChevronLeft size={22} /></button><h2 className="wl-title">Receive</h2></header>
          {rows(receiveList, "receive")}
          <p className="wl-note">Only send each coin on the network shown under it.</p>
        </>
      )}
      {!coin && view === "send" && (
        <>
          <header className="wl-top"><button type="button" className="wl-round" aria-label="Close" onClick={() => setView("home")}><X size={20} /></button><h2 className="wl-title">Send</h2></header>
          <label className="wl-search"><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" /></label>
          <div style={{ height: 14 }} />
          {rows(filtered)}
          {filtered.length === 0 && <p className="wl-note">{q ? "No coins match your search." : "You have no balance to send yet."}</p>}
        </>
      )}
      {qr && addresses && (
        <div className="wl-sheet" role="dialog" aria-label={`${qr.name} address`} onClick={() => setQr(null)}>
          <div className="wl-card wl-qr" onClick={(e) => e.stopPropagation()}>
            <strong>{qr.name} · {qr.network}</strong>
            <div className="wl-qr-box"><QRCodeSVG value={addressFor(qr.network, addresses)} size={210} /></div>
            <code>{addressFor(qr.network, addresses)}</code>
            <button type="button" className="wl-btn" onClick={() => copy(qr)}>{copied === qr.id ? <Check size={18} /> : <Copy size={18} />}Copy address</button>
          </div>
        </div>
      )}
    </div>
  );
}
