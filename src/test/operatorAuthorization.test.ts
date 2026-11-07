import { describe, expect, it } from "vitest";
import { operatorAuthorized } from "../../supabase/functions/_shared/operatorAuthorization";

describe("privileged scheduled operations", () => {
  it("rejects all callers when no operator secret is configured", () => {
    expect(operatorAuthorized(undefined, null)).toBe(false);
    expect(operatorAuthorized("", "anything")).toBe(false);
  });
  it("requires the configured operator credential", () => {
    expect(operatorAuthorized("test-only", "incorrect")).toBe(false);
    expect(operatorAuthorized("test-only", "test-only")).toBe(true);
  });
});