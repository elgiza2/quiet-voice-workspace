/** MCP server (streamable HTTP, JSON responses) the OpenClaw agent calls for app tools.
 *  The URL carries an HMAC-signed user id; every tool re-checks the user's plan live. */
import { createFileRoute } from "@tanstack/react-router";
import { readMcpToken, publicOrigin } from "@/lib/agentsky/agentsky.server";
import {
  pickModel,
  startRun,
  userTier,
  waitRun,
  runStatusToken,
} from "@/lib/agentsky/media.server";
import { agentProposalSchema } from "@/lib/agentsky/agentProposal";

const TOOLS = [
  {
    name: "run_code",
    description:
      "Execute JavaScript in a sandbox and return stdout/logs. Use for calculations, data transforms, parsing, validation, and any computation. Python/SQL logic: express as equivalent JavaScript.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "JavaScript program to run" },
        timeout_ms: { type: "number", description: "Max wait, default 15000" },
      },
      required: ["code"],
    },
  },
  {
    name: "web_search",
    description:
      "Live web search (general or news). Returns page text. When one query fails, retry with different wording — never report failure.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        news: { type: "boolean", description: "Search news instead of web" },
      },
      required: ["query"],
    },
  },
  {
    name: "web_fetch",
    description:
      "Read a public page as plain text. Use to open real URLs, verify facts, and read docs. If it fails, try the reader variant of the same URL.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string", description: "http(s) URL to read" } },
      required: ["url"],
    },
  },
  {
    name: "remember",
    description:
      "Save a durable fact about the user (preference, identity, project, decision) so future sessions recall it. Use key/value, e.g. key='timezone', value='Africa/Cairo'.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string" },
        value: { type: "string" },
        kind: { type: "string", description: "preference | identity | project | fact" },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "recall",
    description:
      "Recall stored facts about the user matching a query. Call early in any session to personalize.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "What to look for" } },
      required: ["query"],
    },
  },
  {
    name: "spawn_helper",
    description:
      "Run a sub-task in parallel and get its result. Use to parallelize big jobs: split the work, spawn one helper per part, then merge. Each helper is an isolated agent run with the same tools.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "The sub-task to complete" },
        context: { type: "string", description: "Background the helper needs" },
      },
      required: ["goal"],
    },
  },
  {
    name: "schedule_task",
    description:
      "Schedule recurring work (daily report, price watch, reminder). The agent runs it on its own with the saved prompt. cron examples: '0 9 * * *' daily 9am, '0 */6 * * *' every 6h.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        prompt: { type: "string", description: "What to do on each run" },
        cron: { type: "string", description: "Cron expression, default daily 9am" },
        timezone: { type: "string", description: "IANA timezone, default Africa/Cairo" },
      },
      required: ["title", "prompt"],
    },
  },
  {
    name: "list_schedules",
    description: "List the user's scheduled recurring tasks with status.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browse_web",
    description:
      "Drive a real cloud browser: open pages, click, fill forms, take screenshots, extract data. Use when reading alone is not enough (login walls, JS apps, multi-step flows). Returns steps + result text + files.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "What to do in the browser, step by step" },
        budget_minutes: { type: "number", description: "Max wait, default 10, max 120" },
      },
      required: ["task"],
    },
  },
  {
    name: "save_workspace_file",
    description:
      "Save a file to the user's permanent workspace (persists across sessions). Use for code, docs, reports, data. Returns a download link.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "e.g. reports/summary.md, code/app.py" },
        content: { type: "string", description: "Text content" },
        content_base64: { type: "string", description: "Base64 for binary files" },
        mime_type: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "read_workspace_file",
    description: "Read a file back from the user's permanent workspace.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "list_workspace_files",
    description: "List files in the user's permanent workspace, optionally under a prefix.",
    inputSchema: {
      type: "object",
      properties: { prefix: { type: "string", description: "e.g. reports/" } },
    },
  },
  {
    name: "generate_image",
    description:
      "Create or edit an image from a detailed English prompt. The image is shown to the user automatically.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Detailed visual description" },
        aspect_ratio: { type: "string", description: "1:1, 16:9, 9:16, 4:3 or 3:4" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "generate_video",
    description:
      "Generate a short video for subscribers. The user sees a rendering card automatically. Do not poll.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Scene, motion and camera description" },
        aspect_ratio: { type: "string", description: "16:9, 9:16 or 1:1" },
        duration: { type: "number", description: "Seconds, 4-10" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "ask_user",
    description:
      "Ask the user a question with clickable options. After calling, end your turn and wait for the reply.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
        options: { type: "array", items: { type: "string" } },
        allow_free_text: { type: "boolean" },
      },
      required: ["question", "options"],
    },
  },
  {
    name: "create_task",
    description: "Save a task or reminder to the user's task list.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        due_at: { type: "string", description: "ISO 8601 local date-time, optional" },
        kind: { type: "string", description: "task | alarm | goal" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_plan",
    description:
      "Publish or update the step plan for the current job. Status: pending | active | done.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: { title: { type: "string" }, status: { type: "string" } },
            required: ["title", "status"],
          },
        },
      },
      required: ["steps"],
    },
  },
  {
    name: "propose_agent",
    description:
      "Suggest a specialized agent configuration for a specific task. Read-only: does not create the agent.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Suggested name" },
        description: { type: "string", description: "Short description" },
        prompt: { type: "string", description: "System prompt / instructions" },
        color: {
          type: "string",
          enum: ["aurora", "ocean", "ember", "mint", "sun", "rose", "mono"],
        },
      },
      required: ["name", "description", "prompt"],
    },
  },
  {
    name: "megsy_card",
    description:
      "Do not search the web or run any search to learn how to use this tool — every widget name and field is listed right here. THE ONLY WAY to show the user a card. Never use the session dashboard, plugins, artifacts or any built-in display tool — the user cannot see them; only this tool draws in the chat. Call it whenever an answer is visual or interactive: an order, a cart, a map, the weather, a chart, a table, a form, an email draft, a calendar slot, a payment, a shipment, a record, a file, or a list of results. The user interacts with the card and their choice comes back to you. Widget names: " +
      "image, image_grid, video, audio, file, code, diff, chart, table, diagram | " +
      "kpi, kpi_grid, result_list, result_detail, funnel, schema_card, query_result | " +
      "calendar_event, slot_picker, day_view, countdown, timezone | " +
      "map, places, route, address, weather_now, weather_forecast | " +
      "approval, form, question, connect_app, account_picker, error_card | " +
      "product_menu, option_picker, cart, checkout, order_status, receipt | " +
      "email_draft, email_list, message_card, channel_picker, task_card, note_card, sheet_row, crm_record, ticket_card, payment_link, invoice_card, shipment, social_post, campaign, repo_card, issue_card, deploy_status, employee_card, leave_card, contact.",
    inputSchema: {
      type: "object",
      properties: {
        widget: {
          type: "string",
          description: "One of the widget names listed in the tool description",
        },
        data: {
          type: "object",
          description:
            "The card content. Use the field names each widget expects, e.g. cart:{items:[{name,price,qty}],subtotal,delivery,total,currency}, " +
            "weather_now:{city,temp,description,feelsLike,humidity,wind}, map:{name,address,url}, " +
            "email_draft:{to,subject,body}, calendar_event:{title,when,duration,attendees,location}, " +
            "chart:{title,series:[{label,value}]}, table:{title,columns,rows}, kpi:{label,value,delta}, " +
            "form:{title,fields:[{name,label,required}]}, approval:{title,summary,effects:[…]}, " +
            "checkout:{store,total,currency,address,methods:[{id,label}]}, order_status:{orderId,steps:[{label,at,done}]}.",
          additionalProperties: true,
        },
      },
      required: ["widget", "data"],
    },
  },
  {
    name: "show_service_result",
    description:
      "Render the result of a connected service (any of the 600+ apps the user linked) as a clean card. Call this after you run a service action so the user sees a real card instead of raw JSON.",
    inputSchema: {
      type: "object",
      properties: {
        service: {
          type: "string",
          description: "Service name, e.g. HubSpot, Stripe, Shopify, Gmail",
        },
        logo: { type: "string", description: "Brand logo URL when you have one" },
        action: { type: "string", description: "What was run, e.g. 'Search contacts'" },
        summary: { type: "string", description: "One line describing the outcome" },
        url: { type: "string", description: "Deep link into the service, optional" },
        count: { type: "number" },
        ms: { type: "number", description: "How long the action took, in milliseconds" },
        fields: {
          type: "array",
          description: "Key/value details to show above the result",
          items: {
            type: "object",
            properties: { label: { type: "string" }, value: { type: "string" } },
            required: ["label"],
          },
        },
        columns: {
          type: "array",
          items: { type: "string" },
          description: "Table headers when the result is tabular",
        },
        rows: { type: "array", items: { type: "array", items: { type: "string" } } },
        text: { type: "string", description: "Plain result text when it is not tabular" },
      },
      required: ["service", "action"],
    },
  },
];

