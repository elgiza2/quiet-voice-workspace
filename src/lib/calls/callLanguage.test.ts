import { describe, expect, it } from "vitest";
import { scriptLanguage } from "./callLanguage.server";
import { createSpeechDetector } from "@/lib/audio/speechDetector";

describe("call language", () => {
  it("picks Arabic when the user writes Arabic, even mixed with English words", () => {
    expect(scriptLanguage("ازيك يا صاحبي عامل ايه ok")).toBe("ar");
  });
  it("picks English for English messages", () => {
    expect(scriptLanguage("hello how are you today")).toBe("en");
  });
  it("returns null when there is too little text to tell", () => {
    expect(scriptLanguage("ok")).toBeNull();
  });
});

describe("end of speech", () => {
  it("still ends the turn when background noise rises after calibration (mobile auto-gain)", () => {
    const d = createSpeechDetector({ noSpeechMs: 1e12, silenceMs: 750, minSpeechMs: 180 });
    let t = 0; let stopped = false;
    for (; t <= 300; t += 85) d.push(-90, t);           // quiet calibration
    for (; t <= 2300; t += 85) d.push(-40, t);          // user speaks
    for (; t <= 20000 && !stopped; t += 85) stopped = d.push(-70, t).stop; // noise at -70, well above the -90 floor
    expect(stopped).toBe(true);
  });
});
