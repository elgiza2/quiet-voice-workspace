import { expect, it } from "vitest";
import { replyLanguageInstruction } from "./replyLanguage";

it("Arabic user prose wins over an English assistant reply and English tool results", () => {
  const instruction = replyLanguageInstruction([{ role: "user", content: "ازيك يا صاحبي عامل ايه" }, { role: "assistant", content: "Hello, how can I help?" }, { role: "tool", content: "English search result" }]);
  expect(instruction).toContain("MUST be Arabic, not English");
  expect(instruction).toContain("ازيك يا صاحبي عامل ايه");
});
it("switches language context for the latest user rather than retaining old Arabic", () => {
  const instruction = replyLanguageInstruction([{ role: "user", content: "ازيك" }, { role: "user", content: "Please answer me in English now" }]);
  expect(instruction).not.toContain("MUST be Arabic");
  expect(instruction).toContain("Please answer me in English now");
});
it("does not let English code or URLs override Arabic prose", () => {
  expect(replyLanguageInstruction([{ role: "user", content: "اشرحلي ده https://example.com/a-long-english-url\n```js\nconst greeting = 'Hello world';\n```" }])).toContain("MUST be Arabic");
});