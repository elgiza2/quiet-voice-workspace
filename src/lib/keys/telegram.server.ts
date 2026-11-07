/** Independent Telegram transport. Credential lives only in Supabase Vault. */
export async function getTelegramBotToken(): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("read_telegram_bot_token");
  if (error) throw new Error("Telegram credential storage unavailable");
  return typeof data === "string" && data ? data : null;
}

export async function telegramRequest(token: string, method: string, body: unknown) {
  // Never log the URL: Telegram's API embeds the credential in its path.
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch { throw new Error("Telegram connection failed"); }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(`Telegram request failed (${response.status})`);
  return result;
}