import { expect, it } from "vitest";
import { classifyProviderFailure, canUseAuthorizedBackup } from "./providerFailover";
it("never swaps keys to evade a rate limit", () => {
  expect(classifyProviderFailure(429)).toBe("rate_limit");
  expect(canUseAuthorizedBackup("rate_limit", true)).toBe(false);
});
it("requires provider-authorized backup even when credit is exhausted", () => {
  expect(classifyProviderFailure(402)).toBe("exhausted");
  expect(canUseAuthorizedBackup("exhausted", false)).toBe(false);
  expect(canUseAuthorizedBackup("exhausted", true)).toBe(true);
});
it("does not retry bad requests on another account", () => {
  expect(canUseAuthorizedBackup(classifyProviderFailure(400), true)).toBe(false);
});