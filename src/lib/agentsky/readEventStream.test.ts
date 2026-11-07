import { describe, expect, it, vi } from "vitest";
import { readEventStream } from "./readEventStream";

const encoder = new TextEncoder();
describe("AgentSky standing event stream", () => {
  it("ends on a terminal event even when the provider keeps the socket open", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"id":"1","type":"agent.message"}\n\ndata: {"id":"2","type":"session.status_idle"}\n\n'));
      }, cancel() { cancelled = true; },
    });
    const ids: string[] = [];
    await readEventStream(body, (event) => { ids.push(event.id); return event.type === "session.status_idle"; });
    expect(ids).toEqual(["1", "2"]);
    expect(cancelled).toBe(true);
  });
  it("handles CRLF, fragmented frames, malformed JSON and the last unterminated frame", async () => {
    const parts = ['data: not-json\r\n\r\ndata: {"id":"a",', '"type":"agent.message"}\r\n\r\ndata: {"id":"b","type":"session.error"}'];
    const body = new ReadableStream<Uint8Array>({ start(controller) { parts.forEach((part) => controller.enqueue(encoder.encode(part))); controller.close(); } });
    const ids: string[] = [];
    await readEventStream(body, (event) => { ids.push(event.id); });
    expect(ids).toEqual(["a", "b"]);
  });
  it("propagates callback errors rather than silently swallowing them", async () => {
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoder.encode('data: {"id":"1","type":"agent.message"}\n\n')); controller.close(); } });
    await expect(readEventStream(body, () => { throw new Error("render failed"); })).rejects.toThrow("render failed");
  });
  it("ignores JSON heartbeats and null payloads without event identities", async () => {
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(encoder.encode('data: null\n\ndata: {"heartbeat":true}\n\ndata: {"id":"end","type":"session.status_idle"}\n\n'));
      controller.close();
    } });
    const callback = vi.fn(() => true);
    await readEventStream(body, callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});