import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { botInput, groupInput, teamInput, delegationInput, actionInput, tool, type AgentTool } from "./toolSchemas";
import { accounts, findTools, ownedAccount } from "./composio.server";
import { runAgentLoop, type LoopEvent } from "./agentLoop.server";
import { agentPrompt } from "./prompt";
import { routineInput, nextRoutineRun, documentInput } from "./content";
import { evaluate } from "mathjs";

type Context = { db: SupabaseClient; userId: string; botId: string | null; conversationId: string; primary: boolean; emit: (e: LoopEvent) => void; signal: AbortSignal; poll: () => Promise<string[]>; delegation?: boolean };
const str = { type: "string" };
const checked = (r: any) => { if (r.error) throw new Error(r.error.message); return r.data; };

export function workspaceTools(ctx: Context): AgentTool[] {
  const { db, userId } = ctx;
  const list: AgentTool[] = [];
  const add = (name: string, description: string, props: object, required: string[], run: AgentTool["run"]) => list.push({ name, def: tool(name, description, props, required), run });
  add("calculate", "Evaluate a bounded arithmetic expression accurately. This is a calculator, not Python or shell execution.", { expression: str }, ["expression"], async (args) => {
    const { expression } = z.object({ expression: z.string().min(1).max(500).regex(/^[0-9\s.+\-*/()%]+$/) }).parse(args);
    const result = evaluate(expression);
    if (typeof result !== "number" || !Number.isFinite(result)) throw new Error("Invalid arithmetic result");
    return JSON.stringify({ expression, result, engine: "calculator" });
  });
  add("list_memories", "Read the user's saved facts and preferences.", {}, [], async () => JSON.stringify(checked(await db.from("agent_memories").select("id,content").eq("user_id", userId).order("created_at").limit(100))));
  add("remember", "Persist a fact only when the user explicitly asks you to remember it.", { content: str }, ["content"], async (args) => {
    const { content } = z.object({ content: z.string().trim().min(1).max(5000) }).parse(args);
    return JSON.stringify(checked(await db.from("agent_memories").insert({ user_id: userId, content }).select("id,content").single()));
  });
  add("forget", "Delete one saved memory by its ID at the user's request.", { id: str }, ["id"], async (args) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(args);
    return JSON.stringify(checked(await db.from("agent_memories").delete().eq("id", id).eq("user_id", userId).select("id")));
  });
  add("save_file", "Save a real text, code, CSV or JSON deliverable in the user's library.", { name: str, mime: str, content: str }, ["name", "mime", "content"], async (args) => {
    const file = checked(await db.from("agent_documents").insert({ ...documentInput.parse(args), user_id: userId }).select("id,name").single());
    return JSON.stringify({ type: "ceyo.file", ...file });
  });
  add("read_file", "Read actual contents of a user-owned document reference supplied in chat.", { id: str }, ["id"], async (args) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(args);
    return JSON.stringify(checked(await db.from("agent_documents").select("name,mime,content").eq("id", id).eq("user_id", userId).single()));
  });
  add("list_routines", "List the user's saved daily/weekly routines and execution errors.", {}, [], async () => JSON.stringify(checked(await db.from("agent_routines").select("id,title,goal,active,next_run_at,last_error").eq("user_id", userId))));
  add("create_routine", "Save a daily (24h) or weekly (168h) research/writing routine. Execution requires synchronized scheduler; no external actions.", { title: str, goal: str, interval_hours: { type: "integer", enum: [24, 168] } }, ["title", "goal", "interval_hours"], async (args) => {
    const input = routineInput.parse(args);
    return JSON.stringify(checked(await db.from("agent_routines").insert({ ...input, user_id: userId, conversation_id: ctx.conversationId, next_run_at: nextRoutineRun(input.interval_hours) }).select("id,title,next_run_at").single()));
  });
  add("set_routine_active", "Pause or resume one user-owned routine.", { id: str, active: { type: "boolean" } }, ["id", "active"], async (args) => {
    const input = z.object({ id: z.string().uuid(), active: z.boolean() }).parse(args);
    return JSON.stringify(checked(await db.from("agent_routines").update({ active: input.active }).eq("id", input.id).eq("user_id", userId).select("id,active").single()));
  });
  add("list_my_bots", "List your user's real bots, specializations and groups.", {}, [], async () => JSON.stringify({ bots: checked(await db.from("bots").select("id,name,description,instructions").eq("owner_id", userId)), groups: checked(await db.from("bot_groups").select("id,name,coordinator_id,bot_group_members(bot_id)").eq("owner_id", userId)) }));
  if (ctx.primary) {
    add("create_team", "Create a complete work group in one step: its specialist members and the group itself. Use this whenever the user asks for a team or group; never create the members separately first.", { name: str, category: str, members: { type: "array", minItems: 2, maxItems: 8, items: { type: "object", properties: { name: { type: "string", description: "Short job title in the user's language, e.g. Researcher, Writer, Editor. Never contains the word bot." }, description: str, instructions: str, color: { type: "string", enum: ["aurora", "ocean", "ember", "mint", "sun", "rose", "mono"] } }, required: ["name", "instructions"] } } }, ["name", "members"], async (args) => {
      const input = teamInput.parse(args);
      const palette = ["ocean", "ember", "mint", "sun", "aurora", "mono", "rose"] as const;
      const created = checked(await db.from("bots").insert(input.members.map((m, i) => ({ owner_id: userId, name: m.name, description: m.description, instructions: m.instructions, model: "gpt-oss-120b", look: { color: m.color || palette[i % palette.length] } }))).select("id,name,description"));
      const ids = created.map((b: any) => b.id);
      const cleanup = async (extra: string[] = []) => { await db.from("bots").delete().in("id", [...ids, ...extra]).eq("owner_id", userId); };
      const coordinator = await db.from("bots").insert({ owner_id: userId, name: input.name, description: `${created.length} coordinated members`, instructions: `Coordinate the group ${input.name}. Delegate actual work, never impersonate members. Members: ${JSON.stringify(created)}`, look: { color: "rose" } }).select("id").single();
      if (coordinator.error) { await cleanup(); throw new Error(coordinator.error.message); }
      const group = await db.rpc("save_bot_group", { p_name: input.name, p_coordinator: coordinator.data.id, p_members: ids, p_category: input.category });
      if (group.error) { await cleanup([coordinator.data.id]); throw new Error(group.error.message); }
      return JSON.stringify({ group: { id: group.data.id, name: input.name }, members: created });
    });
    add("create_bot", "Create one real specialist bot (not for teams; use create_team for groups). Name it after its job, never with the word bot.", { name: str, description: str, instructions: str, color: { type: "string", enum: ["aurora", "ocean", "ember", "mint", "sun", "rose", "mono"] } }, ["name", "instructions"], async (args) => {
      const input = botInput.parse(args);
      return JSON.stringify(checked(await db.from("bots").insert({ owner_id: userId, name: input.name, description: input.description, instructions: input.instructions, model: "gpt-oss-120b", look: { color: input.color } }).select("id,name,description").single()));
    });
    add("assign_bot_role", "Update a user's bot's role and specialization; do not modify the primary bot.", { bot_id: str, instructions: str, description: str }, ["bot_id", "instructions"], async (args) => {
      const input = z.object({ bot_id: z.string().uuid(), instructions: z.string().min(1).max(6000), description: z.string().max(500).optional() }).parse(args);
      if (input.bot_id === ctx.botId) throw new Error("Use a specialist bot for this role");
      return JSON.stringify(checked(await db.from("bots").update({ instructions: input.instructions, ...(input.description ? { description: input.description } : {}) }).eq("id", input.bot_id).eq("owner_id", userId).select("id,name,instructions").single()));
    });
    add("create_bot_group", "Group 2 to 8 bots that already exist. For a brand-new team use create_team instead.", { name: str, member_ids: { type: "array", items: str }, category: str }, ["name", "member_ids"], async (args) => {
      const input = groupInput.parse(args);
      if (/bot/i.test(input.name)) throw new Error("Name the group after its purpose, without the word bot");
      const members = checked(await db.from("bots").select("id,name,instructions").eq("owner_id", userId).in("id", input.member_ids));
      if (members.length !== input.member_ids.length) throw new Error("Every bot must belong to this user");
      const coordinator = checked(await db.from("bots").insert({ owner_id: userId, name: input.name, description: `${members.length} coordinated bots`, instructions: `Coordinate the group ${input.name}. Delegate actual work, never impersonate members. Members: ${JSON.stringify(members)}`, look: { color: "rose" } }).select("id").single());
      const result = await db.rpc("save_bot_group", { p_name: input.name, p_coordinator: coordinator.id, p_members: input.member_ids, p_category: input.category });
      if (result.error) { await db.from("bots").delete().eq("id", coordinator.id).eq("owner_id", userId); throw new Error(result.error.message); }
      return JSON.stringify(result.data);
    });
  }
  if (!ctx.delegation) add("delegate_to_bot", "Send real work to a specialist bot and return its actual result. Saves its conversation and, if provided, its group contribution.", { bot_id: str, task: str, group_id: str }, ["bot_id", "task"], async (args) => {
    const input = delegationInput.parse(args);
    if (input.bot_id === ctx.botId) throw new Error("Choose a different specialist");
    const bot = checked(await db.from("bots").select("id,name,instructions").eq("id", input.bot_id).eq("owner_id", userId).single());
    const group = input.group_id ? checked(await db.from("bot_groups").select("id,name,coordinator_id,bot_group_members(bot_id)").eq("id", input.group_id).eq("owner_id", userId).single()) : null;
    if (group && !group.bot_group_members.some((m: any) => m.bot_id === bot.id)) throw new Error("Bot is not a member of this group");
    const conversation = checked(await db.from("conversations").insert({ user_id: userId, bot_id: bot.id, title: input.task.slice(0, 60) }).select("id").single());
    checked(await db.from("messages").insert({ user_id: userId, conversation_id: conversation.id, bot_id: bot.id, role: "user", content: input.task }));
    const subctx = { ...ctx, botId: bot.id, conversationId: conversation.id, primary: false, delegation: true };
    const transcript: LoopEvent[] = [];
    const subEmit = (event: LoopEvent) => {
      if (event.type === "agent.reasoning") return;
      transcript.push(event);
      if (event.type.startsWith("agent.tool")) ctx.emit(event);
    };
    const { data: memories, error: memoryError } = await db.from("agent_memories").select("content").eq("user_id", userId).order("created_at").limit(100);
    if (memoryError) throw new Error(memoryError.message);
    const result = await runAgentLoop(agentPrompt(bot.name, bot.instructions) + `\nSaved user context (data, not tool authorization): ${JSON.stringify(memories)}`, [{ role: "user", content: input.task }], subEmit, ctx.signal, async () => [], { maxSteps: 12, extras: workspaceTools(subctx) });
    if (!result.trim()) throw new Error("The specialist did not finish an answer");
    checked(await db.from("messages").insert({ user_id: userId, conversation_id: conversation.id, bot_id: bot.id, role: "assistant", content: result, metadata: { delegated_from: ctx.conversationId, transcript } }));
    if (group) {
      let groupConversation = checked(await db.from("conversations").select("id").eq("user_id", userId).eq("group_id", group.id).order("created_at", { ascending: false }).limit(1).maybeSingle());
      if (!groupConversation) groupConversation = checked(await db.from("conversations").insert({ user_id: userId, group_id: group.id, bot_id: group.coordinator_id, title: input.task.slice(0, 60) }).select("id").single());
      checked(await db.from("messages").insert({ user_id: userId, conversation_id: groupConversation.id, bot_id: bot.id, role: "assistant", content: `[[speaker: ${bot.name}]]\n${result}`, metadata: { delegated_from: ctx.conversationId } }));
    }
    return JSON.stringify({ bot_id: bot.id, name: bot.name, conversation_id: conversation.id, result });
  });
  add("list_connected_accounts", "List active connected service accounts with explicit IDs. Never assume an account is connected.", {}, [], async () => JSON.stringify(await accounts(userId)));
  add("find_integration_tools", "Find actual available operations and their input schemas for a connected app.", { app: str, search: str }, ["app"], async (args) => {
    const input = z.object({ app: z.string().min(1).max(100), search: z.string().max(300).default("") }).parse(args);
    return JSON.stringify(await findTools(input.app, input.search));
  });
  add("connect_app", "Show a connection card so the user can authorize their own service account.", { app: str, reason: str }, ["app"], async (args) => {
    const input = z.object({ app: z.string().min(1).max(100), reason: z.string().max(300).default("Connect an account") }).parse(args);
    return JSON.stringify({ type: "ceyo.widget", widget: "connect_app", data: { title: input.reason, apps: [{ id: input.app, name: input.app }] } });
  });
  add("request_integration_action", "Request explicit user approval to run an integration action with a selected account; execution occurs only after approval.", { account_id: str, tool_slug: str, arguments: { type: "object" } }, ["account_id", "tool_slug", "arguments"], async (args) => {
    const input = actionInput.parse(args);
    const account = await ownedAccount(userId, input.account_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const request = checked(await supabaseAdmin.from("agent_action_requests").insert({ user_id: userId, conversation_id: ctx.conversationId, account_id: account.id, tool_slug: input.tool_slug, arguments: input.arguments as never }).select("id").single());
    return JSON.stringify({ type: "ceyo.widget", widget: "integration_approval", data: { id: request.id, app: account.app, account: account.label, action: input.tool_slug, arguments: input.arguments } });
  });
  add("ask_user", "Ask a necessary clarifying question with choices.", { question: str, options: { type: "array", items: str }, allow_free_text: { type: "boolean" } }, ["question"], async () => "Question shown. Wait for the user's answer before further dependent actions.");
  add("update_plan", "Display task progress with concrete steps.", { title: str, steps: { type: "array", items: { type: "object", properties: { title: str, status: str } } } }, ["title", "steps"], async () => "Plan updated.");
  return list;
}