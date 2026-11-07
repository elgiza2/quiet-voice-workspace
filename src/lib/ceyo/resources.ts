import { supabase } from "@/integrations/supabase/client";
import { documentInput } from "./content";

export async function saveDocument(input: { name: string; mime: string; content: string }) {
  const value = documentInput.parse(input);
  if (!value.name || !value.mime || !value.content) throw new Error("Empty document");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first");
  const { data, error } = await supabase.from("agent_documents").insert({ name: value.name, mime: value.mime, content: value.content, user_id: auth.user.id }).select("id").single();
  if (error) throw error;
  return data;
}