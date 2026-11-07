/** @doc Server-side usage metering — credits come from measured consumption, never from a counter.
 *
 *  The anchor is fixed: **1 MC = $0.001 of measured provider cost**. Every rate below is
 *  AgentSky's published rate (see `notes-agentsky-real-costs.md`), and the same numbers live in
 *  the `usage_rates` table so the database can price a turn without trusting the browser.
 *
 *  What we measure, and where:
 *  - a chat turn  → the real input size, the real streamed output size and the seconds the agent
 *                   was actually awake (opened when the message is sent, settled when the stream
 *                   ends, swept by cron if the tab disappears first);
 *  - media        → the model and the real duration, charged before the run starts;
 *  - tools        → the published per-call rate.
 *
 *  All calls go through the caller's own JWT, so a browser can only ever open, settle or charge
 *  its own usage.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/api/supabaseServerConfig";

export const MC_PER_USD = 1000;

/** Published AgentSky rates, in USD per unit. */
export const USD = {
  computeSecondDefault: 0.000128,
  computeSecondSmall: 0.0000325,
  imageWan: 0.02145,
  imageWanPro: 0.053625,
  imageOpenAI: 0.2321,
  videoI2VSecond: 0.02684,
  videoMiniMaxSecond: 0.088,
  videoSeedanceSecond: 0.1672,
  webSearch: 0.0084,
  webFetch: 0.0012,
  ttsHdPerChar: 0.00007,
  sttPerSecond: 0.00011,
} as const;

/** Real cost of one media run, from its model and its real duration. */
export function mediaCostUsd(kind: "image" | "video", endpoint: string, seconds: number): number {
  if (kind === "video") {
    // Wan text-to-video is priced like the published Wan image-to-video second.
    if (/wan/i.test(endpoint)) return Math.max(1, seconds) * USD.videoI2VSecond;
    if (/seedance|byteplus|bytedance/i.test(endpoint)) return Math.max(1, seconds) * USD.videoSeedanceSecond;
    if (/minimax/i.test(endpoint)) return Math.max(1, seconds) * USD.videoMiniMaxSecond;
    return Math.max(1, seconds) * USD.videoI2VSecond;
  }
  if (/openai|gpt-image|dall/i.test(endpoint)) return USD.imageOpenAI;
  if (/wan.*pro/i.test(endpoint)) return USD.imageWanPro;
  if (/wan/i.test(endpoint)) return USD.imageWan;
  // Google's flash image model has no published per-asset rate yet; the mid published
  // image rate is used until AgentSky publishes one.
  return USD.imageWanPro;
}

/** Credits for a measured USD cost. Anything real costs at least 1 MC. */
export function creditsFromUsd(usd: number): number {
  return Math.max(1, Math.ceil(usd * MC_PER_USD));
}

export function bearer(request: Request): string {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function rpc<T>(fn: string, body: unknown, jwt: string): Promise<T | null> {
  if (!jwt) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** The caller's live balance, or null when it cannot be read. */
export async function creditBalance(jwt: string): Promise<number | null> {
  const data = await rpc<{ success?: boolean; credits?: number }>("get_credit_overview", {}, jwt);
  if (!data || data.success !== true) return null;
  return Number(data.credits ?? 0);
}

/** Charges a known real cost (media, tools). Returns null when the charge could not be made. */
export async function chargeKnown(
  jwt: string,
  usd: number,
  action: string,
  description: string,
): Promise<{ ok: boolean; credits: number; balance: number | null }> {
  const credits = creditsFromUsd(usd);
  const res = await rpc<{ success?: boolean; charged?: number; credits?: number }>(
    "charge_own_credits",
    { p_cost: credits, p_action: action, p_description: description },
    jwt,
  );
  if (!res) return { ok: false, credits, balance: null };
  return {
    ok: res.success === true,
    credits: Number(res.charged ?? 0),
    balance: res.credits === undefined ? null : Number(res.credits),
  };
}

/** Opens a metered turn for the caller and returns its id. */
export async function openTurn(
  jwt: string,
  sessionId: string,
  inputChars: number,
  modelTier: "cheap" | "standard" | "premium" = "cheap",
  machine: "default" | "small" = "small",
): Promise<string | null> {
  return rpc<string>("open_own_usage_turn", {
    p_session: sessionId,
    p_input_chars: Math.round(inputChars),
    p_model_tier: modelTier,
    p_machine: machine,
  }, jwt);
}

/**
 * The caller's newest unsettled turn for a session. Read through the caller's own
 * token, so RLS guarantees it can only ever be their own row.
 */
export async function latestOpenTurn(jwt: string, sessionId: string): Promise<string | null> {
  if (!jwt) return null;
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/usage_turns?session_id=eq.${encodeURIComponent(sessionId)}` +
      `&status=eq.open&select=id&order=created_at.desc&limit=1`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ id?: string }>;
    return rows?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Settles a turn from what the stream really produced and how long it really ran. */
export async function settleTurn(
  jwt: string,
  turnId: string,
  outputChars: number,
  awakeSeconds: number,
): Promise<void> {
  await rpc("settle_own_usage_turn", {
    p_turn_id: turnId,
    p_output_chars: Math.round(outputChars),
    p_awake_seconds: Math.max(0, awakeSeconds),
  }, jwt);
}

/**
 * Counts the assistant text a streamed turn really produced, and how long it ran.
 * Tool output and status frames are not billed as output tokens.
 */
export class TurnMeter {
  private decoder = new TextDecoder();
  private buffer = "";
  private startedAt = Date.now();
  private done = false;
  chars = 0;

  get seconds(): number {
    return (Date.now() - this.startedAt) / 1000;
  }

  push(chunk: Uint8Array): void {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) this.line(line.trim());
  }

  /** Ends the measurement and returns the totals. */
  finish(): { chars: number; seconds: number } {
    if (this.done) return { chars: this.chars, seconds: this.seconds };
    this.done = true;
    if (this.buffer.trim()) this.line(this.buffer.trim());
    this.buffer = "";
    return { chars: this.chars, seconds: this.seconds };
  }

  private line(line: string): void {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let event: any;
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }
    const type = String(event?.type ?? "");
    if (/user\.message/.test(type)) return;
    this.chars += textLength(event);
  }
}

/** Character length of the assistant-visible text inside one provider event. */
function textLength(value: unknown, depth = 0): number {
  if (depth > 4 || value == null) return 0;
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) return value.reduce<number>((n, v) => n + textLength(v, depth + 1), 0);
  if (typeof value !== "object") return 0;
  let total = 0;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    // Reasoning is real model output and is billed; ids, roles and statuses are not.
    if (/^(id|role|type|status|name|model|session|created|updated|tool|call|arguments|result|error)$/i.test(key)) continue;
    total += textLength(child, depth + 1);
  }
  return total;
}
