import { describe, expect, it } from "vitest";
import { agentProposalSchema } from "./agentProposal";

describe("Agent creation proposals", () => {
  it("requires a meaningful description and instructions", () => {
    expect(agentProposalSchema.safeParse({ name: "Researcher", description: "", prompt: "" }).success).toBe(false);
  });
  it("validates a complete proposal and defaults its visual identity", () => {
    const result = agentProposalSchema.parse({ name: "Researcher", description: "Research trustworthy sources", prompt: "Compare primary sources and ask clarifying questions before starting." });
    expect(result.color).toBe("ocean");
    expect(result.name).toBe("Researcher");
  });
});