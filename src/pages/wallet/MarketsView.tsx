import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, Check, ChevronLeft, Copy, ExternalLink, Globe, Send as Tg } from "lucide-react";

const CG = "https://api.coingecko.com/api/v3";
type Coin = { id: string; symbol: string; name: string; image: string; current_price: number; market_cap: number; price_change_percentage_24h: number | null; sparkline_in_7d?: { price: number[] } };
type News = { title: string; link: string; date: string; image: string; source: string };
type Hot = { item: { id: string; symbol: string; name: string; small: string; data?: { price?: number; market_cap?: string; price_change_percentage_24h?: { usd?: number } } } };

const CATS = [
  { key: "trending", label: "Trending" },
  { key: "majors", label: "Majors" },
  { key: "meme-token", label: "Memes" },
  { key: "tokenized-stock", label: "Stocks" },
  { key: "layer-1", label: "Layer 1" },
];
const RANGES = [{ k: "1", l: "1D" }, { k: "7", l: "1W" }, { k: "30", l: "1M" }, { k: "365", l: "1Y" }, { k: "max", l: "All" }];

export const usdFmt = (n: number) => n >= 1 ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }) : `$${n.toPrecision(3)}`;
const big = (n: number) => n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`;
const ago = (d: string) => { const m = Math.max(1, Math.round((Date.now() - Date.parse(d)) / 60000)); return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
const Pct = ({ v }: { v: number | null | undefined }) => v == null ? null : <em className="wl-delta" data-up={v >= 0}>{v >= 0 ? "+" : ""}{v.toFixed(2)}%</em>;

function Spark({ data, up, h = 60 }: { data: number[]; up: boolean; h?: number }) {
  if (data.length < 2) return <div style={{ height: h }} />;
  const min = Math.min(...data), max = Math.max(...data), r = max - min || 1;
  const pts = data.map((p, i) => `${(i / (data.length - 1)) * 100},${h - ((p - min) / r) * (h - 4) - 2}`).join(" ");
  return <svg className="wl-spark" viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ height: h }}><polyline points={pts} fill="none" data-up={up} strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></svg>;
}

function Detail({ id, onBack, onReceive }: { id: string; onBack: () => void; onReceive: () => void }) {
  const [info, setInfo] = useState<any>(null);
  const [range, setRange] = useState("1");
  const [chart, setChart] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => { fetch(`${CG}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`).then((r) => r.json()).then(setInfo).catch(() => {}); }, [id]);
  useEffect(() => { setChart([]); fetch(`${CG}/coins/${id}/market_chart?vs_currency=usd&days=${range}`).then((r) => r.json()).then((d) => setChart((d.prices || []).map((p: number[]) => p[1]))).catch(() => {}); }, [id, range]);
  const md = info?.market_data;
  const price = md?.current_price?.usd ?? 0;
  const ch = chart.length > 1 ? ((chart[chart.length - 1] - chart[0]) / chart[0]) * 100 : md?.price_change_percentage_24h ?? 0;
  const platforms = Object.entries(info?.platforms || {}).filter(([k, v]) => k && v) as [string, string][];
  const links = info?.links;
  return (
    <>
      <header className="wl-top"><button type="button" className="wl-round" aria-label="Back" onClick={onBack}><ChevronLeft size={22} /></button>{info?.image?.small && <img className="wl-logo wl-img" src={info.image.small} alt="" />}</header>
      <h1 className="wl-title" style={{ fontSize: 30 }}>{info?.name ?? "…"}</h1>
      <h2 className="wl-bal" style={{ marginTop: 4 }}>{price ? usdFmt(price) : "—"}</h2>
      <Pct v={ch} />
      <div className="wl-chart"><Spark data={chart} up={ch >= 0} h={200} /></div>
      <div className="wl-chips">{RANGES.map((r) => <button key={r.k} type="button" className={`wl-pill ${range === r.k ? "wl-pill-on" : ""}`} onClick={() => setRange(r.k)}>{r.l}</button>)}</div>
      <div className="wl-actions" style={{ marginTop: 18 }}>
        <button type="button" className="wl-btn" onClick={onReceive}><ArrowDownToLine size={18} />Receive</button>
      </div>
      {info?.description?.en && <><h2 className="wl-h">About {info.name}</h2><p className="wl-about">{info.description.en.replace(/<[^>]+>/g, "").slice(0, 320)}…</p></>}
      <div className="wl-chips">
        {links?.homepage?.[0] && <a className="wl-pill" href={links.homepage[0]} target="_blank" rel="noreferrer"><Globe size={15} /> Website</a>}
        {links?.twitter_screen_name && <a className="wl-pill" href={`https://x.com/${links.twitter_screen_name}`} target="_blank" rel="noreferrer">𝕏 Twitter</a>}
        {links?.telegram_channel_identifier && <a className="wl-pill" href={`https://t.me/${links.telegram_channel_identifier}`} target="_blank" rel="noreferrer"><Tg size={15} /> Telegram</a>}
      </div>
      <div className="wl-stats">
        <span>Rank</span><b>#{info?.market_cap_rank ?? "—"}</b>
        <span>24h Volume</span><b>{md ? big(md.total_volume.usd) : "—"}</b>
        <span>Market cap</span><b>{md ? big(md.market_cap.usd) : "—"}</b>
        <span>24h High / Low</span><b>{md ? `${usdFmt(md.high_24h.usd)} / ${usdFmt(md.low_24h.usd)}` : "—"}</b>
        {platforms[0] && <><span>Network</span><b style={{ textTransform: "capitalize" }}>{platforms[0][0].replace(/-/g, " ")}</b>
          <span>Contract</span><b><button type="button" className="wl-link" onClick={() => { void navigator.clipboard.writeText(platforms[0][1]); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{platforms[0][1].slice(0, 6)}…{platforms[0][1].slice(-4)} {copied ? <Check size={14} /> : <Copy size={14} />}</button></b></>}
      </div>
      {info?.categories?.length > 0 && <><h2 className="wl-h">Related lists</h2><div className="wl-chips">{info.categories.slice(0, 6).map((c: string) => <span key={c} className="wl-pill">{c}</span>)}</div></>}
    </>
  );
}

