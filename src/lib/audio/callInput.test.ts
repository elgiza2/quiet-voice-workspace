import { describe, expect, it } from "vitest";
import { createPcmResampler, transcriptText } from "./callInput";

describe("call microphone input", () => {
  it("preserves Arabic words split across final deltas", () => {
    expect(transcriptText(["عا", "مل", " ", "إيه يا صاحبي؟"])).toBe("عامل إيه يا صاحبي؟");
  });
  it.each([44100, 48000])("preserves the sample count at %i Hz across callbacks", (rate) => {
    const converter = createPcmResampler(rate);
    let count = 0;
    for (let offset = 0; offset < rate; offset += 4096) count += converter.push(new Float32Array(Math.min(4096, rate - offset))).length;
    expect(count).toBe(16000);
  });
  it("produces identical audio regardless of callback boundaries", () => {
    const input = Float32Array.from({ length: 10000 }, (_, i) => Math.sin(i / 7) * 0.5);
    const whole = createPcmResampler(44100).push(input);
    const converter = createPcmResampler(44100);
    const split = [...converter.push(input.slice(0, 4096)), ...converter.push(input.slice(4096))];
    expect(split).toEqual([...whole]);
  });
});