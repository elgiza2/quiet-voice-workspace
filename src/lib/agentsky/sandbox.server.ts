/** Server-side sandbox for agent tools: code execution, web search/fetch.
 *  Runs on the server (not the browser Worker): blocks private networks,
 *  caps output, and never leaks secrets. */
const MAX_OUTPUT = 8000;
const clip = (s: string) => (s.length > MAX_OUTPUT ? `${s.slice(0, MAX_OUTPUT)}\n…[truncated]` : s);

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    /^(10|127)\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h === "169.254.169.254" ||
    h === "metadata.google.internal"
  );
}

/** Fail closed until a real remote execution service is connected. */
export async function runSandboxCode(
  _code: string,
  _timeoutMs = 15_000,
): Promise<{ ok: boolean; output: string }> {
  return { ok: false, output: "Code execution is unavailable: an isolated computer service must be connected." };
}

export async function serverWebFetch(rawUrl: string): Promise<{ ok: boolean; output: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, output: "Invalid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    return { ok: false, output: "Only http/https URLs are allowed" };
  if (isBlockedHost(parsed.hostname))
    return { ok: false, output: "Private network addresses are blocked" };
  const attempts = [parsed.toString(), `https://r.jina.ai/${parsed.toString()}`];
  let last = "";
  for (const url of attempts) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20_000);
      const resp = await fetch(url, {
        headers: { Accept: "text/plain", "User-Agent": "MegsyAgent/1.0" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!resp.ok) {
        last = `Fetch failed with ${resp.status}`;
        continue;
      }
      const text = await resp.text();
      if (text.trim().length > 50) return { ok: true, output: clip(text) };
      last = "Page returned almost no text";
    } catch (e: any) {
      last = `Fetch failed: ${String(e?.message || e).slice(0, 200)}`;
    }
  }
  return { ok: false, output: last || "Fetch failed" };
}

export async function serverWebSearch(
  query: string,
  news = false,
): Promise<{ ok: boolean; output: string }> {
  const q = query.trim().slice(0, 300);
  if (!q) return { ok: false, output: "A query is required." };
  const engine = news
    ? `https://news.google.com/rss/search?q=${encodeURIComponent(q)}`
    : `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  return serverWebFetch(engine);
}
