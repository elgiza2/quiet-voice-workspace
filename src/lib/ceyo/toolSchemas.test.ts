import { describe, expect, it } from "vitest";
import { groupInput, actionInput, roleName, teamInput } from "./toolSchemas";
describe("workspace validation", () => {
  const a = "00000000-0000-4000-8000-000000000001";
  const b = "00000000-0000-4000-8000-000000000002";
  it("requires different bots for a team", () => {
    expect(groupInput.safeParse({ name: "Team", member_ids: [a, a] }).success).toBe(false);
    expect(groupInput.safeParse({ name: "Team", member_ids: [a, b] }).success).toBe(true);
  });
  it("requires an explicit integration account", () => {
    expect(actionInput.safeParse({ tool_slug: "GMAIL_SEND_EMAIL", arguments: {} }).success).toBe(false);
    expect(actionInput.safeParse({ account_id: "account-1", tool_slug: "GMAIL_SEND_EMAIL", arguments: {} }).success).toBe(true);
  });
  it("rejects bot names that contain the word bot", () => {
    expect(roleName.safeParse("ResearchBot").success).toBe(false);
    expect(roleName.safeParse("بوت الكتابة").success).toBe(false);
    expect(roleName.safeParse("Researcher").success).toBe(true);
    expect(roleName.safeParse("الكاتب").success).toBe(true);
  });
  it("builds a team only with distinct role names", () => {
    const m = (name: string) => ({ name, instructions: "Do the job" });
    expect(teamInput.safeParse({ name: "X Posting Team", members: [m("Researcher"), m("Writer")] }).success).toBe(true);
    expect(teamInput.safeParse({ name: "X Posting Team", members: [m("Writer"), m("writer")] }).success).toBe(false);
    expect(teamInput.safeParse({ name: "X Posting Team", members: [m("Writer")] }).success).toBe(false);
  });
});
