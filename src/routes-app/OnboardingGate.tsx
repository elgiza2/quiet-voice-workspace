import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getAuthState } from "@/lib/authStore";

const completedAccounts = new Set<string>();

/** Sends signed-in users who haven't finished first-run setup to /onboarding. */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"wait" | "ok" | "setup" | "error">(() => {
    const id = getAuthState().userId;
    return id && completedAccounts.has(id) ? "ok" : "wait";
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const user = data.session?.user;
        if (!user) { if (active) setState("ok"); return; }
        if (completedAccounts.has(user.id)) { if (active) setState("ok"); return; }
        const { data: p, error: profileError } = await supabase.from("profiles").select("onboarding_completed").eq("id", user.id).maybeSingle();
        if (profileError) throw profileError;
        if (p?.onboarding_completed) completedAccounts.add(user.id);
        if (active) setState(p?.onboarding_completed ? "ok" : "setup");
      } catch { if (active) setState("error"); }
    })();
    return () => { active = false; };
  }, [attempt]);
  if (state === "setup") return <Navigate to="/onboarding" replace />;
  if (state === "error") return <main className="grid min-h-dvh place-content-center gap-4 bg-background p-6 text-foreground"><p role="alert">Couldn't load your account. Please try again.</p><Button onClick={() => setAttempt((value) => value + 1)}>Try again</Button></main>;
  return state === "ok" ? <>{children}</> : <div aria-label="Preparing workspace" role="status" className="grid min-h-dvh place-content-center bg-background"><div className="h-8 w-8 animate-pulse rounded-full bg-muted" /></div>;
}
