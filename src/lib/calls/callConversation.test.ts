import { expect, it } from "vitest";
import { hasCallConversation } from "./callConversation";
it("follows up only calls with actual user speech, not failed setup or a greeting alone", () => {
  expect(hasCallConversation([])).toBe(false);
  expect(hasCallConversation([{ role: "assistant", text: "Hello" }])).toBe(false);
  expect(hasCallConversation([{ role: "user", text: " " }])).toBe(false);
  expect(hasCallConversation([{ role: "user", text: "عايز نكمل تقرير المبيعات" }])).toBe(true);
});