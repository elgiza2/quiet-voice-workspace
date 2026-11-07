import { describe, expect, it } from "vitest";
import { normalizeProvider } from "./telegram-keys";

describe("telegram provider routing", () => {
  it("maps buttons and commands to the three chat providers", () => {
    expect(normalizeProvider("keys:provider:cerebras".slice("keys:provider:".length))).toBe(
      "cerebras",
    );
    expect(normalizeProvider("cerebras")).toBe("cerebras");
    expect(normalizeProvider("composio")).toBe("composio");
    expect(normalizeProvider("browserbase")).toBe("browserbase");
    expect(normalizeProvider("agentsky")).toBeNull();
  });

  it("parses explicit add commands without relying on pending state", () => {
    const add = "/add_browserbase test-credential".match(
      /^\/add_([a-z]+)(?:@\w+)?\s+(\S+)$/i,
    );
    expect(add?.[1]).toBe("browserbase");
    expect(add?.[2]).toBe("test-credential");
    expect(normalizeProvider(add?.[1] ?? "")).toBe("browserbase");
  });

  it("parses the current numbered delete command", () => {
    const mod = "/del 2".match(/^\/del(?:@\w+)?\s+(\d+)$/i);
    expect(mod?.[1]).toBe("2");
  });
});
