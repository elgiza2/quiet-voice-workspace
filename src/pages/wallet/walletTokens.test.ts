import { describe, expect, it } from "vitest";
import { FEE_BPS } from "@/lib/wallet/send.server";

describe("wallet platform fee", () => {
  it("is 0.5% on transfers", () => {
    expect(FEE_BPS).toBe(50);
  });
});
