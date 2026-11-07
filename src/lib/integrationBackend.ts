import { supabase } from "@/integrations/supabase/client";
import type { Integration } from "./integrationsData";
import { integrationAccounts, integrationConnect, integrationDisconnect } from "./ceyo/integrations.functions";

export type IntegrationMeta = Record<string, any>;
export type IntegrationAccount = { id: string; app: string; label: string; status: string };
export interface IntegrationConnectionSnapshot {
  connectedApps: Record<string, boolean>;
  appMeta: Record<string, IntegrationMeta>;
  accounts: IntegrationAccount[];
  providerWarning?: string | null;
}
const aliases: Record<string, string> = { google_sheets: "googlesheets", google_docs: "googledocs", google_calendar: "googlecalendar", google_drive: "googledrive" };
export const integrationSlug = (app: string) => aliases[app] || app.replace(/[^a-z0-9]/gi, "").toLowerCase();
export async function requireSignedInUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in first");
  return data.user;
}
export async function loadIntegrationConnections(catalog: Integration[]): Promise<IntegrationConnectionSnapshot> {
  const { accounts } = await integrationAccounts();
  const connectedApps: Record<string, boolean> = {};
  const appMeta: Record<string, IntegrationMeta> = {};
  for (const integration of catalog) {
    const matches = accounts.filter((a) => a.app === integrationSlug(integration.app) && a.status === "ACTIVE");
    connectedApps[integration.app] = matches.length > 0;
    appMeta[integration.app] = { accounts: matches, account_name: matches.map((a) => a.label).join(", ") };
  }
  return { connectedApps, appMeta, accounts };
}
export async function startIntegrationConnection(integration: Integration) {
  const popup = window.open("about:blank", "ceyo-connect", "popup,width=720,height=820");
  if (!popup) throw new Error("Allow popups to authorize this account");
  try {
    const result = await integrationConnect({ data: { app: integration.app } });
    popup.location.href = result.url;
    return { mode: "oauth" as const, popup };
  } catch (error) { popup.close(); throw error; }
}
export async function disconnectIntegration(integration: Integration, accountId?: string) {
  if (!accountId) throw new Error(`Choose the ${integration.name} account to disconnect`);
  await integrationDisconnect({ data: { accountId } });
}
export async function waitForConnectionRefresh(refresh: () => Promise<boolean>, popup?: Window | null) {
  for (let attempt = 0; attempt < 72; attempt++) {
    await new Promise((resolve) => window.setTimeout(resolve, 2500));
    if (await refresh()) return;
    if (popup?.closed && attempt > 4) throw new Error("Authorization was not completed");
  }
  throw new Error("Authorization is still pending. Try refreshing your accounts.");
}