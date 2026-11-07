import { expect, it } from "vitest";
import { chatFailure } from "./chatFailure";
import { readEventStream } from "../agentsky/readEventStream";
it("reports missing configuration as a failed terminal chat, not a page crash or answer", async () => {
  const response = chatFailure("Agent unavailable", "provider_not_configured");
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/event-stream");
  const events: { type: string; code?: string }[] = [];
  if (!response.body) throw new Error("Missing body");
  await readEventStream(response.body, (event) => { events.push(event); });
  expect(events.map((e) => e.type)).toEqual(["session.error", "session.status_idle"]);
  expect(events[0].code).toBe("provider_not_configured");
  expect(events.some((e) => e.type === "agent.message")).toBe(false);
});