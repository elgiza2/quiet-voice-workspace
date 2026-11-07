/** @doc Browser client for person-to-person messaging: usernames, direct chats and people groups with bots. */
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export type PersonInfo = { id: string; username: string | null; displayName: string | null; avatarUrl: string | null };
export type ThreadBot = { id: string; name: string; look: Record<string, any> | null; addedBy: string };
export type ThreadSummary = {
  id: string; kind: "direct" | "group"; name: string | null; updatedAt: string; lastReadAt: string;
  members: PersonInfo[]; last: { content: string; senderId: string | null; botId: string | null; createdAt: string } | null;
};
export type PeopleMessage = { id: string; thread_id: string; sender_id: string | null; bot_id: string | null; content: string; created_at: string };

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const normalizeUsername = (v: string) => v.trim().replace(/^@/, "").toLowerCase();

function check<T>(r: { data: T; error: any }): T {
  if (r.error) throw new Error(r.error.message || "Request failed");
  return r.data;
}

export async function myUserId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Sign in required");
  return id;
}

export const peopleApi = {
  myUsername: async (): Promise<string | null> => {
    const id = await myUserId();
    const row = check(await db.from("profiles").select("username").eq("id", id).maybeSingle()) as { username: string | null } | null;
    return row?.username ?? null;
  },
  setUsername: async (value: string) => {
    const username = normalizeUsername(value);
    if (!USERNAME_RE.test(username)) throw new Error("3–20 lowercase letters, numbers or _");
    const id = await myUserId();
    const r = await db.from("profiles").update({ username }).eq("id", id);
    if (r.error) throw new Error(/duplicate|unique/i.test(r.error.message) ? "This username is taken" : r.error.message);
    return username;
  },
  search: async (q: string): Promise<PersonInfo[]> => {
    const rows = check(await db.rpc("search_people", { p_query: q })) as any[];
    return (rows || []).map((r) => ({ id: r.id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url }));
  },
  threads: async (): Promise<ThreadSummary[]> => (check(await db.rpc("my_people_threads")) as ThreadSummary[]) || [],
  openDirect: async (username: string): Promise<string> => check(await db.rpc("open_direct_thread", { p_username: normalizeUsername(username) })) as string,
  createGroup: async (name: string, usernames: string[], botIds: string[]): Promise<string> =>
    check(await db.rpc("create_people_group", { p_name: name, p_usernames: usernames.map(normalizeUsername), p_bot_ids: botIds })) as string,
  addMember: async (threadId: string, username: string) => { check(await db.rpc("add_people_member", { p_thread: threadId, p_username: normalizeUsername(username) })); },
  addBot: async (threadId: string, botId: string) => { check(await db.rpc("add_people_bot", { p_thread: threadId, p_bot: botId })); },
  leave: async (threadId: string) => { check(await db.rpc("leave_people_thread", { p_thread: threadId })); },
  info: async (threadId: string): Promise<{ members: PersonInfo[]; bots: ThreadBot[] } | null> => check(await db.rpc("people_thread_info", { p_thread: threadId })) as any,
  thread: async (threadId: string) => check(await db.from("people_threads").select("id,kind,name").eq("id", threadId).maybeSingle()) as { id: string; kind: "direct" | "group"; name: string | null } | null,
  messages: async (threadId: string): Promise<PeopleMessage[]> => {
    const rows = check(await db.from("people_messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(200)) as PeopleMessage[];
    return (rows || []).reverse();
  },
  send: async (threadId: string, content: string): Promise<PeopleMessage> => {
    const sender = await myUserId();
    const msg = check(await db.from("people_messages").insert({ thread_id: threadId, sender_id: sender, content }).select("*").single()) as PeopleMessage;
    return msg;
  },
  markRead: async (threadId: string) => {
    const id = await myUserId();
    await db.from("people_thread_members").update({ last_read_at: new Date().toISOString() }).eq("thread_id", threadId).eq("user_id", id);
  },
  /** Asks the server to let any @mentioned bot in this thread answer the message. */
  askBots: async (threadId: string, messageId: string) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    await fetch("/api/people-bot", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ threadId, messageId }) }).catch(() => {});
  },
};

export { mentionedBots } from "./mentions";

export function personLabel(p: PersonInfo | undefined | null) {
  return p?.displayName || (p?.username ? `@${p.username}` : "User");
}
