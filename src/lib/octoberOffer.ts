/** One immutable, time-bounded offer shared by the server and presentation. */
export const OCTOBER_OFFER_START = Date.parse("2026-10-06T00:52:09Z");
export const OCTOBER_OFFER_END = OCTOBER_OFFER_START + 24 * 60 * 60 * 1000;
export function isOctoberOfferActive(now = Date.now()) {
  return now >= OCTOBER_OFFER_START && now < OCTOBER_OFFER_END;
}
export function canUseAgent(tier: "free" | "pro", mediaOnly = false, now = Date.now()) {
  return tier === "pro" || (!mediaOnly && isOctoberOfferActive(now));
}