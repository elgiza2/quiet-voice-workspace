import { createClient } from "@supabase/supabase-js";

export async function authenticate(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Please sign in");
  const url = process.env.SUPABASE_URL || "https://kcrssdgsefhpzoidlhhm.supabase.co";
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_qoVkpETZyG-dHOq_XYnFPw_vrxR_aJC";
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("Please sign in");
  return { db, userId: data.user.id };
}