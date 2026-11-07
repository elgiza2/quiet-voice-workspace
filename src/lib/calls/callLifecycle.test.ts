import { afterEach, describe, expect, it } from "vitest";
import { callRequestId, requestsCall } from "./callLifecycle";
import { calls } from "./callStore";
import type { AgentInfo } from "@/lib/agentsky/client";
const agent = { id: "bot", name: "Sam" } as AgentInfo;
afterEach(() => { calls.end(); calls.clearIncoming(); });
describe("one-off bot calls", () => {
  it("does not turn ordinary later messages into new calls", () => {
    expect(requestsCall("رن عليا مرة واحدة")).toBe(true);
    expect(requestsCall("شكرا خلاص رديت، قولي أخبارك")).toBe(false);
    expect(requestsCall("متصلش بيا تاني")).toBe(false);
  });
  it("uses one call identity per user request across retries", async () => {
    expect(await callRequestId("conversation", "request1")).toBe(await callRequestId("conversation", "request1"));
    expect(await callRequestId("conversation", "request2")).not.toBe(await callRequestId("conversation", "request1"));
  });
  it("never resurrects a settled call from a stale ringing event", () => {
    const call = { callId: "answered-test", kind: "voice" as const, agent, reason: "One call" };
    calls.ring(call); calls.settle(call.callId); calls.ring(call);
    expect(calls.get().incoming).toBeNull();
  });
  it("does not ring over an active call", () => {
    calls.start({ kind: "voice", agent, agentIds: [agent.id] });
    calls.ring({ callId: "other", kind: "voice", agent, reason: "Other" });
    expect(calls.get().incoming).toBeNull();
  });
});