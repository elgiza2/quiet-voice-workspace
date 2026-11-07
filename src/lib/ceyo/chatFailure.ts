/** Operational failures are terminal chat events, never a successful model answer. */
export function chatFailure(message: string, code: string) {
  const id = crypto.randomUUID();
  const events = [
    { id: `${id}-error`, type: "session.error", code, message },
    { id: `${id}-idle`, type: "session.status_idle", stop_reason: { type: "error" } },
  ];
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
  });
}