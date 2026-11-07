import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ speech: vi.fn(), record: vi.fn(), transcribe: vi.fn() }));
vi.mock("./VoiceControls", () => ({ useVoiceChoice: () => ({ voiceId: "voice", language: "ar", reload: vi.fn() }) }));
vi.mock("./HubParts", () => ({ BotAvatar: () => <span /> }));
vi.mock("@/lib/audio/voiceClient", () => ({ getSpeech: mocks.speech, microphoneRecording: mocks.record, transcribeRecording: mocks.transcribe }));
import { VoiceCallBar } from "./VoiceCall";
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  mocks.record.mockResolvedValue({ stop: vi.fn(), result: new Promise(() => {}) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("voice turn identity", () => {
  it("speaks a new turn even when the text is identical to the previous answer", async () => {
    mocks.speech.mockResolvedValue(new Blob(["audio"]));
    URL.createObjectURL = vi.fn(() => "blob:voice"); URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const props = { agent: { id: "agent", name: "Agent", description: "", prompt: "", color: "mono" as const, isDefault: false, createdAt: "" }, lang: "ar" as const, settings: { voice: "Auto", language: "ar", speed: 1 }, agentIds: ["agent"], onSay: vi.fn(), onEnd: vi.fn(), lastReply: "15" };
    const view = render(<VoiceCallBar {...props} busy={true} replyId="old" />);
    view.rerender(<VoiceCallBar {...props} busy={false} replyId="new" />);
    await waitFor(() => expect(mocks.speech).toHaveBeenCalledWith("15", "voice", "ar", expect.any(AbortSignal)));
  });
  it("starts listening automatically and sends the completed recording without a stop click", async () => {
    mocks.record.mockResolvedValue({ stop: vi.fn(), result: Promise.resolve(new Blob(["spoken"])) });
    mocks.transcribe.mockResolvedValue("كم حاصل سبعة زائد ثمانية؟");
    const onSay = vi.fn();
    render(<VoiceCallBar agent={{ id: "agent", name: "Agent" } as any} lang="ar" settings={{ voice: "Auto", language: "ar", speed: 1 }} agentIds={["agent"]} busy={false} lastReply="" onSay={onSay} onEnd={vi.fn()} />);
    await waitFor(() => expect(onSay).toHaveBeenCalledWith("كم حاصل سبعة زائد ثمانية؟"));
    expect(mocks.record).toHaveBeenCalledWith({ autoStop: true });
  });
  it("does not let a previous turn error suppress a successful new voice response", async () => {
    mocks.speech.mockResolvedValue(new Blob(["audio"]));
    URL.createObjectURL = vi.fn(() => "blob:voice"); URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const props = { agent: { id: "agent", name: "Agent" } as any, lang: "ar" as const, settings: { voice: "Auto", language: "ar", speed: 1 }, agentIds: ["agent"], onSay: vi.fn(), onEnd: vi.fn(), replyError: "previous error" };
    const view = render(<VoiceCallBar {...props} busy={true} replyId="old" lastReply="" />);
    view.rerender(<VoiceCallBar {...props} busy={false} replyId="new" lastReply="15" />);
    await waitFor(() => expect(mocks.speech).toHaveBeenCalledWith("15", "voice", "ar", expect.any(AbortSignal)));
  });
});