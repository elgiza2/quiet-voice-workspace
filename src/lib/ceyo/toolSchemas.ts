import { z } from "zod";

/** Bot names describe the job (Researcher, Writer…) and never use the word "bot". */
export const roleName = z.string().trim().min(2).max(30).refine((n) => !/bot/i.test(n) && !/روبوت|بوت/.test(n), "Name it after its job (e.g. Researcher, Writer), without the word bot");
const colors = z.enum(["aurora", "ocean", "ember", "mint", "sun", "rose", "mono"]);
export const teamInput = z.object({
  name: z.string().trim().min(2).max(60).refine((n) => !/bot/i.test(n), "Name the group after its purpose, without the word bot"),
  category: z.string().max(60).default("Unassigned"),
  members: z.array(z.object({ name: roleName, description: z.string().max(500).default(""), instructions: z.string().min(1).max(6000), color: colors.optional() })).min(2).max(8)
    .refine((m) => new Set(m.map((x) => x.name.toLowerCase())).size === m.length, "Every member needs a different name"),
});
export const botInput = z.object({ name: roleName, description: z.string().max(500).default(""), instructions: z.string().min(1).max(6000), color: z.enum(["aurora", "ocean", "ember", "mint", "sun", "rose", "mono"]).default("mint") });
export const groupInput = z.object({ name: z.string().trim().min(2).max(60), member_ids: z.array(z.string().uuid()).min(2).max(8).refine((ids) => new Set(ids).size === ids.length), category: z.string().max(60).default("Unassigned") });
export const delegationInput = z.object({ bot_id: z.string().uuid(), task: z.string().min(1).max(6000), group_id: z.string().uuid().optional() });
export const actionInput = z.object({ account_id: z.string().min(1).max(200), tool_slug: z.string().regex(/^[A-Z0-9_]+$/).max(200), arguments: z.record(z.unknown()).refine((v) => JSON.stringify(v).length <= 24000) });
export type AgentTool = { name: string; def: object; run: (args: unknown) => Promise<string> };
export function tool(name: string, description: string, properties: object = {}, required: string[] = []): object {
  return { type: "function", function: { name, description, parameters: { type: "object", properties, required } } };
}