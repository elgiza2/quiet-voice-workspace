import { afterEach, expect, it, vi } from "vitest";
import { transcribeOriginalRecording } from "./recordingTranscription.server";
afterEach(() => vi.unstubAllGlobals());
it("detects original Arabic speech instead of imposing English from the app locale", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ results: { channels: [{ alternatives: [{ transcript: "ازيك يا صاحبي عامل ايه" }] }] } }));
  vi.stubGlobal("fetch", fetcher);
  const audio = new Blob(["recording"], { type: "audio/webm" });
  const response = await transcribeOriginalRecording(audio, "test-only");
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.searchParams.get("language")).toBe("multi");
  expect(fetcher.mock.calls[0][1].body).toBe(audio);
  expect(await response.json()).toEqual({ text: "ازيك يا صاحبي عامل ايه" });
});
it("preserves English speech without translating it to Arabic", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ results: { channels: [{ alternatives: [{ transcript: "Hello my friend" }] }] } })));
  const response = await transcribeOriginalRecording(new Blob(["voice"]), "test-only");
  expect(await response.json()).toEqual({ text: "Hello my friend" });
});
it("does not retry a provider access denial", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("Denied", { status: 403 }));
  vi.stubGlobal("fetch", fetcher);
  expect((await transcribeOriginalRecording(new Blob(["voice"]), "test-only")).status).toBe(403);
  expect(fetcher).toHaveBeenCalledTimes(1);
});