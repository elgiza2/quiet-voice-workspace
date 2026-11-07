import { afterEach, describe, expect, it, vi } from "vitest";
import { cerebrasRequest } from "./agentLoop.server";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("cerebrasRequest", () => {
  it("waits out a per-minute limit and continues instead of failing", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("limit", { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const pending = cerebrasRequest(["k1"], "{}", new AbortController().signal);
    await vi.advanceTimersByTimeAsync(2500);
    const res = await pending;
    expect(res.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("switches to the next key immediately when one key is limited", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("limit", { status: 429 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const res = await cerebrasRequest(["a", "b"], "{}", new AbortController().signal);
    expect(res.status).toBe(200);
    const used = fetcher.mock.calls.map((c) => c[1].headers.Authorization);
    expect(new Set(used).size).toBe(2);
  });
});
