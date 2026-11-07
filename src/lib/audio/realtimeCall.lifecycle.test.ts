import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), ctx: { resume: vi.fn().mockResolvedValue(undefined), state: "running", sampleRate: 48000, createMediaStreamSource: vi.fn(), createScriptProcessor: vi.fn(), createGain: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: mocks.session } } }));
vi.mock("./voiceClient", () => ({ sharedAudioContext: () => mocks.ctx }));
import { startRealtimeCall } from "./realtimeCall";

class Socket {
  static OPEN = 1; static CONNECTING = 0;
  static instances: Socket[] = [];
  readyState = 1; binaryType = "";
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: unknown[] = [];
  constructor(public url: string) { Socket.instances.push(this); }
  send(value: unknown) { this.sent.push(value); }
  close() { this.readyState = 3; this.onclose?.(); }
  emit(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); Socket.instances = []; });

describe("realtime recognition boundaries", () => {
  it("drains trailing Arabic deltas before submitting exactly one reply", async () => {
    vi.useFakeTimers();
    mocks.session.mockResolvedValue({ data: { session: { access_token: "test-session" } } });
    const node = { connect: vi.fn(), disconnect: vi.fn() };
    mocks.ctx.createMediaStreamSource.mockReturnValue(node);
    mocks.ctx.createScriptProcessor.mockReturnValue({ ...node, onaudioprocess: null });
    mocks.ctx.createGain.mockReturnValue({ ...node, gain: { value: 1 } });
    vi.stubGlobal("WebSocket", Socket);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) } });
    const requests: { action: string; history?: { text: string }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body); requests.push(body);
      return body.action === "token" ? new Response(JSON.stringify({ token: "test-token", language: "ar" })) : new Response("");
    }));
    const call = await startRealtimeCall({ voiceId: "test-voice", language: "ar", agentName: "Bot", agentPrompt: "", onPhase: vi.fn(), onError: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);
    const stt = Socket.instances[0];
    expect(stt).toBeDefined();
    stt.emit({ type: "transcript", is_final: true, text: "عا" });
    await vi.advanceTimersByTimeAsync(1300);
    expect(stt.sent).toContain("finalize");
    expect(requests.filter((r) => r.action === "reply")).toHaveLength(0);
    stt.emit({ type: "transcript", is_final: true, text: "مل إيه يا صاحبي؟" });
    stt.emit({ type: "flush_done" });
    await vi.advanceTimersByTimeAsync(0);
    const replies = requests.filter((r) => r.action === "reply");
    expect(replies).toHaveLength(1);
    expect(replies[0].history?.[0].text).toBe("عامل إيه يا صاحبي؟");
    // Discard undrained data rather than leaking it into the next utterance.
    stt.emit({ type: "transcript", is_final: true, text: "old" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(stt.readyState).toBe(3);
    const next = Socket.instances.at(-1);
    expect(next).not.toBe(stt);
    stt.emit({ type: "transcript", is_final: true, text: "stale" });
    expect(requests.filter((r) => r.action === "reply")).toHaveLength(1);
    call.end();
  });
});