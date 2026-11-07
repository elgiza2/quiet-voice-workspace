import { describe, it, expect } from "vitest";
import { assignAgentVoices, resolveVoice, prefersVoiceReply } from "./agentVoice";
import { buildTranscript } from "../agentsky/transcript";
const voices = [{ id: "1", name: "One", language: "en" }, { id: "2", name: "Two", language: "ar" }, { id: "3", name: "Three", language: "es" }];
const settings = { voice: "Not set", language: "Auto", speed: 1 };
describe("agent voice rules", () => {
  it("uses the user's Arabic language when unconfigured", () => {
    expect(resolveVoice(voices, "bot", ["bot"], settings, "ar-EG").language).toBe("ar");
  });
  it("respects an explicitly selected language and voice", () => {
    expect(resolveVoice(voices, "bot", ["bot"], { ...settings, voice: "2", language: "es" }, "ar")).toEqual({ language: "es", voiceId: "2" });
  });
  it("assigns distinct voices to different bots", () => {
    expect(new Set(Object.values(assignAgentVoices(voices, ["a", "b", "c"]))).size).toBe(3);
  });
  it("keeps persisted voices when a bot is added or removed", () => {
    const existing = assignAgentVoices(voices, ["b", "c"]);
    const next = assignAgentVoices(voices, ["a", "b", "c"], existing);
    expect(next.b).toBe(existing.b);
    expect(next.c).toBe(existing.c);
    expect(new Set(Object.values(next)).size).toBe(3);
  });
  it("keeps an automatic saved voice even when the catalogue grows", () => {
    expect(resolveVoice(voices, "bot", ["bot"], { ...settings, autoVoiceId: "2" }, "ar").voiceId).toBe("2");
  });
  it("keeps a bot voice fixed across language and catalogue order", () => {
    expect(resolveVoice(voices, "bot", ["other", "bot"], settings, "ar").voiceId).toBe(resolveVoice([...voices].reverse(), "bot", ["bot", "other"], settings, "en").voiceId);
  });
  it("prefers voice for ordinary replies to recordings", () => {
    expect(prefersVoiceReply("recording", "أكيد، هبدأ دلوقتي.")).toBe(true);
  });
  it("does not convert typed-message answers to speech", () => {
    expect(prefersVoiceReply(undefined, "Hello")).toBe(false);
  });
  it("retains text for code answers", () => {
    expect(prefersVoiceReply("recording", "```js\nlet x = 1\n```")).toBe(false);
  });
  it("preserves recording identity through history reconstruction", () => {
    const turns = buildTranscript([{ id: "msg", type: "user.message", voiceOrigin: "recording", recordingId: "audio-id", content: [{ type: "text", text: "Hello" }] }], "en", false);
    expect(turns[0]).toMatchObject({ type: "user", voiceOrigin: "recording", recordingId: "audio-id" });
  });
});