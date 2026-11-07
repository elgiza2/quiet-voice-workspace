import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
export const Route = createFileRoute("/api/ceyo-task")({ server: { handlers: {
  POST: async ({ request }) => {
    const { authenticate } = await import("@/lib/ceyo/auth.server");
    const auth = await authenticate(request).catch(() => null);
    if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
    const parsed = z.object({ jobId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid job" }, { status: 400 });
    const { data: job } = await auth.db.from("agent_jobs").select("id,status,conversation_id").eq("id", parsed.data.jobId).eq("user_id", auth.userId).maybeSingle();
    if (!job) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ done: ["completed", "failed", "cancelled"].includes(job.status), status: job.status, conversationId: job.conversation_id }, { headers: { "Cache-Control": "no-store" } });
  },
} } });