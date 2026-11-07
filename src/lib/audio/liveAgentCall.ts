/**
 * @doc Live voice call over the Deepgram Voice Agent (speech-to-speech, barge-in).
 * The server returns a short-lived token and the full Settings; mic PCM streams in, agent PCM
 * plays out. Nothing is written to the chat conversation.
 */
import { supabase } from "@/integrations/supabase/client";
import { sharedAudioContext } from "./voiceClient";
import { createPcmResampler } from "./callInput";
import type { RealtimeCall, RealtimeCallOptions } from "./realtimeCall";

const OUT_RATE = 24000;

export async function startLiveAgentCall(opts: RealtimeCallOptions): Promise<RealtimeCall> {
  const ctx = sharedAudioContext();
  if (!ctx) throw new Error("Audio is unavailable in this browser.");
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone is unavailable in this browser.");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Please sign in");

  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  let res: Response;
  try {
    res = await fetch("/api/voice-call", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ action: "agent", agentName: opts.agentName, agentPrompt: opts.agentPrompt, reason: opts.reason || "", voiceId: opts.voiceId, language: opts.language }),
    });
  } catch (e) { stream.getTracks().forEach((t) => t.stop()); throw e; }
  const j = await res.json().catch(() => ({})) as { token?: string; settings?: unknown; error?: string };
  if (!res.ok || !j.token) { stream.getTracks().forEach((t) => t.stop()); throw new Error(j.error || "Voice service unavailable"); }

  let ended = false, muted = false, ready = false, dropAudio = false;
  const phase = (p: Parameters<RealtimeCallOptions["onPhase"]>[0]) => { if (!ended) opts.onPhase(p); };
  opts.onPhase("connecting");

  // ---- playback ----
  let nextTime = 0;
  const sources = new Set<AudioBufferSourceNode>();
  const stopPlayback = () => {
    for (const s of sources) { try { s.onended = null; s.stop(); } catch { /* stopped */ } }
    sources.clear(); nextTime = 0;
  };
  const play = (buf: ArrayBuffer) => {
    const pcm = new Int16Array(buf, 0, Math.floor(buf.byteLength / 2));
    if (!pcm.length) return;
    const f = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768;
    const b = ctx.createBuffer(1, f.length, OUT_RATE); b.copyToChannel(f, 0);
    const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination);
    const at = Math.max(ctx.currentTime + 0.03, nextTime);
    src.start(at); nextTime = at + b.duration; sources.add(src);
    src.onended = () => { sources.delete(src); if (!sources.size && !ended) phase("listening"); };
    phase("speaking");
  };

  // ---- socket ----
  const ws = new WebSocket("wss://agent.deepgram.com/v1/agent/converse", ["bearer", j.token]);
  ws.binaryType = "arraybuffer";
  const keepAlive = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "KeepAlive" })); }, 8000);
  ws.onopen = () => ws.send(JSON.stringify(j.settings));
  ws.onmessage = (ev) => {
    if (ended) return;
    if (typeof ev.data !== "string") { if (!dropAudio) play(ev.data as ArrayBuffer); return; }
    let msg: { type?: string; description?: string; role?: string; content?: string };
    try { msg = JSON.parse(ev.data); } catch { return; }
    switch (msg.type) {
      case "ConversationText":
        if ((msg.role === "user" || msg.role === "assistant") && msg.content?.trim() && !msg.content.startsWith("(I just")) opts.onTurn?.({ role: msg.role, text: msg.content });
        break;
      case "SettingsApplied":
        ready = true; phase("listening");
        ws.send(JSON.stringify({ type: "InjectUserMessage", content: opts.reason ? "(I just answered your call.)" : "(I just called you. Greet me.)" }));
        break;
      case "UserStartedSpeaking": dropAudio = false; stopPlayback(); phase("listening"); break;
      case "AgentThinking": phase("thinking"); break;
      case "AgentStartedSpeaking": dropAudio = false; break;
      case "Error": opts.onError(msg.description || "Voice agent error"); break;
    }
  };
  ws.onclose = (e) => { if (!ended) opts.onError(e.code === 1008 || e.code === 4001 ? "Voice service refused the call." : "Call connection dropped. Try again."); };

  // ---- mic ----
  const source = ctx.createMediaStreamSource(stream);
  const resampler = createPcmResampler(ctx.sampleRate, 16000);
  const processor = ctx.createScriptProcessor(2048, 1, 1);
  const sink = ctx.createGain(); sink.gain.value = 0;
  source.connect(processor); processor.connect(sink); sink.connect(ctx.destination);
  processor.onaudioprocess = (ev) => {
    if (ended || !ready || ws.readyState !== WebSocket.OPEN) return;
    const pcm = resampler.push(muted ? new Float32Array(ev.inputBuffer.length) : ev.inputBuffer.getChannelData(0));
    if (pcm.length) ws.send(pcm.buffer);
  };

  return {
    async resumeAudio() { await ctx.resume().catch(() => {}); return ctx.state === "running"; },
    setMuted(next) { muted = next; },
    interrupt() { dropAudio = true; stopPlayback(); phase("listening"); },
    end() {
      if (ended) return; ended = true;
      clearInterval(keepAlive); stopPlayback();
      processor.onaudioprocess = null;
      try { source.disconnect(); processor.disconnect(); sink.disconnect(); } catch { /* gone */ }
      stream.getTracks().forEach((t) => t.stop());
      try { ws.close(); } catch { /* closed */ }
    },
  };
}
