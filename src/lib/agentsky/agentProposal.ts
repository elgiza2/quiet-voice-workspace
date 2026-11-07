import { z } from "zod";

export const agentProposalSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().min(10).max(500),
  prompt: z.string().trim().min(20).max(6000),
  color: z.enum(["aurora", "ocean", "ember", "mint", "sun", "rose", "mono"]).default("ocean"),
});
export type AgentProposal = { name: string; description: string; prompt: string; color: "aurora" | "ocean" | "ember" | "mint" | "sun" | "rose" | "mono" };

export const AGENT_CREATION_REQUEST = "Help me create a personal AI agent. Speak English for this setup. First ask me what I want the agent to do, who it is for, and what a successful result looks like. Ask follow-up questions when details are missing; do not assume my requirements. Once you understand, explain its name, role, instructions, boundaries and capabilities. Then use propose_agent to show a proposal with a Create agent button and wait for my explicit approval. Do not create the agent yourself. If I ask for changes, revise the proposal.";