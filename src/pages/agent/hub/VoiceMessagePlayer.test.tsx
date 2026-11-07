import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const cache = vi.hoisted(() => vi.fn());
vi.mock("@/lib/audio/recordingCache", () => ({ cachedRecording: cache, cacheRecording: vi.fn() }));
vi.mock("@/lib/audio/voiceClient", () => ({ getSpeech: vi.fn() }));
import { VoiceMessagePlayer } from "./VoiceMessagePlayer";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("plays the saved recording and pauses with a direct control", async () => {
  cache.mockResolvedValue(new Blob(["voice"], { type: "audio/webm" }));
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:recording"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function() { fireEvent.play(this); return Promise.resolve(); });
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const v = render(<VoiceMessagePlayer text="Hello" recordingId="saved" agentId="bot" own ar={false} />);
  await waitFor(() => expect(v.getByRole("button", { name: "Play recording" }).hasAttribute("disabled")).toBe(false));
  fireEvent.click(v.getByRole("button", { name: "Play recording" }));
  await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
  const el = v.container.querySelector("audio"); if (!el) throw new Error("Missing audio");
  Object.defineProperty(el, "paused", { value: false });
  fireEvent.click(v.getByRole("button", { name: "Pause recording" })); expect(pause).toHaveBeenCalledTimes(1);
});
it("ignores audio from a previous message when cache reads finish late", async () => {
  let resolve: (b: Blob) => void = () => {};
  cache.mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue(new Blob(["new"]));
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:new");vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const v = render(<VoiceMessagePlayer text="Old" recordingId="old" agentId="bot" own ar={false} />);
  v.rerender(<VoiceMessagePlayer text="New" recordingId="new" agentId="bot" own ar={false} />);
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  await act(async () => resolve(new Blob(["old"]))); expect(create).toHaveBeenCalledTimes(1);
});