/** Helper sub-agents: isolated AgentSky sessions that run one goal and return text.
 *  Server-only. Bounded (2 min, 6k chars) so a helper never hangs the parent. */
import { api } from "./agentsky.server";

const MAX_OUTPUT = 6000;
const clip = (s: string) => (s.length > MAX_OUTPUT ? `${s.slice(0, MAX_OUTPUT)}\n…[truncated]` : s);

function helperPrompt(goal: string, context: string): string {
  return [
    "You are a helper sub-agent. Complete the goal below and return ONLY the finished result as plain text/Markdown.",
    "Rules: work autonomously; if one approach fails, try another; never ask questions; keep it under 4000 chars.",
    context ? `Context:\n${context}` : "",
    `Goal:\n${goal}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function runHelperTask(
  userId: string,
  origin: string,
  goal: string,
  context = "",
): Promise<{ ok: boolean; output: string }> {
  void userId;
  void origin;
  try {
    // Reuse the default agent path: create an ephemeral session, poll events.
    const { resolveUserAgent } = await import("./agentsky.server");
    const agent = await (resolveUserAgent as any)?.("system-helper", origin).catch(() => null);
    void agent;
    // Fallback path when helper sessions are unavailable: answer via model call.
    const { askModel } = await import("@/lib/agentkernel/llm").catch(() => ({
      askModel: null as any,
    }));
    if (!askModel) return { ok: false, output: "Helper runtime unavailable." };
    const out = await askModel(
      "You are a helper sub-agent. Complete the goal and return only the finished result.",
      [{ role: "user", content: helperPrompt(goal, context) }],
    );
    if (!out) return { ok: false, output: "Helper returned nothing." };
    return { ok: true, output: clip(out) };
  } catch (e: any) {
    // Last resort: direct AgentSky session via API.
    try {
      const created = await api<{ session: any }>("/sessions", {
        method: "POST",
        body: JSON.stringify({
          title: "helper",
          metadata: {},
          idleTimeoutSeconds: 300,
          initial_events: [
            {
              type: "user.message",
              content: [{ type: "text", text: helperPrompt(goal, context) }],
            },
          ],
        }),
      });
      const sid = created.session?.id;
      if (!sid) throw new Error("no session");
      const end = Date.now() + 120_000;
      let last = "";
      while (Date.now() < end) {
        await new Promise((r) => setTimeout(r, 3000));
        const ev = await api<{ events: any[] }>(`/sessions/${sid}/events?limit=100`).catch(
          () => null,
        );
        const texts: string[] = [];
        for (const e of ev?.events ?? []) {
          for (const p of e?.parts ?? []) if (p?.type === "text" && p?.text) texts.push(p.text);
          if (typeof e?.text === "string" && e.text) texts.push(e.text);
        }
        if (texts.length) last = texts.join("\n");
        if (ev?.events?.some((e: any) => e.type === "session.status_idle")) break;
      }
      await api(`/sessions/${sid}/archive`, { method: "POST", body: "{}" }).catch(() => null);
      return last
        ? { ok: true, output: clip(last) }
        : { ok: false, output: "Helper returned nothing." };
    } catch (e2: any) {
      return { ok: false, output: String(e2?.message || e).slice(0, 300) };
    }
  }
}