TOOLS.push({
  name: "share_file",
  description:
    "Deliver a finished file to the user as a download card. ALWAYS call this for every file you produced for the user (reports, documents, spreadsheets, code, PDFs, images) before you finish. Use content for text files or content_base64 for binary files.",
  inputSchema: {
    type: "object",
    properties: {
      filename: { type: "string", description: "File name with extension, e.g. report.pdf" },
      content: { type: "string", description: "Text content (for text files)" },
      content_base64: { type: "string", description: "Base64 content (for binary files)" },
      mime_type: { type: "string" },
    },
    required: ["filename"],
  } as any,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const result = (id: unknown, text: string, structured?: unknown) => ({
  jsonrpc: "2.0",
  id,
  result: {
    content: [{ type: "text", text }],
    ...(structured ? { structuredContent: structured } : {}),
  },
});

async function runTool(userId: string, origin: string, name: string, args: any, callId: string) {
  switch (name) {
    case "run_code": {
      const code = String(args?.code ?? "").trim();
      if (!code) return { text: "Missing code." };
      if (code.length > 50_000) return { text: "Code too long (max 50k chars). Split it." };
      try {
        const { runSandboxCode } = await import("@/lib/agentsky/sandbox.server");
        const out = await runSandboxCode(
          code,
          Math.min(Math.max(Number(args?.timeout_ms) || 15_000, 1000), 60_000),
        );
        return {
          text: out.ok ? `Output:\n${out.output}` : `Failed, try another approach:\n${out.output}`,
        };
      } catch (e: any) {
        return {
          text: `Could not run code: ${String(e?.message || e).slice(0, 300)}. Try another approach.`,
        };
      }
    }
    case "web_search": {
      const query = String(args?.query ?? "").trim();
      if (!query) return { text: "Missing query." };
      try {
        const { serverWebSearch } = await import("@/lib/agentsky/sandbox.server");
        const out = await serverWebSearch(query, Boolean(args?.news));
        return {
          text: out.ok
            ? `Results:\n${out.output}`
            : `Search failed, rephrase and retry:\n${out.output}`,
        };
      } catch (e: any) {
        return {
          text: `Search error: ${String(e?.message || e).slice(0, 300)}. Rephrase and retry.`,
        };
      }
    }
    case "web_fetch": {
      const url = String(args?.url ?? "").trim();
      if (!url) return { text: "Missing url." };
      try {
        const { serverWebFetch } = await import("@/lib/agentsky/sandbox.server");
        const out = await serverWebFetch(url);
        return {
          text: out.ok
            ? `Page text:\n${out.output}`
            : `Fetch failed, try another URL or source:\n${out.output}`,
        };
      } catch (e: any) {
        return {
          text: `Fetch error: ${String(e?.message || e).slice(0, 300)}. Try another source.`,
        };
      }
    }
    case "remember": {
      const key = String(args?.key ?? "")
        .trim()
        .slice(0, 120);
      const value = String(args?.value ?? "")
        .trim()
        .slice(0, 2000);
      if (!key || !value) return { text: "Missing key or value." };
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await (supabaseAdmin as any).from("agent_memory").upsert(
          {
            user_id: userId,
            domain: "chat",
            kind: String(args?.kind || "fact").slice(0, 40),
            key,
            value,
            content: `${key}: ${value}`,
            confidence: 1,
          },
          { onConflict: "user_id,domain,key" },
        );
        return { text: `Remembered "${key}".` };
      } catch (e: any) {
        return { text: `Could not save memory: ${String(e?.message || e).slice(0, 200)}` };
      }
    }
    case "recall": {
      const query = String(args?.query ?? "")
        .trim()
        .slice(0, 500);
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await (supabaseAdmin as any)
          .from("agent_memory")
          .select("key,value,kind,updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(50);
        const rows = (Array.isArray(data) ? data : []) as {
          key: string;
          value: string;
          kind: string;
        }[];
        if (!rows.length) return { text: "No stored facts yet." };
        const tokens = query
          .toLowerCase()
          .split(/[^a-z0-9\u0600-\u06FF]+/g)
          .filter((t) => t.length >= 3);
        const scored = rows
          .map((r) => {
            const bag = `${r.key} ${r.value}`.toLowerCase();
            const hits = tokens.filter((t) => bag.includes(t)).length;
            const boost = r.kind === "preference" || r.kind === "identity" ? 1 : 0;
            return { r, score: hits + boost };
          })
          .filter((s) => !query || s.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 12);
        if (!scored.length)
          return { text: "No matching facts. General facts stored: " + rows.length };
        return {
          text:
            "Recalled facts:\n" +
            scored.map((s) => `- [${s.r.kind}] ${s.r.key}: ${s.r.value}`).join("\n"),
        };
      } catch (e: any) {
        return { text: `Could not recall: ${String(e?.message || e).slice(0, 200)}` };
      }
    }
    case "spawn_helper": {
      const goal = String(args?.goal ?? "").trim();
      if (!goal) return { text: "Missing goal." };
      if (goal.length > 8000) return { text: "Goal too long (max 8k chars). Split it." };
      try {
        const { runHelperTask } = await import("@/lib/agentsky/helpers.server");
        const out = await runHelperTask(
          userId,
          origin,
          goal,
          String(args?.context ?? "").slice(0, 4000),
        );
        return {
          text: out.ok
            ? `Helper result:\n${out.output}`
            : `Helper failed, continue another way:\n${out.output}`,
        };
      } catch (e: any) {
        return {
          text: `Helper error: ${String(e?.message || e).slice(0, 300)}. Continue another way.`,
        };
      }
    }
    case "schedule_task": {
      const title = String(args?.title ?? "")
        .trim()
        .slice(0, 120);
      const prompt = String(args?.prompt ?? "")
        .trim()
        .slice(0, 8000);
      if (!title || !prompt) return { text: "Missing title or prompt." };
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await (supabaseAdmin as any)
          .from("agent_schedules")
          .insert({
            user_id: userId,
            title,
            prompt,
            cron: String(args?.cron || "0 9 * * *").slice(0, 60),
            timezone: String(args?.timezone || "Africa/Cairo").slice(0, 60),
          })
          .select("id")
          .single();
        if (error) throw error;
        return { text: `Scheduled "${title}". It will run on its own from now on.` };
      } catch (e: any) {
        return { text: `Could not schedule: ${String(e?.message || e).slice(0, 200)}` };
      }
    }
    case "list_schedules": {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await (supabaseAdmin as any)
          .from("agent_schedules")
          .select("title,cron,active,last_run_at,last_status")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20);
        const rows = (Array.isArray(data) ? data : []) as {
          title: string;
          cron: string;
          active: boolean;
          last_run_at: string;
          last_status: string;
        }[];
        if (!rows.length) return { text: "No scheduled tasks." };
        return {
          text:
            "Scheduled tasks:\n" +
            rows
              .map(
                (r) =>
                  `- ${r.active ? "ON" : "OFF"} "${r.title}" (${r.cron}) last: ${r.last_status || "never"}`,
              )
              .join("\n"),
        };
      } catch (e: any) {
        return { text: `Could not list: ${String(e?.message || e).slice(0, 200)}` };
      }
    }
    case "browse_web": {
      const task = String(args?.task ?? "")
        .trim()
        .slice(0, 8000);
      if (!task) return { text: "Missing task." };
      try {
        const { runAgentBrowserTask } = await import("@/lib/agentsky/browser.server");
        const minutes = Math.min(Math.max(Number(args?.budget_minutes) || 10, 2), 120);
        const out = await runAgentBrowserTask(userId, task, minutes * 60_000);
        const payload = out.files?.length
          ? { type: "megsy.browser_files", files: out.files }
          : undefined;
        return {
          text: out.ok
            ? `Browser result:\n${out.output}`
            : `Browser failed, try another way:\n${out.output}`,
          payload,
        };
      } catch (e: any) {
        return {
          text: `Browser error: ${String(e?.message || e).slice(0, 300)}. Try another approach.`,
        };
      }
    }
    case "save_workspace_file": {
      const rawPath = String(args?.path ?? "").trim();
      if (!rawPath) return { text: "Missing path." };
      try {
        const { saveWorkspaceFile } = await import("@/lib/agentsky/workspace.server");
        const out = await saveWorkspaceFile(
          userId,
          rawPath,
          args?.content,
          args?.content_base64,
          args?.mime_type,
        );
        if (!out.ok) return { text: out.error };
        return {
          text: `Saved to workspace: ${out.path} (${out.size} bytes). Download link ready.`,
          payload: {
            type: "megsy.file",
            name: out.name,
            url: out.url,
            mime: out.mime,
            size: out.size,
          },
        };
      } catch (e: any) {
        return { text: `Could not save: ${String(e?.message || e).slice(0, 200)}` };
      }
    }
    case "read_workspace_file": {
      const rawPath = String(args?.path ?? "").trim();
      if (!rawPath) return { text: "Missing path." };
      try {
        const { readWorkspaceFile } = await import("@/lib/agentsky/workspace.server");
        const out = await readWorkspaceFile(userId, rawPath);
        return { text: out.ok ? `File ${out.path}:\n${out.content}` : out.error };
      } catch (e: any) {
        return { text: `Could not read: ${String(e?.message || e).slice(0, 200)}` };
      }
    }
    case "list_workspace_files": {
      try {
        const { listWorkspaceFiles } = await import("@/lib/agentsky/workspace.server");
        const out = await listWorkspaceFiles(userId, String(args?.prefix ?? ""));
        return {
          text: out.ok
            ? out.files.length
              ? "Workspace files:\n" + out.files.map((f) => `- ${f}`).join("\n")
              : "Workspace is empty."
            : out.error,
        };
      } catch (e: any) {
        return { text: `Could not list: ${String(e?.message || e).slice(0, 200)}` };
      }
    }
    case "propose_agent": {
      const proposal = agentProposalSchema.parse(args);
      return {
        text: "The proposal and Create agent button are shown. Nothing has been created. Wait for explicit approval or changes.",
        payload: { type: "megsy.agent_proposal", proposal },
      };
    }
    case "generate_image": {
      const prompt = String(args?.prompt || "").slice(0, 5000);
      if (!prompt) return { text: "Missing prompt." };
      const tier = await userTier(userId);
      const model = pickModel("image", tier);
      const run = await startRun(
        model,
        model.build({ prompt, aspect: String(args?.aspect_ratio || "1:1") }),
        `img-${userId}-${callId}`,
      );
      const s = await waitRun(run.runId, origin, 55_000);
      const payload = {
        type: "megsy.media",
        kind: "image",
        runId: run.runId,
        token: runStatusToken(run.runId),
        status: s.status,
        urls: s.urls,
        model: model.label,
        prompt,
      };
      if (s.status === "COMPLETED")
        return { text: "Done — the image is now shown to the user. Do not paste links.", payload };
      if (s.status === "RUNNING")
        return {
          text: "The image is still rendering and will appear to the user on its own.",
          payload,
        };
      return {
        text: `Image generation failed: ${s.error || "unknown error"}. Tell the user briefly.`,
        payload,
      };
    }
    case "generate_video": {
      const prompt = String(args?.prompt || "")
        .trim()
        .slice(0, 5000);
      if (!prompt) return { text: "Missing prompt." };
      const model = pickModel("video", await userTier(userId));
      const run = await startRun(
        model,
        model.build({
          prompt,
          aspect: String(args?.aspect_ratio || "16:9"),
          duration: Number(args?.duration) || 5,
        }),
        `vid-${userId}-${callId}`,
      );
      return {
        text: "The video is rendering in the chat card. Do not wait or paste links.",
        payload: {
          type: "megsy.media",
          kind: "video",
          runId: run.runId,
          token: runStatusToken(run.runId),
          status: run.status,
          urls: [],
          model: model.label,
          prompt,
        },
      };
    }
    case "share_file": {
      const name = String(args?.filename || "file.txt")
        .replace(/[^\w.\- ]+/g, "_")
        .slice(0, 120);
      const bytes = args?.content_base64
        ? Uint8Array.from(atob(String(args.content_base64)), (c) => c.charCodeAt(0))
        : new TextEncoder().encode(String(args?.content ?? ""));
      if (!bytes.length) return { text: "The file is empty; nothing was shared." };
      if (bytes.length > 25 * 1024 * 1024)
        return { text: "The file is larger than 25 MB; split it or compress it." };
      const mime = String(args?.mime_type || "application/octet-stream");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const path = `${userId}/${crypto.randomUUID()}/${name}`;
      const up = await supabaseAdmin.storage
        .from("agent-files")
        .upload(path, bytes, { contentType: mime, upsert: false });
      if (up.error) return { text: `Could not save the file: ${up.error.message}` };
      const signed = await supabaseAdmin.storage
        .from("agent-files")
        .createSignedUrl(path, 60 * 60 * 24 * 30, { download: name });
      if (signed.error || !signed.data) return { text: "Could not create a download link." };
      return {
        text: "The file is now shown to the user as a download card. Do not paste the link.",
        payload: { type: "megsy.file", name, url: signed.data.signedUrl, mime, size: bytes.length },
      };
    }
    case "ask_user":
      return {
        text: "The question is shown to the user. End your turn now and wait for the answer.",
      };
    case "megsy_card": {
      const widget = String(args?.widget || "").trim();
      if (!widget) return { text: "Missing widget name." };
      const data = (args?.data ?? {}) as Record<string, unknown>;
      return {
        text: `The ${widget} card is now shown to the user. Do not repeat its contents as text — add at most one short sentence of context.`,
        payload: { type: "megsy.widget", widget, data },
      };
    }
    case "show_service_result": {
      const service = String(args?.service || "Service").slice(0, 60);
      const tabular = Array.isArray(args?.columns) && Array.isArray(args?.rows);
      const payload = {
        type: "megsy.service",
        service,
        logo: args?.logo,
        action: String(args?.action || "Action").slice(0, 120),
        summary: args?.summary ? String(args.summary).slice(0, 400) : undefined,
        url: args?.url,
        count: args?.count,
        ms: args?.ms,
        fields: Array.isArray(args?.fields) ? args.fields.slice(0, 12) : undefined,
        result: tabular
          ? { columns: args.columns.slice(0, 8), rows: args.rows.slice(0, 50) }
          : args?.text
            ? { text: String(args.text).slice(0, 4000) }
            : null,
      };
      return {
        text: `The ${service} result is shown to the user as a card. Do not paste the raw data again — summarise it in one or two sentences.`,
        payload,
      };
    }
    case "create_task":
      return { text: "Task added to the user's list." };
    case "update_plan":
      return { text: "Plan updated." };
    default:
      return { text: `Unknown tool ${name}` };
  }
}

