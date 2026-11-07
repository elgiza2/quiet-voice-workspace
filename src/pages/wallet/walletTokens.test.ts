import { expect, it } from "vitest";
import { platformFee, PLATFORM_FEE_BPS } from "./walletTokens";

it("charges a 0.5% platform fee on transfers", () => {
  expect(PLATFORM_FEE_BPS).toBe(50);
  expect(platformFee(100)).toBe(0.5);
});
