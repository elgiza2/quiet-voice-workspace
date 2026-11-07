import type { RecordingOrigin } from "@/lib/audio/agentVoice";
/** @doc Live AgentSky session: history + SSE stream, running state, stop, and a send queue
 *  that lets the user type while the agent works (queued messages go out when it finishes). */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { agentApi, onSessionChanged, openStream, type AgentRequest, type RawEvent } from "@/lib/agentsky/client";
import { buildTranscript, type Lang } from "@/lib/agentsky/transcript";

export type Queued = { id: string; text: string; images: string[] };

export function useAgentSession(sessionId: string | null, lang: Lang) {
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [requests, setRequests] = useState<AgentRequest[]>([]);
  const [stopping, setStopping] = useState(false);
  const seen = useRef(new Set<string>());
  const sidRef = useRef(sessionId);
  sidRef.current = sessionId;

  const reload = useCallback(async (sid: string) => {
    const r = await agentApi.events(sid);
    if (sidRef.current !== sid) return;
    setEvents((previous) => {
      const ids = new Set(r.events.map((e) => e.id));
      // A history request can finish before a just-sent message is persisted.
      const retained = previous.filter((e) => e.type === "user.message" && !ids.has(e.id));
      // While running, never replace the live stream with an older database snapshot.
      // Once idle, the database snapshot is final: previous live events carry different
      // ids than their persisted copies, so keeping them would replay the whole reply.
      const next = r.status === "running" && previous.length ? [...previous, ...r.events.filter((e) => !previous.some((p) => p.id === e.id))] : [...r.events, ...retained];
      seen.current = new Set(next.map((e) => e.id));
      return next;
    });
    setRunning(r.status === "running");
  }, []);

  const loadRequests = useCallback(async (sid: string) => {
    try {
      const r = await agentApi.requests(sid);
      if (sidRef.current === sid) setRequests(r.requests);
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    setEvents([]);
    setRunning(false);
    setQueue([]);
    setRequests([]);
    setError(null);
    seen.current = new Set();
    setLoading(false);
    if (!sessionId) return;
    const sid = sessionId;
    const ctl = new AbortController();
    let retry = 0;
    setLoading(true);
    reload(sid)
      .catch((e) => { if (!ctl.signal.aborted) setError(e.message); })
      .finally(() => { if (!ctl.signal.aborted) setLoading(false); });
    void loadRequests(sid);

    const loop = async () => {
      while (!ctl.signal.aborted) {
        try {
          await openStream(
            sid,
            (e) => {
              retry = 0;
              if (!e.id || seen.current.has(e.id)) return;
              if (e.type === "session.status_running") setRunning(true);
              if (e.type === "session.error") setError(typeof (e as any).message === "string" ? (e as any).message : "The agent could not reply. Your message is saved.");
              if (e.type === "session.status_idle" || e.type === "session.error") {
                setRunning(false);
                setStopping(false);
                setTimeout(() => {
                  void reload(sid).catch(() => {});
                  void loadRequests(sid);
                }, 600);
              }
              seen.current.add(e.id);
              setEvents((prev) => [...prev, e]);
            },
            ctl.signal,
          );
        } catch {
          if (ctl.signal.aborted) return;
        }
        retry++;
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** retry, 15000)));
        if (!ctl.signal.aborted) await reload(sid).catch(() => {});
      }
    };
    void loop();
    return () => ctl.abort();
  }, [sessionId, reload, loadRequests]);

  // A background job finished for this chat: show its result.
  useEffect(() => onSessionChanged((sid) => { if (sid === sidRef.current) void reload(sid).catch(() => {}); }), [reload]);
  useEffect(() => {
    const refresh = () => { const sid = sidRef.current; if (sid) void reload(sid).catch(() => {}); };
    window.addEventListener("ceyo-action-completed", refresh);
    return () => window.removeEventListener("ceyo-action-completed", refresh);
  }, [reload]);

  const sendNow = useCallback(async (text: string, images: string[] = [], origin: RecordingOrigin = {}) => {
    const sid = sidRef.current;
    if (!sid) return;
    const optimistic: RawEvent = {
      id: crypto.randomUUID(), type: "user.message", ...origin, at: new Date().toISOString(),
      content: [{ type: "text", text }, ...images.map((url) => ({ type: "image", source: { type: "url", url } }))],
    };
    seen.current.add(optimistic.id);
    setEvents((previous) => [...previous, optimistic]);
    setError(null);
    setRunning(true);
    try {
      const saved = await agentApi.send(sid, text, images, optimistic.id, origin);
      if (sidRef.current !== sid) return;
      seen.current.delete(optimistic.id);
      seen.current.add(saved.id);
      setEvents((previous) => previous.flatMap((event) => {
        if (event.id === optimistic.id) return [{ ...saved, id: optimistic.id }];
        if (event.id === saved.id) return [];
        return [event];
      }));
    } catch (e: any) {
      if (sidRef.current !== sid) return;
      seen.current.delete(optimistic.id);
      setEvents((previous) => previous.filter((event) => event.id !== optimistic.id));
      setRunning(false);
      setError(e.message);
    }
  }, []);

  /** While running, messages wait in the queue and go out automatically when the agent finishes. */
  const send = useCallback(
    (text: string, images: string[] = [], origin: RecordingOrigin = {}) => {
      // Messages sent while the bot works go straight in and steer the same run.
      void sendNow(text, images, origin);
    },
    [sendNow],
  );

  useEffect(() => {
    if (running || stopping || !queue.length) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    void sendNow(next.text, next.images);
  }, [running, stopping, queue, sendNow]);

  const stop = useCallback(async () => {
    const sid = sidRef.current;
    if (!sid) return;
    setStopping(true);
    try {
      await agentApi.interrupt(sid);
    } catch (e: any) {
      setError(e.message);
    }
    // the idle event clears running; fall back if it never arrives
    setTimeout(() => {
      setStopping(false);
      setRunning(false);
    }, 8000);
  }, []);

  const unqueue = (id: string) => setQueue((q) => q.filter((x) => x.id !== id));

  const turns = useMemo(() => buildTranscript(events, lang, running), [events, lang, running]);

  return { turns, running, loading, error, queue, unqueue, send, stop, stopping, requests, setRequests };
}