export const Route = createFileRoute("/api/public/agent-tools/$token")({
  server: {
    handlers: {
      GET: async () => new Response("Method not allowed", { status: 405 }),
      POST: async ({ request, params }) => {
        const userId = readMcpToken(params.token);
        if (!userId) return json({ error: "unauthorized" }, 401);
        let msg: any;
        try {
          msg = await request.json();
        } catch {
          return json(
            { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
            400,
          );
        }
        const id = msg?.id;
        // Notifications get no body.
        if (id === undefined || id === null) return new Response(null, { status: 202 });
        switch (msg.method) {
          case "initialize":
            return json({
              jsonrpc: "2.0",
              id,
              result: {
                protocolVersion: msg.params?.protocolVersion || "2025-06-18",
                capabilities: { tools: {} },
                serverInfo: { name: "megsy", version: "1.0.0" },
              },
            });
          case "ping":
            return json({ jsonrpc: "2.0", id, result: {} });
          case "tools/list":
            return json({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
          case "tools/call": {
            const name = String(msg.params?.name || "");
            try {
              const r = await runTool(
                userId,
                publicOrigin(request),
                name,
                msg.params?.arguments ?? {},
                String(id),
              );
              return json(
                result(
                  id,
                  r.payload ? `${r.text}\n<!--megsy:${JSON.stringify(r.payload)}-->` : r.text,
                  r.payload,
                ),
              );
            } catch (e: any) {
              return json({
                jsonrpc: "2.0",
                id,
                result: {
                  isError: true,
                  content: [{ type: "text", text: String(e?.message || e) }],
                },
              });
            }
          }
          default:
            return json({
              jsonrpc: "2.0",
              id,
              error: { code: -32601, message: "Method not found" },
            });
        }
      },
    },
  },
});
