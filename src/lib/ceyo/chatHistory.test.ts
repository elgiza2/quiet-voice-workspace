import { describe, it, expect } from "vitest";
import { normalizeChatHistory } from "./chatHistory";
describe("chat history", () => {
  it("keeps the latest user goal last and removes internal speaker markers", () => {
    expect(normalizeChatHistory([{ role: "user", content: "Calculate 2+3" }, { role: "assistant", content: "[[speaker: Writer]]\nOld reply" }])).toEqual([{ role: "assistant", content: "Old reply" }, { role: "user", content: "Calculate 2+3" }]);
  });
  it("does not replay interrupted assistant work as a completed answer", () => {
    expect(normalizeChatHistory([{ role: "assistant", content: "interrupted", metadata: { incomplete: true } }])).toEqual([]);
  });
});