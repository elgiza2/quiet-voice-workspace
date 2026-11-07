import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
function P() {
  const [log, setLog] = useState<string[]>([]);
  useEffect(() => { let c: any; void (async () => {
    const t = new URLSearchParams(location.search).get("t") || "";
    const { createClient, AnamEvent } = await import("@anam-ai/js-sdk");
    c = createClient(t);
    c.addListener(AnamEvent.VIDEO_PLAY_STARTED, () => setLog((l) => [...l, "live"]));
    c.addListener(AnamEvent.MESSAGE_HISTORY_UPDATED, (m: any) => setLog((l) => [...l, "history:" + JSON.stringify(m.map((x: any) => [x.role, x.content]))]));
    (window as any).__anam = c;
    await c.streamToVideoElement("v");
  })().catch((e) => setLog((l) => [...l, "err:" + e.message])); return () => { void c?.stopStreaming(); }; }, []);
  return <div><video id="v" autoPlay playsInline muted /><pre id="log">{log.join("\n")}</pre></div>;
}
export const Route = createFileRoute("/zz-video-test")({ component: P });
