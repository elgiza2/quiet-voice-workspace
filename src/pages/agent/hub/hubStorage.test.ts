import { beforeEach, describe, expect, it } from "vitest";
import { EMPTY_HUB_LOCAL, groupPrompt, groupTranscript, loadHubLocal, makeGroup, saveHubLocal } from "./hubStorage";

describe("agent hub local state", () => {
  beforeEach(() => window.localStorage.clear());

  it("requires at least two distinct bots in a group", () => {
    expect(() => makeGroup({ name: "Trading", coordinatorId: "lead", memberIds: ["one", "one"] })).toThrow(
      "at least two bots",
    );
    const group = makeGroup({ name: "Trading", coordinatorId: "lead", memberIds: ["one", "two", "two"] });
    expect(group.memberIds).toEqual(["one", "two"]);
    expect(group.category).toBe("Unassigned");
  });

  it("keeps groups, categories and hidden chats separated by account", () => {
    saveHubLocal("user-a", {
      ...EMPTY_HUB_LOCAL,
      groups: [makeGroup({ name: "Trading", coordinatorId: "lead", memberIds: ["one", "two"] })],
      categories: { "bot:one": "Trading" },
      hidden: ["bot:two"],
    });
    expect(loadHubLocal("user-a").groups).toHaveLength(1);
    expect(loadHubLocal("user-a").hidden).toEqual(["bot:two"]);
    expect(loadHubLocal("user-b")).toEqual(EMPTY_HUB_LOCAL);
  });

  it("puts the real member roster in the coordinator instructions", () => {
    const prompt = groupPrompt("Trading", [
      { name: "Analyst", description: "Market analysis", prompt: "Check numbers." },
      { name: "Guard", description: "Risk review", prompt: "Reject unsafe trades." },
    ]);
    expect(prompt).toContain("@BotName");
    expect(prompt).toContain("[[speaker: Exact Bot Name]]");
    expect(prompt).toContain("Analyst");
    expect(prompt).toContain("Reject unsafe trades.");
  });

  it("attributes each group contribution to its named bot", () => {
    expect(groupTranscript("[[speaker: Analyst]]\nPrices rose.\n[[speaker: Guard]]\nKeep the position small.")).toEqual([
      { speaker: "Analyst", text: "Prices rose." },
      { speaker: "Guard", text: "Keep the position small." },
    ]);
    expect(groupTranscript("A normal answer.")).toEqual([{ speaker: "", text: "A normal answer." }]);
  });
});
