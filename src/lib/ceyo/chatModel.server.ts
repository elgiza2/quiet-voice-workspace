import { streamChatCompletion } from "@lovable.dev/ai-gateway";
import { z } from "zod";

export const CHAT_MODEL = "openai/gpt-6.1-terra";
const functionCall = z.object({ id: z.string(), type: z.literal("function"), function: z.object({ name: z.string(), arguments: z.string() }) });
const message = z.discriminatedUnion("role", [
  z.object({ role: z.literal("system"), content: z.string() }),
  z.object({ role: z.literal("user"), content: z.string() }),
  z.object({ role: z.literal("assistant"), content: z.string().nullable().optional(), tool_calls: z.array(functionCall).optional() }),
  z.object({ role: z.literal("tool"), content: z.string(), tool_call_id: z.string() }),
]);
const tool = z.object({ type: z.literal("function"), function: z.object({ name: z.string(), description: z.string().optional(), parameters: z.record(z.unknown()).optional() }) });

/** Adapt typed native SSE to the existing agent-loop transcript, without changing tools or UI events. */
export async function chatModelResponse(messages: unknown[], tools: unknown[], signal: AbortSignal): Promise<Response> {
  const stream = await streamChatCompletion({
    model: CHAT_MODEL,
    messages: z.array(message).parse(messages),
    tools: z.array(tool).parse(tools),
    reasoning_effort: "medium",
  }, { signal });
  return stream.toResponse();
}