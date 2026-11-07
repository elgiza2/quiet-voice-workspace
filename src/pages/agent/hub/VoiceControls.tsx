import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSpeech, getVoices } from "@/lib/audio/voiceClient";
import { speechText, type Voice } from "@/lib/audio/voiceSchema";
import { resolveLanguage, resolveVoice, voicesForLanguage, type AgentVoiceSettings } from "@/lib/audio/agentVoice";
import { ChoiceList } from "@/components/ui/choice-list";
import { agentApi } from "@/lib/agentsky/client";
import { cachedRecording, cacheRecording } from "@/lib/audio/recordingCache";
import { VoiceMessagePlayer } from "./VoiceMessagePlayer";

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
  const ar = typeof navigator !== "undefined" && (localStorage.getItem("ceyo_language") || navigator.language).startsWith("ar");
  const language = resolveLanguage(value.language, typeof navigator !== "undefined" ? localStorage.getItem("ceyo_language") || navigator.language : "en");
  const visibleVoices = voicesForLanguage(voices, language);
  return <div className="cx-voice-settings">
    <label>{ar ? "اللغة" : "Language"}<ChoiceList label="Voice language" value={value.language} onChange={language => onChange({ ...value, language, voice: "Not set" })} options={[{ value: "Auto", label: ar ? "تلقائي" : "Automatic" }, ...languages.map(l => ({ value: l, label: l === "ar" ? "العربية" : new Intl.DisplayNames([ar ? "ar" : "en"], { type: "language" }).of(l) || l }))]} /></label>
    <label>{ar ? "الصوت" : "Voice"}<ChoiceList label="Cartesia voice" value={visibleVoices.some(v => v.id === value.voice) ? value.voice : "Not set"} onChange={voice => onChange({ ...value, voice })} options={[{ value: "Not set", label: ar ? "تلقائي" : "Automatic" }, ...visibleVoices.map(v => ({ value: v.id, label: v.name }))]} /></label>
    {!error && voices.length > 0 && visibleVoices.length === 0 && <span role="status">{ar ? "لا توجد أصوات متاحة لهذه اللغة" : "No voices available for this language"}</span>}
    {error && <><span role="alert">{error}</span><Button variant="ghost" size="icon" aria-label="Retry voice catalogue" onClick={() => setRetry((n) => n + 1)}><RotateCcw size={16} /></Button></>}
  </div>;
}

export function VoiceMessage(props: {
  text: string; recordingId: string; agentId: string; agentIds: string[]; settings: AgentVoiceSettings; ar: boolean; own?: boolean;
}) {
  if (props.own) return <VoiceMessagePlayer {...props} own />;
  return <AgentVoiceMessage {...props} />;
}
function AgentVoiceMessage({ text, recordingId, agentId, agentIds, settings, ar }: {
  text: string; recordingId: string; agentId: string; agentIds: string[]; settings: AgentVoiceSettings; ar: boolean;
}) {
  const choice = useVoiceChoice(ar ? "ar" : "en", agentId, agentIds, settings);
  return <VoiceMessagePlayer text={text} recordingId={recordingId} agentId={agentId} ar={ar} own={false} voiceId={choice.voiceId} language={choice.language} catalogueError={choice.error || (choice.voices.length && !choice.voiceId ? (ar ? "لا يوجد صوت متاح للغة دي" : "No voice available for this language") : "")} reload={choice.reload} />;
}
