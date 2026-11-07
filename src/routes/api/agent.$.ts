/** Authenticated agent API — the browser's only door to AgentSky (agents, sessions, stream, media). */
import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest } from "@/lib/api/authenticateRequest";
import { canUseAgent, isOctoberOfferActive, OCTOBER_OFFER_END } from "@/lib/octoberOffer";
import { agentProposalSchema } from "@/lib/agentsky/agentProposal";
import {
  AgentSkyError,
  agentSpec,
  api,
  ensureDefaultAgent,
  getOwnedAgent,
  getOwnedSession,
  listUserAgents,
  listAgentTemplates,
  resolveUserAgent,
  publicOrigin,
  streamSession,
} from "@/lib/agentsky/agentsky.server";
import {
  pickModel,
  publicModels,
  runStatusToken,
  startRun,
  userTier,
} from "@/lib/agentsky/media.server";
import {
  bearer,
  chargeKnown,
  creditBalance,
  latestOpenTurn,
  mediaCostUsd,
  openTurn,
  settleTurn,
  TurnMeter,
} from "@/lib/agentsky/metering.server";

const j = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

type Content =
  { type: "text"; text: string } | { type: "image"; source: { type: "url"; url: string } };

function contentOf(body: any): Content[] {
  const text = String(body?.text ?? "").slice(0, 20000);
  const images: string[] = Array.isArray(body?.images) ? body.images.slice(0, 6) : [];
  const out: Content[] = [];
  if (text) out.push({ type: "text", text });
  for (const url of images)
    if (typeof url === "string" && /^https:\/\//.test(url))
      out.push({ type: "image", source: { type: "url", url } });
  return out;
}

/** Characters the caller actually sent — the input side of a metered turn. */
function inputCharsOf(content: Content[]): number {
  return content.reduce((n, c) => n + (c.type === "text" ? c.text.length : 0), 0);
}

/**
 * Credits are the gate: a turn needs a live balance before it starts. A metering
 * outage must never lock paying users out, so an unreadable balance is allowed
 * through and settled later by the sweep.
 */
async function requireCredits(jwt: string): Promise<Response | null> {
  const balance = await creditBalance(jwt);
  if (balance === null) return null;
  if (balance <= 0)
    return j(
      {
        error: {
          code: "insufficient_credits",
          message: "You are out of credits. Upgrade your plan to keep going.",
        },
      },
      402,
    );
  return null;
}
function agentView(a: any) {
  return {
    id: a.id,
    name: a.displayName,
    description: a.description && !a.description.startsWith("OpenClaw ·") ? a.description : "",
    color: a.metadata?.color || "aurora",
    prompt: a.metadata?.userPrompt || "",
    isDefault: String(a.name).endsWith("_default"),
    createdAt: a.createdAt,
  };
}

/** Built-in catalogue shown even when the AgentSky provider key is missing,
 *  so the Agents page always lists something instead of a bare error card.
 *  Entries are flagged `isTemplate` and resolve to a real agent once the
 *  provider is configured. */
const BUILTIN_SPECIALISTS = [
  { name: "Researcher", description: "Live facts, news and sources", color: "ocean" },
  { name: "Engineer", description: "Code, repos and debugging", color: "mint" },
  { name: "Analyst", description: "Numbers, finance and strategy", color: "rose" },
  { name: "Writer", description: "Copy, docs and scripts", color: "ember" },
];

function builtinAgents() {
  return [
    {
      id: "megsy-default",
      name: "Ceyo",
      description: "Primary assistant",
      color: "aurora",
      prompt: "",
      isDefault: true,
      createdAt: "",
    },
    ...BUILTIN_SPECIALISTS.map((s) => ({
      id: `template:builtin-${s.name.toLowerCase()}`,
      name: s.name,
      description: s.description,
      color: s.color,
      prompt: "",
      isDefault: false,
      isTemplate: true,
      createdAt: "",
    })),
    {
      id: "higgsfield",
      name: "Higgsfield",
      description: "Images & video",
      color: "sun",
      prompt: "",
      isDefault: false,
      isTemplate: true,
      mediaOnly: true,
      createdAt: "",
    },
  ];
}

async function fullAgents(userId: string, origin: string) {
  try {
    await ensureDefaultAgent(userId, origin);
  } catch (e: any) {
    // No AgentSky provider key (or provider down): fall back to the built-in
    // catalogue so the page still lists agents instead of erroring out.
    if (e instanceof AgentSkyError && (e.code === "not_configured" || e.status >= 500)) {
      return builtinAgents();
    }
    throw e;
  }
  const list = await listUserAgents(userId);
  const details = await Promise.all(
    list.map((a) =>
      api<{ agent: any }>(`/agents/${a.id}`)
        .then((r) => r.agent)
        .catch(() => a),
    ),
  );
  const templates = await listAgentTemplates().catch(() => []);
  const catalogue = templates.map((a, index) => ({
    id: `template:${a.id}`,
    name: String(a.name).replace(/^Chat · /, ""),
    description: a.llm || "",
    color: ["ocean", "mint", "rose", "ember"][index % 4],
    prompt: "",
    isDefault: false,
    isTemplate: true,
    createdAt: a.createdAt,
  }));
  const higgsfield = {
    id: "higgsfield",
    name: "Higgsfield",
    description: "Images & video",
    color: "sun",
    prompt: "",
    isDefault: false,
    isTemplate: true,
    mediaOnly: true,
    createdAt: "",
  };
  return [
    ...details
      .filter((a) => !a.metadata?.templateId && a.metadata?.kind !== "media")
      .map(agentView),
    ...catalogue,
    higgsfield,
  ].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

async function handle(request: Request, splat: string): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth) return j({ error: { code: "unauthorized", message: "Please sign in" } }, 401);
  const uid = auth.user.id;
  const origin = publicOrigin(request);
  const parts = splat.split("/").filter(Boolean);
  const method = request.method;
  const body =
    method === "GET" || method === "DELETE" ? null : await request.json().catch(() => ({}));

  // GET bootstrap
  if (parts[0] === "bootstrap" && method === "GET") {
    const [agents, tier] = await Promise.all([fullAgents(uid, origin), userTier(uid)]);
    return j({
      agents,
      tier,
      models: publicModels(tier),
      offer: { active: isOctoberOfferActive(), endsAt: OCTOBER_OFFER_END },
    });
  }

  // Agents
  if (parts[0] === "agents") {
    if (method === "POST" && !parts[1]) {
      const parsed = agentProposalSchema.safeParse(body);
      if (!parsed.success)
        return j(
          {
            error: {
              code: "invalid_request",
              message: "Please provide a valid name, description and instructions.",
            },
          },
          400,
        );
      const { name, description, prompt, color } = parsed.data;
      const { agent } = await api<{ agent: any }>("/agents", {
        method: "POST",
        body: JSON.stringify(
          agentSpec({
            userId: uid,
            origin,
            displayName: name,
            description,
            prompt,
            color,
            kind: "custom",
          }),
        ),
      });
      return j({ agent: agentView(agent) }, 201);
    }
    if (parts[1] && method === "PATCH") {
      const parsed = agentProposalSchema.safeParse(body);
      if (!parsed.success)
        return j(
          {
            error: {
              code: "invalid_request",
              message: "Please provide a valid name, description and instructions.",
            },
          },
          400,
        );
      const a = await getOwnedAgent(uid, parts[1]);
      const { name, description, prompt, color } = parsed.data;
      const basePrompt = String(a.prompt || "").split("\n\nYour persona and job:")[0];
      const { agent } = await api<{ agent: any }>(`/agents/${encodeURIComponent(a.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: name,
          description,
          prompt: `${basePrompt}\n\nYour persona and job:\n${prompt}`.slice(0, 100000),
          metadata: { ...a.metadata, color, userPrompt: prompt },
        }),
      });
      return j({ agent: agentView(agent) });
    }
    if (parts[1] && method === "DELETE") {
      const a = await getOwnedAgent(uid, parts[1]);
      if (String(a.name).endsWith("_default"))
        return j({ error: { code: "forbidden", message: "Default agent" } }, 403);
      await api(`/agents/${a.id}/archive`, { method: "POST", body: "{}" });
      return j({ ok: true });
    }
  }

  // Gate media intent server-side before creating or continuing any paid work.
  if (parts[0] === "sessions" && method === "POST" && (!parts[1] || parts[2] === "messages")) {
    const { detectMediaIntent } = await import("@/lib/agentsky/mediaIntent");
    if (
      (body?.agentId === "higgsfield" || detectMediaIntent(String(body?.text || ""))) &&
      (await userTier(uid)) === "free"
    )
      return j(
        {
          error: {
            code: "upgrade_required",
            message: "Images and video are available on the Pro plan.",
          },
        },
        402,
      );
  }

  // Sessions
  if (parts[0] === "sessions") {
    const sid = parts[1];
    if (!sid && method === "GET") {
      const agents = await listUserAgents(uid);
      const lists = await Promise.all(
        agents.map((a) =>
          api<{ sessions: any[] }>(`/sessions?agent=${a.id}`)
            .then((r) => r.sessions)
            .catch(() => []),
        ),
      );
      const sessions = lists
        .flat()
        .filter((s) => s.metadata?.owner === uid && !s.archived)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map((s) => ({
          id: s.id,
          agentId: s.agentId,
          title: s.title || "New chat",
          status: s.status,
          createdAt: s.createdAt,
        }));
      return j({ sessions });
    }
    if (!sid && method === "POST") {
      const requestedId = typeof body?.agentId === "string" ? body.agentId : undefined;
      if (requestedId && !canUseAgent(await userTier(uid), requestedId === "higgsfield")) {
        const defaultAgent = await ensureDefaultAgent(uid, origin);
        if (requestedId !== defaultAgent.id)
          return j(
            {
              error: {
                code: "upgrade_required",
                message: "Switching agents is available on the Pro plan.",
              },
            },
            402,
          );
      }
      const selectedAgent = await resolveUserAgent(uid, origin, requestedId);
      const agentId = selectedAgent.id;
      const content = contentOf(body);
      if (!content.length)
        return j({ error: { code: "invalid_request", message: "Empty message" } }, 400);
      const blocked = await requireCredits(bearer(request));
      if (blocked) return blocked;
      const title =
        String(body?.text || "New chat")
          .replace(/\s+/g, " ")
          .slice(0, 80) || "New chat";
      const { session } = await api<{ session: any }>("/sessions", {
        method: "POST",
        body: JSON.stringify({
          agent: agentId,
          title,
          metadata: { owner: uid },
          // Long missions can run for hours: keep the session alive for up to
          // 12h of idle time so the agent keeps working without interruption.
          idleTimeoutSeconds: 43200,
          initial_events: [{ type: "user.message", content }],
        }),
      });
      await openTurn(bearer(request), session.id, inputCharsOf(content));
      return j(
        {
          session: { id: session.id, agentId, title, status: session.status },
          agent: agentView(selectedAgent),
        },
        201,
      );
    }
    if (!sid) return j({ error: { code: "not_found", message: "Not found" } }, 404);
    const session = await getOwnedSession(uid, sid);

    if (!parts[2] && method === "GET")
      return j({
        session: {
          id: session.id,
          agentId: session.agentId,
          title: session.title,
          status: session.status,
        },
      });
    if (!parts[2] && method === "PATCH") {
      await api(`/sessions/${sid}`, {
        method: "PATCH",
        body: JSON.stringify({ title: String(body?.title || "").slice(0, 120) }),
      });
      return j({ ok: true });
    }
    if (!parts[2] && method === "DELETE") {
      await api(`/sessions/${sid}/archive`, { method: "POST", body: "{}" });
      return j({ ok: true });
    }
    if (parts[2] === "events" && method === "GET") {
      const r = await api<{ events: any[] }>(`/sessions/${sid}/events?limit=500`);
      return j({ events: r.events, status: session.status });
    }
    if (parts[2] === "stream" && method === "GET") {
      const jwt = bearer(request);
      const turnId = await latestOpenTurn(jwt, sid);
      const upstream = await streamSession(sid, request.signal);
      if (!upstream.ok || !upstream.body)
        return j({ error: { code: "stream_failed", message: `Stream ${upstream.status}` } }, 502);
      // Measure the turn on the way through: real output characters and real awake
      // seconds. The client keeps its own copy of the stream, untouched.
      const [toClient, toMeter] = upstream.body.tee();
      const meter = new TurnMeter();
      void (async () => {
        try {
          const reader = toMeter.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) meter.push(value);
          }
        } catch {
          /* the client disconnected — the sweep settles whatever is left */
        }
        const measured = meter.finish();
        if (turnId) await settleTurn(jwt, turnId, measured.chars, measured.seconds);
      })();
      return new Response(toClient, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
        },
      });
    }
    if (parts[2] === "messages" && method === "POST") {
      const sessionAgent = await getOwnedAgent(uid, session.agentId);
      if (sessionAgent.metadata?.kind === "media" && (await userTier(uid)) === "free")
        return j(
          {
            error: {
              code: "upgrade_required",
              message: "Images and video are available on the Pro plan.",
            },
          },
          402,
        );
      if (!canUseAgent(await userTier(uid))) {
        const defaultAgent = await ensureDefaultAgent(uid, origin);
        if (session.agentId !== defaultAgent.id)
          return j(
            {
              error: {
                code: "upgrade_required",
                message: "Switching agents is available on the Pro plan.",
              },
            },
            402,
          );
      }
      const content = contentOf(body);
      if (!content.length)
        return j({ error: { code: "invalid_request", message: "Empty message" } }, 400);
      const blocked = await requireCredits(bearer(request));
      if (blocked) return blocked;
      await openTurn(bearer(request), sid, inputCharsOf(content));
      // No requireIdle: AgentSky queues a message sent while the agent works.
      const r = await api<{ data: any[] }>(`/sessions/${sid}/events`, {
        method: "POST",
        body: JSON.stringify({ events: [{ type: "user.message", content }] }),
      });
      return j({ event: r.data?.[0] ?? null });
    }
    if (parts[2] === "interrupt" && method === "POST") {
      const r = await api<{ status: string }>(`/sessions/${sid}/interrupt`, {
        method: "POST",
        body: "{}",
      });
      return j(r);
    }
    if (parts[2] === "requests" && method === "GET") {
      const r = await api<{ task: any }>(`/tasks/${sid}?by=session`).catch(() => null);
      return j({ requests: r?.task?.requests ?? [], sessions: r?.task?.sessions ?? [] });
    }
  }

  // Agent runs (tasks) owned by the user
  if (parts[0] === "tasks" && method === "GET") {
    const agents = await listUserAgents(uid);
    const ids = new Set(agents.map((a) => a.id));
    if (parts[1]) {
      const result = await api<{ task: any }>(`/tasks/${encodeURIComponent(parts[1])}`);
      if (!result.task?.agent_id || !ids.has(result.task.agent_id))
        return j({ error: { code: "not_found", message: "Task not found" } }, 404);
      return j({ sessions: result.task.sessions ?? [] });
    }
    const r = await api<{ tasks: any[] }>("/tasks").catch(() => ({ tasks: [] }));
    const tasks = r.tasks
      .filter((t) => t.agent_id && ids.has(t.agent_id) && !t.archived)
      .map((t) => ({
        id: t.id,
        agentId: t.agent_id,
        title: t.title,
        attention: t.attention,
        statusLine: t.status_line,
        openRequests: t.open_request_count,
        helpers: Math.max(0, (t.session_count || 1) - 1),
        lastActivityAt: t.last_activity_at,
      }));
    return j({ tasks });
  }

  // Direct media generation (studio and video cards)
  if (parts[0] === "media" && method === "POST") {
    const kind = body?.kind === "video" ? "video" : "image";
    const prompt = String(body?.prompt || "")
      .trim()
      .slice(0, 5000);
    if (!prompt)
      return j({ error: { code: "invalid_request", message: "Prompt is required" } }, 400);
    const tier = await userTier(uid);
    const model = pickModel(kind, tier, body?.model);
    // Media is charged before it runs, at the published rate for this model and the
    // real duration requested — the one place where the exact cost is already known.
    const seconds = kind === "video" ? Math.min(Math.max(Number(body?.duration) || 5, 2), 5) : 1;
    const cost = mediaCostUsd(kind, model.endpoint, seconds);
    const charge = await chargeKnown(
      bearer(request),
      cost,
      kind === "video" ? "video_generation" : "image_generation",
      `${model.label} · ${kind === "video" ? `${seconds}s` : "1 asset"}`,
    );
    if (!charge.ok)
      return j(
        {
          error: {
            code: "insufficient_credits",
            message: `This ${kind} needs ${charge.credits} credits. You are out of credits — upgrade your plan to keep going.`,
          },
        },
        402,
      );
    const idem = String(body?.idempotencyKey || crypto.randomUUID()).slice(0, 100);
    const run = await startRun(
      model,
      model.build({
        prompt,
        aspect: String(body?.aspect || (kind === "video" ? "16:9" : "1:1")),
        duration: Number(body?.duration) || 5,
      }),
      `${kind}-${uid}-${idem}`,
    );
    return j({
      runId: run.runId,
      token: runStatusToken(run.runId),
      model: model.label,
      status: run.status,
    });
  }

  return j({ error: { code: "not_found", message: "Not found" } }, 404);
}

async function safe(request: Request, splat: string) {
  try {
    return await handle(request, splat);
  } catch (e: any) {
    if (e instanceof AgentSkyError) {
      const status = e.status >= 400 && e.status < 600 ? e.status : 502;
      return j({ error: { code: e.code, message: e.message } }, status);
    }
    console.error("[agent api]", e);
    return j({ error: { code: "server_error", message: "Something went wrong" } }, 500);
  }
}

export const Route = createFileRoute("/api/agent/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => safe(request, params._splat || ""),
      POST: ({ request, params }) => safe(request, params._splat || ""),
      PATCH: ({ request, params }) => safe(request, params._splat || ""),
      DELETE: ({ request, params }) => safe(request, params._splat || ""),
    },
  },
});
