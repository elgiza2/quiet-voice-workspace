/** @doc Single, reliable sign-out path used by every logout affordance. */
import { supabase } from "@/integrations/supabase/client";

/**
 * Signing out has to work even when the stored session is already stale (the
 * usual cause of "the logout button does nothing"): `signOut()` rejects with
 * "Auth session missing" and the caller's navigation never runs.
 *
 * So: always clear local auth state, never let a provider error bubble, and
 * leave the app on the sign-in screen with a hard navigation so no cached
 * protected view survives.
 */
export async function signOutEverywhere(redirectTo = "/auth"): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* session already gone — keep going */
  }
  try {
    await supabase.auth.signOut();
  } catch {
    /* global revoke is best-effort */
  }
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (/^sb-.*-auth-token/.test(key) || key.startsWith("supabase.auth."))) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* private mode / storage disabled */
  }
  if (typeof window !== "undefined") {
    window.location.replace(redirectTo);
  }
}
