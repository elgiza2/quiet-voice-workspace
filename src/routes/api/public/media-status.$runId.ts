/** Run status for media cards (signed per run, so no session is needed to poll). */
import { createFileRoute } from "@tanstack/react-router";
import { publicOrigin } from "@/lib/agentsky/agentsky.server";
import { runState, verifyStatusToken } from "@/lib/agentsky/media.server";

export const Route = createFileRoute("/api/public/media-status/$runId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const t = new URL(request.url).searchParams.get("t") || "";
        if (!verifyStatusToken(params.runId, t)) return new Response("Forbidden", { status: 403 });
        try {
          const s = await runState(params.runId, publicOrigin(request));
          return Response.json(s, { headers: { "Cache-Control": "no-store" } });
        } catch (e: any) {
          return Response.json({ runId: params.runId, status: "FAILED", urls: [], error: e?.message || "Media status unavailable" }, { status: 200 });
        }
      },
    },
  },
});
