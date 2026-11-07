import { describe, it, expect } from "vitest";
import { routineInput, nextRoutineRun, validateVaultDetail, readTextAttachment } from "./content";
describe("resource rules", () => {
  it("reads actual text file bytes, not just a filename", async () => {
    expect((await readTextAttachment(new File(["amount,125.5"], "invoice.csv"))).content).toBe("amount,125.5");
  });
  it("rejects unsupported image analysis instead of claiming it read an image", async () => {
    await expect(readTextAttachment(new File(["image"], "photo.png"))).rejects.toThrow();
  });
  it("accepts only four card digits", () => { expect(validateVaultDetail("card", "1234")).toBe("1234"); expect(() => validateVaultDetail("card", "4111111111111111")).toThrow(); });
  it("schedules daily routines exactly 24 hours later", () => { expect(nextRoutineRun(24, new Date("2026-11-07T03:00:00Z"))).toBe("2026-11-08T03:00:00.000Z"); });
  it("schedules weekly routines exactly 168 hours later", () => { expect(nextRoutineRun(168, new Date("2026-11-07T03:00:00Z"))).toBe("2026-11-14T03:00:00.000Z"); });
  it("rejects unsupported schedules", () => { expect(routineInput.safeParse({ title: "Test", goal: "Research", interval_hours: 1 }).success).toBe(false); });
});