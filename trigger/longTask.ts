/** Background job for long work: same Cerebras + browser loop, more steps, survives the app being closed. */
import { task } from "@trigger.dev/sdk";
import { runAgentLoop } from "../src/lib/ceyo/agentLoop.server";

export const ceyoLongTask = task({
  id: "ceyo-long-task",
  machine: "micro",
  maxDuration: 900,
  retry: { maxAttempts: 2 },
  run: async (p: { system: string; goal: string }) => {
    const system = p.system + "\n\nYou are doing a longer job in the background. Work step by step with your tools until it is fully done, then send your friend the final result in your usual casual style.";
    const text = await runAgentLoop(system, [{ role: "user", content: p.goal }], () => {}, new AbortController().signal, async () => [], { maxSteps: 30 });
    return { text: text.trim() };
  },
});
