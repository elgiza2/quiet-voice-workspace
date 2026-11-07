/** Server-only: picks the language a call should listen and speak in.
 *  The user's own recent messages win over UI/browser settings, because many users
 *  keep the interface in English but talk in Arabic. */
import type { SupabaseClient } from "@supabase/supabase-js";

const ARABIC = /[\u0600-\u06FF]/g;
const LATIN = /[A-Za-z]/g;

/** "ar" when most letters in the text are Arabic, "en" when Latin, else null. */
export function scriptLanguage(text: string): "ar" | "en" | null {
  const ar = text.match(ARABIC)?.length || 0;
  const en = text.match(LATIN)?.length || 0;
  if (ar + en < 6) return null;
  return ar >= en ? "ar" : "en";
}

export async function callLanguage(db: SupabaseClient, userId: string, hint = ""): Promise<string> {
  try {
    const { data } = await db.from("messages").select("content").eq("user_id", userId).eq("role", "user").order("created_at", { ascending: false }).limit(12);
    const fromChat = scriptLanguage(((data ?? []) as Array<{ content: string | null }>).map((m) => m.content || "").join(" "));
    if (fromChat) return fromChat;
  } catch { /* fall back to settings */ }
  try {
    const { data } = await db.from("profiles").select("language").eq("id", userId).maybeSingle();
    const lang = String((data as { language?: string } | null)?.language || "").slice(0, 2).toLowerCase();
    if (/^[a-z]{2}$/.test(lang)) return lang;
  } catch { /* fall back to hint */ }
  const h = hint.slice(0, 2).toLowerCase();
  return /^[a-z]{2}$/.test(h) ? h : "en";
}
