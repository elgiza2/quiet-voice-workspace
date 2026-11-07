import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERMISSIONS,
  addPermissionRule,
  parsePermissionPreferences,
  permissionSummary,
  removePermissionRule,
} from "./settingsPreferences";

describe("Ceyo permission preferences", () => {
  it("adds an Always Ask rule without changing Allow without Asking rules", () => {
    const next = addPermissionRule(DEFAULT_PERMISSIONS, "ask", "  Stop before deleting files  ");
    expect(next.ask).toEqual(["Stop before deleting files"]);
    expect(next.allow).toEqual([]);
    expect(permissionSummary(next)).toBe("Auto-review on · 1 rule");
  });

  it("adds an Allow without Asking rule and removes only the selected rule", () => {
    const withRules = addPermissionRule(DEFAULT_PERMISSIONS, "allow", "Allow calendar reads");
    expect(withRules.allow).toEqual(["Allow calendar reads"]);
    expect(removePermissionRule(withRules, "allow", 0).allow).toEqual([]);
  });

  it("ignores empty rules and restores safe defaults from invalid stored data", () => {
    expect(addPermissionRule(DEFAULT_PERMISSIONS, "ask", "   ")).toBe(DEFAULT_PERMISSIONS);
    expect(parsePermissionPreferences("not json")).toEqual(DEFAULT_PERMISSIONS);
  });
});
