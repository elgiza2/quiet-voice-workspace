import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
const Host = lazy(() => import("@/components/calls/CallHost"));
function P() {
  useEffect(() => { void import("@/lib/calls/callStore").then(({ calls }) => {
    const agent = { id: "a1", name: "Megsy", color: "violet", isDefault: true } as any;
    const m = new URLSearchParams(location.search).get("m");
    if (m === "incoming") calls.ring({ callId: "c1", kind: "voice", agent, reason: "Reminder: call the dentist" });
    else calls.start({ kind: m === "video" ? "video" : "voice", agent, agentIds: ["a1"] });
    if (new URLSearchParams(location.search).get("min")) setTimeout(() => calls.minimize(true), 300);
  }); }, []);
  return <div style={{ padding: 20 }}><h1>Chat page underneath</h1><ClientOnly><Suspense><Host /></Suspense></ClientOnly></div>;
}
export const Route = createFileRoute("/zz-call-preview")({ component: P });
