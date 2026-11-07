/**
 * @doc Realtime voice call over Cartesia WebSockets.
 * Mic PCM streams to Cartesia STT, a streamed reply from /api/voice-call is spoken through
 * Cartesia TTS with continuations, and nothing is written to the chat conversation.
 */
import { supabase } from "@/integrations/supabase/client";
import { createSpeechDetector } from "./speechDetector";
import { speechText } from "./voiceSchema";
import { sharedAudioContext } from "./voiceClient";

export type CallPhase = "connecting" | "listening" | "thinking" | "speaking";
export type CallTurn = { role: "user" | "assistant"; text: string };

export interface RealtimeCallOptions {
  voiceId: string;
  language: string;
  agentName: string;
  agentPrompt: string;
  /** Set when the bot placed the call: it speaks first and explains why. */
  reason?: string;
  onPhase: (phase: CallPhase) => void;
  onError: (message: string) => void;
}

export interface RealtimeCall { setMuted: (muted: boolean) => void; interrupt: () => void; end: () => void; resumeAudio: () => Promise<boolean> }

const VERSION = "2026-08-14";
const STT_RATE = 16000;
const TTS_RATE = 24000;

async function bearer() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Please sign in");
  return data.session.access_token;
}

async function callApi(body: unknown, signal?: AbortSignal) {
  const response = await fetch("/api/voice-call", {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await bearer()}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const j = await response.json().catch(() => ({}));
    throw new Error(j.error || "Voice service unavailable");
  }
  return response;
}

/** Splits streamed text into speakable pieces as soon as a sentence (or a long clause) is complete. */
export function takeSpeakable(buffer: string, final = false): { pieces: string[]; rest: string } {
  const pieces: string[] = [];
  let rest = buffer;
  for (;;) {
    const m = rest.match(/^[\s\S]*?[.!?؟…\n]+(\s|$)/);
    if (m && m[0].trim()) { pieces.push(m[0]); rest = rest.slice(m[0].length); continue; }
    if (rest.length > 140) {
      const cut = Math.max(rest.lastIndexOf("،", 140), rest.lastIndexOf(",", 140), rest.lastIndexOf(" ", 140));
      if (cut > 20) { pieces.push(rest.slice(0, cut + 1)); rest = rest.slice(cut + 1); continue; }
    }
    break;
  }
  if (final && rest.trim()) { pieces.push(rest); rest = ""; }
  return { pieces, rest };
}

function downsample(input: Float32Array, fromRate: number): Int16Array<ArrayBuffer> {
  const ratio = fromRate / STT_RATE;
  const length = Math.floor(input.length / ratio);
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio), end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0; for (let j = start; j < end; j++) sum += input[j];
    const v = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

function decodeFloat32(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer, 0, Math.floor(bytes.length / 4));
}

