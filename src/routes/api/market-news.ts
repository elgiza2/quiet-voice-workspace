import { createFileRoute } from "@tanstack/react-router";

const FEEDS = [
  { url: "https://cointelegraph.com/rss", source: "Cointelegraph" },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk" },
];

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim() : "";
};

/** Public crypto/market headlines from free RSS feeds (no private data). */
export const Route = createFileRoute("/api/market-news")({
  server: {
    handlers: {
      GET: async () => {
        const all = await Promise.all(FEEDS.map(async (f) => {
          try {
            const xml = await (await fetch(f.url, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
            return xml.split("<item>").slice(1, 12).map((it) => ({
              title: tag(it, "title"),
              link: tag(it, "link"),
              date: tag(it, "pubDate"),
              image: it.match(/<media:content[^>]*url="([^"]+)"/)?.[1] || it.match(/<enclosure[^>]*url="([^"]+)"/)?.[1] || "",
              source: f.source,
            }));
          } catch { return []; }
        }));
        const items = all.flat().filter((i) => i.title && i.link?.startsWith("http"))
          .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 20);
        return Response.json({ items }, { headers: { "Cache-Control": "public, max-age=300" } });
      },
    },
  },
});
