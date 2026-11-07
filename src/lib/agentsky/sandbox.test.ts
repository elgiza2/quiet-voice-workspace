import { describe, expect, it } from "vitest";
import { runSandboxCode } from "./sandbox.server";

describe("unconfigured computer execution", () => {
  it("never evaluates supplied code in the application process", async () => {
    const marker = "__audit_execution_marker__";
    Reflect.deleteProperty(globalThis, marker);
    const result = await runSandboxCode(`globalThis.${marker} = true; return 42`);
    expect(result.ok).toBe(false);
    expect(Reflect.has(globalThis, marker)).toBe(false);
  });
});