export default function MarketsView({ onReceive }: { onReceive: () => void }) {
  const [cat, setCat] = useState("trending");
  const [hot, setHot] = useState<Hot[]>([]);
  const [list, setList] = useState<Coin[]>([]);
  const [stocks, setStocks] = useState<Coin[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch(`${CG}/search/trending`).then((r) => r.json()).then((d) => setHot(d.coins || [])).catch(() => setErr(true));
    fetch(`${CG}/coins/markets?vs_currency=usd&category=tokenized-stock&order=market_cap_desc&per_page=10&sparkline=true`).then((r) => r.json()).then((d) => Array.isArray(d) && setStocks(d)).catch(() => {});
    fetch("/api/market-news").then((r) => r.json()).then((d) => setNews(d.items || [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (cat === "trending") return;
    setList([]);
    const q = cat === "majors" ? "" : `&category=${cat}`;
    fetch(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&sparkline=false${q}`).then((r) => r.json()).then((d) => Array.isArray(d) ? setList(d) : setErr(true)).catch(() => setErr(true));
  }, [cat]);

  const rows = useMemo(() => cat === "trending"
    ? hot.map((h) => ({ id: h.item.id, symbol: h.item.symbol, image: h.item.small, price: h.item.data?.price ?? 0, mc: h.item.data?.market_cap ?? "", ch: h.item.data?.price_change_percentage_24h?.usd ?? null }))
    : list.map((c) => ({ id: c.id, symbol: c.symbol.toUpperCase(), image: c.image, price: c.current_price, mc: big(c.market_cap), ch: c.price_change_percentage_24h })), [cat, hot, list]);

  if (open) return <Detail id={open} onBack={() => setOpen(null)} onReceive={onReceive} />;

  return (
    <>
      <h2 className="wl-h">Hot markets</h2>
      <div className="wl-scroll">
        {hot.slice(0, 8).map((h) => (
          <button type="button" key={h.item.id} className="wl-card wl-hot" onClick={() => setOpen(h.item.id)}>
            <img className="wl-logo wl-img" src={h.item.small} alt="" />
            <span><strong>{h.item.symbol}</strong><small>{h.item.data?.market_cap ?? ""} MC</small></span>
            <Pct v={h.item.data?.price_change_percentage_24h?.usd} />
          </button>
        ))}
      </div>
      <h2 className="wl-h">Explore markets</h2>
      <div className="wl-chips wl-scroll">{CATS.map((c) => <button key={c.key} type="button" className={`wl-pill ${cat === c.key ? "wl-pill-on" : ""}`} onClick={() => { setCat(c.key); setMore(false); }}>{c.label}</button>)}</div>
      {err && rows.length === 0 && <p className="wl-note">Market data is busy right now. Try again in a minute.</p>}
      <div className="wl-list">
        {rows.slice(0, more ? 30 : 6).map((r, i) => (
          <button type="button" key={r.id} className="wl-card wl-net" onClick={() => setOpen(r.id)}>
            <span className="wl-rankwrap"><img className="wl-logo wl-img" src={r.image} alt="" loading="lazy" /><i>{i + 1}</i></span>
            <span className="wl-net-copy"><strong>{r.symbol}</strong><small>Market cap: {r.mc || "—"}</small></span>
            <span className="wl-amt"><strong>{r.price ? usdFmt(r.price) : "—"}</strong><small><Pct v={r.ch} /></small></span>
          </button>
        ))}
      </div>
      {rows.length > 6 && !more && <button type="button" className="wl-btn wl-more" onClick={() => setMore(true)}>Show more</button>}

      {stocks.length > 0 && <>
        <h2 className="wl-h">Stocks</h2>
        <div className="wl-scroll">
          {stocks.map((s) => { const up = (s.price_change_percentage_24h ?? 0) >= 0; return (
            <button type="button" key={s.id} className="wl-card wl-stock" onClick={() => setOpen(s.id)}>
              <span className="wl-stock-h"><img className="wl-img" src={s.image} alt="" />{s.symbol.toUpperCase()}</span>
              <Spark data={s.sparkline_in_7d?.price ?? []} up={up} />
              <strong>{usdFmt(s.current_price)}</strong><Pct v={s.price_change_percentage_24h} />
            </button>); })}
        </div>
      </>}

      {news.length > 0 && <>
        <h2 className="wl-h">News</h2>
        <div className="wl-news">
          {news.map((n) => (
            <a key={n.link} href={n.link} target="_blank" rel="noreferrer" className="wl-news-item">
              <span><strong>{n.title}</strong><small>{n.source} · {ago(n.date)} <ExternalLink size={12} /></small></span>
              {n.image && <img src={n.image} alt="" loading="lazy" />}
            </a>
          ))}
        </div>
      </>}
      <p className="wl-note">Market data from CoinGecko. Past performance is not a guide to future results; trading carries high risk.</p>
    </>
  );
}
