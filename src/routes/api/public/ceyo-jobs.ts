import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/ceyo-jobs")({ server: { handlers: { POST: async ({ request }) => {
  const secret = process.env.LOVABLE_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => null)) as { jobId?: string } | null;
  const { runJob } = await import("@/lib/ceyo/backgroundJobs.server");
  try {
    return Response.json({ status: await runJob(String(body?.jobId || "")) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
} } } });
