import { useEffect, useRef, useState } from "react";
import { Download, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSpeech, getVoices } from "@/lib/audio/voiceClient";
import { speechText, type Voice } from "@/lib/audio/voiceSchema";
import { resolveVoice, type AgentVoiceSettings } from "@/lib/audio/agentVoice";
import { agentApi } from "@/lib/agentsky/client";
import { cachedRecording, cacheRecording } from "@/lib/audio/recordingCache";

let assignmentPromise: Promise<Record<string, string>> | undefined;

export function useVoiceChoice(defaultLanguage: string, agentId: string, agentIds: string[], settings: AgentVoiceSettings) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [userLanguage, setUserLanguage] = useState(defaultLanguage);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => { try { setUserLanguage(localStorage.getItem("ceyo_language")?.replace(/^system$/, "") || navigator.language || defaultLanguage); } catch { setUserLanguage(defaultLanguage); } };
    read(); window.addEventListener("ceyo:language", read);
    let active = true;
    setError("");
    getVoices().then(async (list) => {
      if (active) setVoices(list);
      if (!assignmentPromise) assignmentPromise = agentApi.ensureVoiceAssignments(list).finally(() => { assignmentPromise = undefined; });
      const saved = await assignmentPromise;
      if (active) { setAssignments(saved); setError(""); }
    }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; window.removeEventListener("ceyo:language", read); };
  }, [defaultLanguage, retry, agentId]);
  return { voices, ...resolveVoice(voices, agentId, agentIds, { ...settings, autoVoiceId: assignments[agentId] || settings.autoVoiceId }, userLanguage), error, reload: () => setRetry((n) => n + 1) };
}

export function VoiceSettingsFields({ value, onChange }: { value: AgentVoiceSettings; onChange: (value: AgentVoiceSettings) => void }) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; setError(""); getVoices().then((v) => { if (active) { setVoices(v); setError(""); } }).catch((e) => { if (active) setError(e.message); }); return () => { active = false; }; }, [retry]);
  const languages = [...new Set(["ar", "en", ...voices.map((v) => v.language)])].sort();
  return <div className="cx-voice-settings">
    <label>Language<select aria-label="Voice language" value={value.language} onChange={(e) => onChange({ ...value, language: e.target.value })}>
      <option value="Auto">Auto</option>{languages.map((l) => <option key={l} value={l}>{l === "ar" ? "العربية" : new Intl.DisplayNames(["en"], { type: "language" }).of(l) || l}</option>)}
    </select></label>
    <label>Voice<select aria-label="Cartesia voice" value={voices.some((v) => v.id === value.voice) ? value.voice : "Not set"} onChange={(e) => onChange({ ...value, voice: e.target.value })}>
      <option value="Not set">Auto</option>{voices.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.language}</option>)}
    </select></label>
    {error && <><span role="alert">{error}</span><Button variant="ghost" size="icon" aria-label="Retry voice catalogue" onClick={() => setRetry((n) => n + 1)}><RotateCcw size={16} /></Button></>}
  </div>;
}

export function VoiceMessage({ text, recordingId, agentId, agentIds, settings, ar, own = false }: {
  text: string; recordingId: string; agentId: string; agentIds: string[]; settings: AgentVoiceSettings; ar: boolean; own?: boolean;
}) {
  const choice = useVoiceChoice(ar ? "ar" : "en", agentId, agentIds, settings);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const currentUrl = useRef("");
  useEffect(() => {
    if (!own && !choice.voiceId) return;
    const controller = new AbortController();
    setLoading(true); setUrl(""); setError("");
    void (async () => {
      try {
        const key = own ? recordingId : `${recordingId}:${agentId}:${choice.voiceId}:${choice.language}`;
        let blob = await cachedRecording(key).catch(() => undefined);
        if (!blob) {
          if (own) throw new Error(ar ? "التسجيل متاح على جهاز الإرسال فقط" : "Recording is available on the sending device only");
          blob = await getSpeech(speechText(text), choice.voiceId, choice.language, controller.signal);
          await cacheRecording(key, blob).catch(() => {});
        }
        if (controller.signal.aborted) return;
        const next = URL.createObjectURL(blob); currentUrl.current = next; setUrl(next);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Audio unavailable"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => { controller.abort(); if (currentUrl.current) URL.revokeObjectURL(currentUrl.current); currentUrl.current = ""; };
  }, [recordingId, agentId, choice.voiceId, choice.language, text, own, retry, ar]);
  return <div className="cx-voice-message">
    {loading && !error && !choice.error && <Loader2 size={18} className="animate-spin" />}
    {url && <><audio controls preload="metadata" src={url} aria-label={own ? "Voice recording" : "Voice reply"} /><a href={url} download="voice-message.wav" aria-label={ar ? "تنزيل الريكورد" : "Download recording"}><Download size={16} /></a></>}
    {(error || choice.error) && <><span role="alert">{error || choice.error}</span>{!own && <Button size="icon" variant="ghost" aria-label="Retry voice reply" onClick={() => { choice.reload(); setRetry((n) => n + 1); }}><RotateCcw size={16} /></Button>}<details><summary>{ar ? "النص" : "Transcript"}</summary>{text}</details></>}
  </div>;
}
