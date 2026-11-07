import { supabase } from "@/integrations/supabase/client";
import type { Voice } from "./voiceSchema";
import { createSpeechDetector } from "./speechDetector";

async function voiceFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Please sign in");
  const response = await fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${data.session.access_token}` } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Voice service unavailable");
  }
  return response;
}

let catalogue: Promise<Voice[]> | undefined;
export function getVoices() {
  if (!catalogue) catalogue = voiceFetch("/api/voice").then((r) => r.json()).then((d) => d.voices as Voice[]).catch((error) => { catalogue = undefined; throw error; });
  return catalogue;
}

export async function getSpeech(text: string, voiceId: string, language: string, signal?: AbortSignal) {
  return (await voiceFetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voiceId, language }), signal })).blob();
}

export async function transcribeRecording(file: Blob, language: string, signal?: AbortSignal) {
  const form = new FormData();
  form.append("file", file, file.type.includes("mp4") ? "recording.mp4" : file.type.includes("wav") ? "recording.wav" : "recording.webm"); form.append("language", language);
  const body = await (await voiceFetch("/api/voice-transcribe", { method: "POST", body: form, signal })).json();
  if (!body.text?.trim()) throw new Error("No speech detected. Try recording again.");
  return String(body.text);
}

// Mobile browsers and in-app webviews only allow audio analysis and playback that a tap unlocked.
let context: AudioContext | undefined;
let callPlayer: HTMLAudioElement | undefined;
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
function audioContext() {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return undefined;
  if (!context || context.state === "closed") context = new Ctor();
  return context;
}
export function callAudioElement() {
  if (!callPlayer) { callPlayer = new Audio(); callPlayer.preload = "auto"; callPlayer.setAttribute("playsinline", ""); }
  return callPlayer;
}
/** Call from a tap handler before a call starts. */
export function unlockCallAudio() {
  try { void audioContext()?.resume(); } catch { /* analysis falls back to the time limit */ }
  try { const player = callAudioElement(); player.src = SILENCE; void player.play().catch(() => {}); } catch { /* playback asks for a tap later */ }
}

export type Recording = { stop: () => void; result: Promise<Blob>; heard: () => boolean; detecting: boolean };

export async function microphoneRecording(options: { autoStop?: boolean; noSpeechMs?: number } = {}): Promise<Recording> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Microphone recording is unavailable in this browser.");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  try {
    const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const parts: Blob[] = [];
    let heard = !options.autoStop;
    let poll: ReturnType<typeof setInterval> | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    const release = () => { clearTimeout(timer); clearInterval(poll); source?.disconnect(); stream.getTracks().forEach((t) => t.stop()); };
    let timer: ReturnType<typeof setTimeout>;
    const result = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => { if (event.data.size) parts.push(event.data); };
      recorder.onerror = () => { release(); reject(new Error("Recording failed")); };
      recorder.onstop = () => { release(); resolve(new Blob(parts, { type: recorder.mimeType })); };
    });
    recorder.start(250);
    const stop = () => { if (recorder.state !== "inactive") recorder.stop(); };
    let detecting = false;
    if (options.autoStop) {
      const ctx = audioContext();
      if (ctx) {
        await ctx.resume().catch(() => {});
        if (ctx.state === "running") {
          detecting = true;
          source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser(); analyser.fftSize = 1024; source.connect(analyser);
          const samples = new Float32Array(analyser.fftSize);
          const detector = createSpeechDetector({ noSpeechMs: options.noSpeechMs ?? 15_000 });
          const started = performance.now();
          poll = setInterval(() => {
            analyser.getFloatTimeDomainData(samples);
            let sum = 0; for (const v of samples) sum += v * v;
            const db = 20 * Math.log10(Math.sqrt(sum / samples.length) || 1e-8);
            const step = detector.push(db, performance.now() - started);
            if (step.heard) heard = true;
            if (step.stop) stop();
          }, 60);
        }
      }
    }
    // Without live analysis the call still sends a bounded turn instead of waiting forever.
    timer = setTimeout(() => { heard = true; stop(); }, options.autoStop && !detecting ? 8_000 : 60_000);
    return { stop: () => { heard = true; stop(); }, result, heard: () => heard, detecting };
  } catch (error) { stream.getTracks().forEach((t) => t.stop()); throw error; }
}
