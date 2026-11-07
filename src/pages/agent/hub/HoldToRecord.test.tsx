import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mic = vi.hoisted(() => vi.fn());
vi.mock("@/lib/audio/voiceClient", () => ({ microphoneRecording: mic }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
import { HoldToRecord } from "./HoldToRecord";
beforeEach(() => { vi.stubGlobal("PointerEvent", MouseEvent); mic.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function recorder() {
  let resolve: (b: Blob) => void = () => {};
  const result = new Promise<Blob>(r => { resolve = r; });
  const stop = vi.fn(() => resolve(new Blob(["spoken audio"], { type: "audio/webm" })));
  return { stop, result, heard: () => true, detecting: false };
}
it("keeps recording after upward lock/release until the explicit send tap", async () => {
  const rec = recorder(); mic.mockResolvedValue(rec); const sent = vi.fn();
  const view = render(<HoldToRecord ar={false} onRecording={vi.fn()} onRecorded={sent} />);
  const button = view.getByRole("button", { name: "Hold to record" });
  fireEvent.pointerDown(button, { clientX: 300, clientY: 600 }); await act(async () => {});
  fireEvent.pointerMove(button, { clientX: 300, clientY: 500 });
  fireEvent.pointerUp(button, { clientX: 300, clientY: 500 });
  fireEvent.click(button, { detail: 1 }); // synthesized click from the original held gesture
  expect(rec.stop).not.toHaveBeenCalled(); expect(sent).not.toHaveBeenCalled();
  await new Promise(r => setTimeout(r, 510));
  const send = view.getByRole("button", { name: "Send" });
  fireEvent.pointerDown(send); fireEvent.pointerUp(send); fireEvent.click(send, { detail: 1 });
  await waitFor(() => expect(sent).toHaveBeenCalledTimes(1)); expect(rec.stop).toHaveBeenCalledTimes(1);
});
it("cancel during microphone permission stops the eventual recorder without sending", async () => {
  let resolve: (r: ReturnType<typeof recorder>) => void = () => {};
  mic.mockReturnValue(new Promise(r => { resolve = r; }));
  const sent = vi.fn(); const view = render(<HoldToRecord ar={false} onRecording={vi.fn()} onRecorded={sent} />);
  const button = view.getByRole("button", { name: "Hold to record" });
  fireEvent.pointerDown(button, { clientX: 300, clientY: 600 });
  fireEvent.pointerMove(button, { clientX: 100, clientY: 600 });
  const rec = recorder(); await act(async () => resolve(rec));
  await waitFor(() => expect(rec.stop).toHaveBeenCalledTimes(1)); expect(sent).not.toHaveBeenCalled();
});
it("does not count permission latency as captured speech duration", async () => {
  let resolve: (r: ReturnType<typeof recorder>) => void = () => {};
  mic.mockReturnValue(new Promise(r => { resolve = r; }));
  const sent = vi.fn(); const view = render(<HoldToRecord ar={false} onRecording={vi.fn()} onRecorded={sent} />);
  const button = view.getByRole("button", { name: "Hold to record" });
  fireEvent.pointerDown(button, { clientX: 300, clientY: 600 }); fireEvent.pointerUp(button, { clientX: 300, clientY: 600 });
  const rec = recorder(); await act(async () => resolve(rec));
  await waitFor(() => expect(rec.stop).toHaveBeenCalledTimes(1)); expect(sent).not.toHaveBeenCalled();
});