export async function startRealtimeCall(opts: RealtimeCallOptions): Promise<RealtimeCall> {
  const ctx = sharedAudioContext();
  if (!ctx) throw new Error("Audio is unavailable in this browser.");
  // resume() never settles without a user gesture on some mobile browsers: never block the call on it.
  void ctx.resume().catch(() => {});
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone is unavailable in this browser.");

  let ended = false, muted = false;
  let phase: CallPhase = "connecting";
  const history: CallTurn[] = [];
  const setPhase = (p: CallPhase) => { phase = p; if (!ended) opts.onPhase(p); };
  const fail = (m: string) => { if (!ended) opts.onError(m); };

  let token = "", tokenAt = 0;
  // The server picks the language from what the user actually writes (UI may be English while they speak Arabic).
  let lang = opts.language.slice(0, 2).toLowerCase();
  if (!/^[a-z]{2}$/.test(lang)) lang = "";
  const freshToken = async () => {
    if (!token || Date.now() - tokenAt > 600_000) {
      const j = await (await callApi({ action: "token", language: lang })).json() as { token: string; language?: string };
      token = j.token; tokenAt = Date.now();
      if (j.language && /^[a-z]{2}$/.test(j.language)) lang = j.language;
    }
    return token;
  };

  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  await freshToken().catch((e) => { stream.getTracks().forEach((t) => t.stop()); throw e; });

  // ---- STT socket ----
  let stt: WebSocket | null = null;
  let finals: string[] = [];
  let flushWaiter: (() => void) | null = null;
  const openStt = async () => {
    if (stt && (stt.readyState === WebSocket.OPEN || stt.readyState === WebSocket.CONNECTING)) return stt;
    const url = new URL("wss://api.cartesia.ai/stt/websocket");
    url.searchParams.set("model", "ink-whisper");
    url.searchParams.set("language", lang || "en");
    url.searchParams.set("encoding", "pcm_s16le");
    url.searchParams.set("sample_rate", String(STT_RATE));
    url.searchParams.set("cartesia_version", VERSION);
    url.searchParams.set("access_token", await freshToken());
    const ws = new WebSocket(url); ws.binaryType = "arraybuffer";
    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      try {
        const msg = JSON.parse(ev.data) as { type?: string; is_final?: boolean; text?: string; message?: string };
        if (msg.type === "transcript" && msg.text?.trim()) {
          lastHeardAt = performance.now();
          if (msg.is_final) { finals.push(msg.text.trim()); scheduleTurnEnd(); }
        }
        else if (msg.type === "flush_done") { flushWaiter?.(); flushWaiter = null; }
        else if (msg.type === "error") fail(msg.message || "Speech recognition error");
      } catch { /* ignore */ }
    };
    ws.onclose = () => { if (stt === ws) stt = null; flushWaiter?.(); flushWaiter = null; };
    stt = ws;
    return ws;
  };

  // ---- TTS socket + playback ----
  let tts: WebSocket | null = null;
  let contextId = "";
  let nextTime = 0;
  const sources = new Set<AudioBufferSourceNode>();
  let ttsDone = true;
  let replyAbort: AbortController | null = null;
  const maybeFinishSpeaking = () => {
    if (ended || !ttsDone || sources.size || phase !== "speaking") return;
    startListening();
  };
  const openTts = async () => {
    if (tts && tts.readyState === WebSocket.OPEN) return tts;
    if (tts && tts.readyState === WebSocket.CONNECTING) {
      const pending = tts;
      await new Promise<void>((res, rej) => { pending.addEventListener("open", () => res(), { once: true }); pending.addEventListener("error", () => rej(new Error("Voice connection failed")), { once: true }); });
      return pending;
    }
    const url = new URL("wss://api.cartesia.ai/tts/websocket");
    url.searchParams.set("cartesia_version", VERSION);
    url.searchParams.set("access_token", await freshToken());
    const ws = new WebSocket(url);
    tts = ws;
    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      try {
        const msg = JSON.parse(ev.data) as { type?: string; data?: string; context_id?: string; message?: string };
        if (msg.context_id && msg.context_id !== contextId) return;
        if (msg.type === "chunk" && msg.data) {
          const samples = decodeFloat32(msg.data);
          if (!samples.length) return;
          const buffer = ctx.createBuffer(1, samples.length, TTS_RATE);
          buffer.copyToChannel(samples, 0);
          const src = ctx.createBufferSource(); src.buffer = buffer; src.connect(ctx.destination);
          const at = Math.max(ctx.currentTime + 0.02, nextTime);
          src.start(at); nextTime = at + buffer.duration;
          sources.add(src);
          src.onended = () => { sources.delete(src); maybeFinishSpeaking(); };
          if (phase !== "speaking") setPhase("speaking");
        } else if (msg.type === "done") { ttsDone = true; maybeFinishSpeaking(); }
        else if (msg.type === "error") { ttsDone = true; fail(msg.message || "Voice generation error"); maybeFinishSpeaking(); if (!sources.size) startListening(); }
      } catch { /* ignore */ }
    };
    ws.onclose = () => { if (tts === ws) tts = null; if (!ttsDone) { ttsDone = true; maybeFinishSpeaking(); } };
    await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = () => rej(new Error("Voice connection failed")); });
    return ws;
  };
  const stopPlayback = () => {
    for (const s of sources) { try { s.onended = null; s.stop(); } catch { /* already stopped */ } }
    sources.clear(); nextTime = 0;
    if (contextId && tts?.readyState === WebSocket.OPEN) tts.send(JSON.stringify({ context_id: contextId, cancel: true }));
    contextId = ""; ttsDone = true;
  };

  // ---- turn handling ----
  let detector = createSpeechDetector({ noSpeechMs: 1e12, silenceMs: 750, minSpeechMs: 180 });
  let turnStart = 0;
  let pending: Int16Array<ArrayBuffer>[] = [];
  // Cartesia sends a final transcript when it hears a pause; answer shortly after unless more speech arrives.
  let turnTimer: ReturnType<typeof setTimeout> | null = null;
  let lastHeardAt = 0;
  const scheduleTurnEnd = () => {
    if (turnTimer) clearTimeout(turnTimer);
    turnTimer = setTimeout(() => {
      turnTimer = null;
      if (ended || phase !== "listening" || !finals.length) return;
      void finishTurn(false);
    }, 700);
  };
  const startListening = () => {
    if (ended) return;
    if (turnTimer) { clearTimeout(turnTimer); turnTimer = null; }
    finals = []; pending = [];
    detector = createSpeechDetector({ noSpeechMs: 1e12, silenceMs: 750, minSpeechMs: 180 });
    turnStart = performance.now();
    setPhase("listening");
    void openStt().catch((e) => fail(e.message));
  };

  const respond = async (userText: string) => {
    if (userText) history.push({ role: "user", text: userText });
    setPhase("thinking");
    const controller = new AbortController(); replyAbort = controller;
    const id = crypto.randomUUID(); contextId = id; ttsDone = false; nextTime = 0;
    let said = "", buffer = "", sentAny = false;
    const speak = async (text: string, last: boolean) => {
      const clean = speechText(text);
      if (!clean && !last) return;
      const ws = await openTts();
      if (contextId !== id) return;
      ws.send(JSON.stringify({
        model_id: "sonic-3.6", transcript: clean ? `${clean} ` : "", voice: { mode: "id", id: opts.voiceId }, language: lang || "en",
        context_id: id, output_format: { container: "raw", encoding: "pcm_f32le", sample_rate: TTS_RATE }, continue: !last,
      }));
      if (clean) sentAny = true;
    };
    try {
      const response = await callApi({ action: "reply", agentName: opts.agentName, agentPrompt: opts.agentPrompt.slice(0, 6000), language: lang || opts.language, reason: opts.reason || "", history: history.slice(-20) }, controller.signal);
      const reader = response.body!.getReader(); const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        let chunk = decoder.decode(value, { stream: true });
        const errAt = chunk.indexOf("\u0000");
        if (errAt >= 0) { fail(chunk.slice(errAt + 1) || "Reply failed"); chunk = chunk.slice(0, errAt); }
        said += chunk; buffer += chunk;
        const { pieces, rest } = takeSpeakable(buffer); buffer = rest;
        for (const p of pieces) await speak(p, false);
      }
      const { pieces } = takeSpeakable(buffer, true);
      for (const p of pieces) await speak(p, false);
      if (said.trim()) history.push({ role: "assistant", text: said.trim() });
      if (contextId === id) {
        if (sentAny) await speak("", true);
        else { ttsDone = true; startListening(); }
      }
    } catch (e) {
      if (controller.signal.aborted || ended) return;
      if (said.trim()) history.push({ role: "assistant", text: said.trim() });
      stopPlayback(); fail(e instanceof Error ? e.message : "Reply failed"); startListening();
    } finally { if (replyAbort === controller) replyAbort = null; }
  };

  const finishTurn = async (flush = true) => {
    if (phase !== "listening") return;
    if (turnTimer) { clearTimeout(turnTimer); turnTimer = null; }
    setPhase("thinking");
    const ws = stt;
    if (flush && ws?.readyState === WebSocket.OPEN) {
      await new Promise<void>((res) => { flushWaiter = res; ws.send("finalize"); setTimeout(res, 3500); });
    }
    const text = finals.join(" ").trim(); finals = [];
    if (ended) return;
    if (!text) { startListening(); return; }
    void respond(text);
  };

  // ---- microphone pipeline ----
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const sink = ctx.createGain(); sink.gain.value = 0;
  source.connect(processor); processor.connect(sink); sink.connect(ctx.destination);
  processor.onaudioprocess = (ev) => {
    if (ended || muted || phase !== "listening") return;
    const input = ev.inputBuffer.getChannelData(0);
    let sum = 0; for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
    const db = 20 * Math.log10(Math.sqrt(sum / input.length) || 1e-8);
    const pcm = downsample(input, ctx.sampleRate);
    const ws = stt;
    if (ws?.readyState === WebSocket.OPEN) {
      for (const p of pending) ws.send(p); pending = [];
      ws.send(pcm);
    } else { pending.push(pcm); if (pending.length > 40) pending.shift(); if (!ws) void openStt().catch(() => {}); }
    const step = detector.push(db, performance.now() - turnStart);
    // Backups: our own silence detector, or a final transcript left unanswered for 2.5s.
    if (step.stop && step.heard) void finishTurn();
    else if (finals.length && performance.now() - lastHeardAt > 2500) void finishTurn(false);
  };

  if (opts.reason) void respond(""); else startListening();

  return {
    async resumeAudio() { await ctx.resume().catch(() => {}); return ctx.state === "running"; },
    setMuted(next) {
      muted = next;
      if (!next && phase === "listening") startListening();
    },
    interrupt() {
      replyAbort?.abort(); replyAbort = null;
      stopPlayback(); startListening();
    },
    end() {
      if (ended) return; ended = true;
      replyAbort?.abort(); stopPlayback();
      if (turnTimer) clearTimeout(turnTimer);
      processor.onaudioprocess = null;
      try { source.disconnect(); processor.disconnect(); sink.disconnect(); } catch { /* already gone */ }
      stream.getTracks().forEach((t) => t.stop());
      try { stt?.readyState === WebSocket.OPEN && stt.send("close"); stt?.close(); } catch { /* ignore */ }
      try { tts?.close(); } catch { /* ignore */ }
      stt = null; tts = null;
    },
  };
}
