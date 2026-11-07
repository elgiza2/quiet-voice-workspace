import { describe, expect, it } from "vitest";
import { takeSpeakable } from "@/lib/audio/realtimeCall";

describe("realtime call speech chunking", () => {
  it("emits complete sentences immediately and keeps the unfinished remainder", () => {
    expect(takeSpeakable("أهلاً بيك. إزاي أقدر")).toEqual({ pieces: ["أهلاً بيك. "], rest: "إزاي أقدر" });
  });
  it("treats the Arabic question mark as a sentence end", () => {
    expect(takeSpeakable("عامل إيه؟ تمام").pieces).toEqual(["عامل إيه؟ "]);
  });
  it("flushes the remainder when the reply ends", () => {
    expect(takeSpeakable("آخر جملة", true)).toEqual({ pieces: ["آخر جملة"], rest: "" });
  });
});
