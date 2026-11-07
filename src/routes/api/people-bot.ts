import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { mentionedBots } from "@/lib/people/peopleApi";

const input = z.object({ threadId: z.string().uuid(), messageId: z.string().uuid() });
const noStore = { "Cache-Control": "no-store" };

/** Lets bots added to a people chat answer when a member @mentions them. Replies are written by the server. */
async function handle(request: Request) {
  const { authenticate } = await import("@/lib/ceyo/auth.server");
  const auth = await authenticate(request).catch(() => null);
  if (!auth) return Response.json({ error: "Please sign in" }, { status: 401, headers: noStore });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400, headers: noStore });
  const { threadId, messageId } = parsed.data;

  // Read through the caller's own session so membership is enforced by the database.
  const { data: msg } = await auth.db.from("people_messages").select("id,thread_id,sender_id,content").eq("id", messageId).eq("thread_id", threadId).maybeSingle();
  if (!msg || msg.sender_id !== auth.userId) return Response.json({ error: "Not found" }, { status: 404, headers: noStore });
  const { data: info } = await auth.db.rpc("people_thread_info", { p_thread: threadId });
  const bots = mentionedBots(msg.content, (info?.bots || []) as { id: string; name: string }[]).slice(0, 2);
  if (!bots.length) return Response.json({ replied: 0 }, { headers: noStore });

  const { getProviderKey } = await import("@/lib/keys/providerKey");
  const key = await getProviderKey("cerebras");
  if (!key) return Response.json({ error: "The reply model is not configured" }, { status: 503, headers: noStore });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: recent } = await auth.db.from("people_messages").select("sender_id,bot_id,content,created_at").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(20);
  const members = (info?.members || []) as { id: string; username: string | null; displayName: string | null }[];
  const nameOf = (m: { sender_id: string | null; bot_id: string | null }) => m.bot_id
    ? ((info?.bots || []) as { id: string; name: string }[]).find((b) => b.id === m.bot_id)?.name || "Bot"
    : (() => { const p = members.find((x) => x.id === m.sender_id); return p?.displayName || (p?.username ? `@${p.username}` : "User"); })();
  const transcript = (recent || []).reverse().map((m) => `${nameOf(m)}: ${m.content}`).join("\n");

  let replied = 0;
  for (const bot of bots) {
    const { data: full } = await supabaseAdmin.from("bots").select("id,name,instructions").eq("id", bot.id).maybeSingle();
    if (!full) continue;
    const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST", signal: request.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-oss-120b", reasoning_effort: "low", max_completion_tokens: 1200,
        messages: [
          { role: "system", content: `You are ${full.name}, a bot taking part in a group chat between real people.\n${full.instructions || ""}\nReply only to what was asked of you, in the language of the message, briefly. Do not prefix your reply with your name.` },
          { role: "user", content: `Recent chat:\n${transcript}\n\nYou were mentioned in the last message from ${nameOf(msg as any)}. Write your reply.` },
        ],
      }),
    });
    if (!res.ok) continue;
    const text = String((await res.json())?.choices?.[0]?.message?.content || "").trim();
    if (!text) continue;
    const { error } = await supabaseAdmin.from("people_messages").insert({ thread_id: threadId, bot_id: full.id, sender_id: null, content: text.slice(0, 8000) });
    if (!error) replied++;
  }
  return Response.json({ replied }, { headers: noStore });
}

export const Route = createFileRoute("/api/people-bot")({ server: { handlers: { POST: ({ request }) => handle(request) } } });
