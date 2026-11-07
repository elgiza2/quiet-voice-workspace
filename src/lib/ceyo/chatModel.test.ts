import { beforeEach, expect, it, vi } from "vitest";

const gateway = vi.hoisted(() => vi.fn());
vi.mock("@lovable.dev/ai-gateway", () => ({ streamChatCompletion: gateway }));
import { CHAT_MODEL, chatModelResponse } from "./chatModel.server";

beforeEach(() => {
  gateway.mockReset();
  gateway.mockResolvedValue({ toResponse: () => new Response("data: [DONE]\n\n") });
});

it("uses Terra's supported no-reasoning mode when function tools are present", async () => {
  const tools = [{ type: "function", function: { name: "calculate", parameters: { type: "object", properties: { expression: { type: "string" } }, required: ["expression"] } } }];
  await chatModelResponse([{ role: "user", content: "Calculate 7+8" }], tools, new AbortController().signal);
  expect(gateway.mock.calls[0][0]).toMatchObject({ model: CHAT_MODEL, reasoning_effort: "none", tools });
});

it("preserves the tool call and result in the next request", async () => {
  const messages = [
    { role: "user", content: "Calculate 7+8" },
    { role: "assistant", content: null, tool_calls: [{ id: "calc1", type: "function", function: { name: "calculate", arguments: '{"expression":"7+8"}' } }] },
    { role: "tool", content: '{"result":15}', tool_call_id: "calc1" },
  ];
  await chatModelResponse(messages, [{ type: "function", function: { name: "calculate" } }], new AbortController().signal);
  expect(gateway.mock.calls[0][0].messages).toEqual(messages);
  expect(gateway.mock.calls[0][0].reasoning_effort).toBe("none");
});

it("keeps medium reasoning for tool-free calls such as call follow-ups", async () => {
  await chatModelResponse([{ role: "user", content: "Summarize the call" }], [], new AbortController().signal);
  expect(gateway.mock.calls[0][0].reasoning_effort).toBe("medium");
});