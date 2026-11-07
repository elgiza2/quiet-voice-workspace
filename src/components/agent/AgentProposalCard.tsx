import { useState } from "react";
import { Check, Loader2, Plus, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AgentOrb } from "./AgentOrb";
import { agentApi } from "@/lib/agentsky/client";
import { workspace } from "@/lib/agentsky/store";
import { agentProposalSchema, type AgentProposal } from "@/lib/agentsky/agentProposal";

export function AgentProposalCard({ proposal }: { proposal: AgentProposal }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function create() {
    if (busy || createdId) return;
    setBusy(true); setError("");
    try {
      agentProposalSchema.parse(proposal);
      const agent = await agentApi.createAgent(proposal);
      workspace.addAgent(agent.agent);
      setCreatedId(agent.agent.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create your agent. Please try again."); }
    finally { setBusy(false); }
  }
  return <section className="max-w-xl rounded-lg border border-border bg-card p-5" dir="ltr" data-no-translate>
    <div className="flex items-center gap-3"><AgentOrb color={proposal.color} size={42} state={createdId ? "done" : "idle"} /><div><p className="text-xs text-muted-foreground">{createdId ? "Your agent is ready" : "Agent proposal · awaiting your approval"}</p><h3 className="mt-1 text-lg font-semibold">{proposal.name}</h3></div></div>
    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{proposal.description}</p>
    <details className="mt-4 border-t border-border pt-3 text-sm"><summary className="cursor-pointer font-medium">Instructions</summary><p className="mt-3 whitespace-pre-wrap leading-relaxed text-muted-foreground">{proposal.prompt}</p></details>
    {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
    <div className="mt-5 flex flex-wrap items-center gap-3">{createdId ? <><span className="flex items-center gap-2 text-sm"><Check size={16} />Created</span><Button variant="neutral" onClick={() => navigate(`/chat?agent=${encodeURIComponent(createdId)}`)}>Open chat<ArrowUpRight size={16} /></Button></> : <Button variant="neutral" disabled={busy} onClick={create}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}{busy ? "Creating agent…" : "Create agent"}</Button>}</div>
  </section>;
}