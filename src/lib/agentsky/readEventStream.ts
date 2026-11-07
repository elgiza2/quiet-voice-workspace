import type { RawEvent } from "./client";

/** Reads AgentSky's standing event feed; a caller can end its turn without waiting for socket closure. */
export async function readEventStream(body: ReadableStream<Uint8Array>, onEvent: (event: RawEvent) => boolean | void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const frame = (chunk: string) => {
    const data = chunk.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    if (!data || data === "[DONE]") return false;
    let event: RawEvent;
    try { event = JSON.parse(data); } catch { return false; }
    if (!event || typeof event.type !== "string" || typeof event.id !== "string") return false;
    return onEvent(event) === true;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let separator = /\r?\n\r?\n/.exec(buffer);
      while (separator) {
        const stop = frame(buffer.slice(0, separator.index));
        buffer = buffer.slice(separator.index + separator[0].length);
        if (stop) return;
        separator = /\r?\n\r?\n/.exec(buffer);
      }
      if (done) { if (buffer.trim()) frame(buffer); return; }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}