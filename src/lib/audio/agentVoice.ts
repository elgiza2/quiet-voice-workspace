import type { Voice } from "./voiceSchema";

export type AgentVoiceSettings = { voice: string; language: string; speed: number; autoVoiceId?: string };
export type RecordingOrigin = { voiceOrigin?: "recording"; recordingId?: string };

export function resolveLanguage(setting: string, userLanguage: string) {
  const aliases: Record<string, string> = { English: "en", "العربية": "ar", Español: "es", Français: "fr", Deutsch: "de" };
  const raw = !setting || setting === "Auto" ? userLanguage : aliases[setting] || setting;
  return raw.toLowerCase().split(/[-_]/)[0] || "en";
}

export function assignAgentVoices(voices: Voice[], agentIds: string[], existing: Record<string, string> = {}) {
  const sorted = [...voices].sort((a, b) => a.id.localeCompare(b.id));
  const ids = [...new Set(agentIds)].sort();
  const assigned: Record<string, string> = { ...existing };
  const used = new Set(Object.values(existing));
  for (const id of ids) {
    if (assigned[id]) continue;
    let hash = 0;
    for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    if (!sorted.length) break;
    let index = hash % sorted.length;
    for (let n = 0; n < sorted.length && used.has(sorted[index].id); n++) index = (index + 1) % sorted.length;
    assigned[id] = sorted[index].id;
    used.add(sorted[index].id);
  }
  return assigned;
}

export function resolveVoice(voices: Voice[], agentId: string, agentIds: string[], settings: AgentVoiceSettings, userLanguage: string) {
  const language = resolveLanguage(settings.language, userLanguage);
  const explicit = voices.find((v) => v.id === settings.voice) || voices.find((v) => v.id === settings.autoVoiceId);
  // Cartesia voices are multilingual; the bot's identity does not change with language.
  const voiceId = explicit?.id || assignAgentVoices(voices, [...agentIds, agentId])[agentId] || "";
  return { language, voiceId };
}

export function prefersVoiceReply(origin?: string, text = "") {
  return origin === "recording" && Boolean(text.trim()) && !/```/.test(text) && text.length <= 5000;
}