import { describe, expect, it } from "vitest";
import { canUseAgent, isOctoberOfferActive, OCTOBER_OFFER_START, OCTOBER_OFFER_END } from "./octoberOffer";

describe("October offer boundaries", () => {
  it("lasts exactly 24 hours and excludes both outside boundaries", () => {
    expect(OCTOBER_OFFER_END - OCTOBER_OFFER_START).toBe(86_400_000);
    expect(isOctoberOfferActive(OCTOBER_OFFER_START - 1)).toBe(false);
    expect(isOctoberOfferActive(OCTOBER_OFFER_START)).toBe(true);
    expect(isOctoberOfferActive(OCTOBER_OFFER_END - 1)).toBe(true);
    expect(isOctoberOfferActive(OCTOBER_OFFER_END)).toBe(false);
  });
  it("unlocks non-media agents only for free users", () => {
    expect(canUseAgent("free", false, OCTOBER_OFFER_START)).toBe(true);
    expect(canUseAgent("free", true, OCTOBER_OFFER_START)).toBe(false);
    expect(canUseAgent("free", false, OCTOBER_OFFER_END)).toBe(false);
    expect(canUseAgent("pro", true, OCTOBER_OFFER_END)).toBe(true);
  });
});