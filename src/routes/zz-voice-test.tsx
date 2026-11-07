import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
function P() {
  const [log, setLog] = useState<string[]>([]);
  useEffect(() => { void (async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.auth as any).getSession = async () => ({ data: { session: { access_token: "test" } } });
    const { startRealtimeCall } = await import("@/lib/audio/realtimeCall");
    const voiceId = new URLSearchParams(location.search).get("v") || "";
    await startRealtimeCall({ voiceId, language: "Auto", agentName: "T", agentPrompt: "", onPhase: (p) => setLog((l) => [...l, "phase:" + p]), onError: (m) => setLog((l) => [...l, "error:" + m]) });
  })(); }, []);
  return <pre id="log">{log.join("\n")}</pre>;
}
export const Route = createFileRoute("/zz-voice-test")({ component: P });
