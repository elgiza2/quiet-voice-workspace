import { describe, expect, it } from "vitest";
import { buildTranscript } from "./transcript";

describe("single active agent turn", () => {
  it("retains an owner document reference from the save_file result", () => {
    const turns = buildTranscript([{ id: "result", type: "agent.tool_result", part: { type: "tool_result", call_id: "save1", tool_name: "save_file", status: "ok", result: JSON.stringify({ type: "ceyo.file", id: "doc1", name: "report.txt" }) } }], "en", false);
    expect(turns.flatMap((turn) => turn.type === "agent" ? turn.cards : [])).toContainEqual({ kind: "file", id: "doc1", name: "report.txt" });
  });
  it("closes the earlier thinking segment when a user steers the same run", () => {
    const turns = buildTranscript([
      { id: "user1", type: "user.message", content: [{ type: "text", text: "Research" }] },
      { id: "run1", type: "session.status_running" },
      { id: "thought1", type: "agent.reasoning", part: { type: "reasoning", text: "Checking", stream_id: "r" } },
      { id: "user2", type: "user.message", content: [{ type: "text", text: "Actually stop" }] },
      { id: "thought2", type: "agent.reasoning", part: { type: "reasoning", text: "Adjusting", stream_id: "r2" } },
    ], "en", true);
    expect(turns.filter((t) => t.type === "agent" && t.running)).toHaveLength(1);
    expect(turns.filter((t) => t.type === "agent").flatMap((t) => t.type === "agent" ? t.steps.filter((s) => s.status === "active") : [])).toHaveLength(1);
  });
});