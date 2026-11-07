import { getProviderKey } from "@/lib/keys/providerKey";
import { z } from "zod";
import { actionInput } from "./toolSchemas";
const BASE = "https://backend.composio.dev/api/v3.1";
const aliases: Record<string, string> = { google_sheets: "googlesheets", google_docs: "googledocs", google_calendar: "googlecalendar", google_drive: "googledrive", outlook: "outlook" };
export const toolkitSlug = (app: string) => aliases[app] || app.replace(/[^a-z0-9]/gi, "").toLowerCase();

export async function composio(path: string, method = "GET", body?: unknown) {
  const key = await getProviderKey("composio");
  if (!key) throw new Error("Composio is not configured");
  const response = await fetch(`${BASE}${path}`, { method, headers: { "x-api-key": key, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) {
    await response.text();
    console.error(`Composio request failed [${response.status}]`);
    throw new Error(response.status === 401 ? "Composio needs a valid project API key" : `Composio request failed (${response.status})`);
  }
  return response.status === 204 ? {} : response.json();
}
export type ConnectedAccount = { id: string; app: string; label: string; status: string };
export async function accounts(userId: string): Promise<ConnectedAccount[]> {
  const result = await composio(`/connected_accounts?user_ids=${encodeURIComponent(userId)}&limit=100`);
  return (result.items || []).filter((a: any) => (a.user_id || a.entity_id) === userId).map((a: any) => ({ id: String(a.id), app: String(a.toolkit?.slug || a.appName || ""), label: String(a.alias || a.name || a.id), status: String(a.status) }));
}
export async function ownedAccount(userId: string, accountId: string) {
  const account = (await accounts(userId)).find((a) => a.id === accountId);
  if (!account) throw new Error("Account not found");
  return account;
}
export async function connectAccount(userId: string, app: string, callback: string) {
  const slug = toolkitSlug(z.string().min(1).max(100).parse(app));
  const configs = await composio(`/auth_configs?toolkit_slug=${encodeURIComponent(slug)}`);
  let config = configs.items?.find((c: any) => c.toolkit?.slug === slug && c.status !== "DISABLED");
  if (!config) {
    const created = await composio("/auth_configs", "POST", { toolkit: { slug }, auth_config: { type: "use_composio_managed_auth", credentials: {}, restrict_to_following_tools: [] } });
    config = created.auth_config;
  }
  if (!config?.id) throw new Error("This app has no available authorization setup");
  const result = await composio("/connected_accounts/link", "POST", { auth_config_id: config.id, user_id: userId, alias: `${slug}-${crypto.randomUUID().slice(0, 8)}`, callback_url: callback });
  const url = result.link || result.redirect_url;
  if (typeof url !== "string" || !url.startsWith("https://")) throw new Error("Authorization link unavailable");
  return url;
}
export async function findTools(app: string, search = "") {
  const result = await composio(`/tools?toolkit_slug=${toolkitSlug(app)}&search=${encodeURIComponent(search)}&limit=20`);
  return (result.items || []).map((t: any) => ({ slug: t.slug, name: t.name, description: t.description, input_parameters: t.input_parameters }));
}
export async function executeAction(userId: string, input: unknown) {
  const data = actionInput.parse(input);
  const account = await ownedAccount(userId, data.account_id);
  if (account.status !== "ACTIVE") throw new Error("Account is not active");
  const metadata = await composio(`/tools/${encodeURIComponent(data.tool_slug)}`);
  if (toolkitSlug(metadata.toolkit?.slug || "") !== account.app) throw new Error("Tool does not belong to this account's app");
  const result = await composio(`/tools/execute/${encodeURIComponent(data.tool_slug)}`, "POST", { connected_account_id: account.id, user_id: userId, arguments: data.arguments });
  if (result.successful === false) throw new Error(String(result.error || "Action failed"));
  return result;
}