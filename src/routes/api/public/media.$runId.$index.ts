/** Signed media link: re-reads the AgentSky run and streams the image/video bytes. */
import { createFileRoute } from "@tanstack/react-router";
import { extractMedia, readRun, verifyMediaLink } from "@/lib/agentsky/media.server";

export const Route = createFileRoute("/api/public/media/$runId/$index")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const index = Number(params.index) || 0;
        const s = new URL(request.url).searchParams.get("s") || "";
        if (!verifyMediaLink(params.runId, index, s)) return new Response("Forbidden", { status: 403 });
        const run = await readRun(params.runId).catch(() => null);
        const item = run ? extractMedia(run)[index] : null;
        if (!item) return new Response("Not found", { status: 404 });
        const cache = { "Cache-Control": "private, max-age=3000" };
        if (item.kind === "b64") {
          const bytes = Buffer.from(item.value, "base64");
          return new Response(bytes, { headers: { "Content-Type": item.mime, ...cache } });
        }
        const range = request.headers.get("range");
        const upstream = await fetch(item.value, range ? { headers: { range } } : undefined);
        const h = new Headers(cache);
        for (const k of ["content-type", "content-length", "content-range", "accept-ranges"]) {
          const v = upstream.headers.get(k);
          if (v) h.set(k, v);
        }
        return new Response(upstream.body, { status: upstream.status, headers: h });
      },
    },
  },
});
