import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { integrationApproval, integrationApprovalStatus } from "@/lib/ceyo/integrations.functions";

export function IntegrationApprovalCard({ data, onDone }: { data: Record<string, any>; onDone: () => void }) {
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState("");
  const approve = useServerFn(integrationApproval);
  const read = useServerFn(integrationApprovalStatus);
  useEffect(() => { void read({ data: { id: String(data.id) } }).then((r) => setStatus(r.status)).catch(() => {}); }, [data.id, read]);
  const decide = async (approved: boolean) => {
    setStatus("running"); setError("");
    try { const result = await approve({ data: { id: String(data.id), approved } }); setStatus(result.status); onDone(); }
    catch (e) { setStatus("failed"); setError(e instanceof Error ? e.message : "Action failed"); }
  };
  return <div className="cx-card border border-border rounded-lg p-3">
    <div className="flex items-center gap-2"><ShieldCheck size={17} /><strong>{String(data.app || "Connected app")}</strong></div>
    <p className="text-sm mt-2 break-words">{String(data.action || "Action").replace(/_/g, " ")}</p>
    <p className="text-xs text-muted-foreground break-words">{String(data.account || "")}</p>
    <pre className="text-xs overflow-auto max-h-32 whitespace-pre-wrap break-words my-2">{JSON.stringify(data.arguments || {}, null, 2)}</pre>
    {status === "pending" ? <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => void decide(true)}><Check />Approve</Button><Button size="sm" variant="ghost" onClick={() => void decide(false)}><X />Decline</Button></div> : <p className="text-sm" role="status">{status === "running" ? "Working…" : status === "completed" ? "Completed" : status === "rejected" ? "Declined" : "Failed"}</p>}
    {error && <p className="text-destructive text-sm mt-2">{error}</p>}
  </div>;
}