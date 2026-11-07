import { afterEach, expect, it, vi } from "vitest";
const session = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: session } } }));
import { sendCallFollowup } from "./callFollowup";
import type { ActiveCall } from "./callStore";
const call: ActiveCall = { key: "call-id", kind: "voice", conversationId: "conversation-id", agentIds: ["bot"], agent: { id: "bot", name: "Sam" } as ActiveCall["agent"] };
afterEach(() => vi.unstubAllGlobals());
it("sends one completed-call payload to the original conversation and refreshes saved messages", async () => {
  session.mockResolvedValue({ data: { session: { access_token: "test" } } });
  const fetcher = vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch", fetcher);
  const refresh = vi.fn(); window.addEventListener("ceyo-action-completed", refresh);
  await sendCallFollowup(call, [{ role: "user", text: "نكمل التقرير" }, { role: "assistant", text: "نتفق على الخطوات" }], "ar");
  expect(fetcher).toHaveBeenCalledTimes(1);
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.conversationId).toBe("conversation-id"); expect(body.callId).toBe("call-id"); expect(body.turns).toHaveLength(2);
  expect(refresh).toHaveBeenCalledTimes(1); window.removeEventListener("ceyo-action-completed", refresh);
});
it("does not submit a failed or unanswered call", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await sendCallFollowup(call, [], "ar"); expect(fetcher).not.toHaveBeenCalled();
});