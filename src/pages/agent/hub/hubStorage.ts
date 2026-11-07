import type { AgentColor } from "@/lib/agentsky/client";

export type AgentGroup = {
  id: string;
  name: string;
  coordinatorId: string;
  memberIds: string[];
  category: string;
  createdAt: string;
};

export type VoiceSettings = {
  voice: string;
  speed: number;
  language: string;
};

export type HubLocalState = {
  groups: AgentGroup[];
  categories: Record<string, string>;
  hidden: string[];
  voices: Record<string, VoiceSettings>;
  pinned: string[];
  unread: string[];
  seen: Record<string, string>;
};

export const EMPTY_HUB_LOCAL: HubLocalState = {
  groups: [],
  categories: {},
  hidden: [],
  voices: {},
  pinned: [],
  unread: [],
  seen: {},
};

export const DEFAULT_VOICE: VoiceSettings = { voice: "Not set", speed: 1, language: "Auto" };

const keyFor = (userId: string) => `megsy_agent_hub_v2:${userId || "device"}`;

export function loadHubLocal(userId: string): HubLocalState {
  if (typeof window === "undefined") return EMPTY_HUB_LOCAL;
  try {
    const value = JSON.parse(window.localStorage.getItem(keyFor(userId)) || "null") as Partial<HubLocalState> | null;
    if (!value) return EMPTY_HUB_LOCAL;
    return {
      groups: Array.isArray(value.groups)
        ? value.groups.filter(
            (g): g is AgentGroup =>
              !!g &&
              typeof g.id === "string" &&
              typeof g.name === "string" &&
              typeof g.coordinatorId === "string" &&
              Array.isArray(g.memberIds) &&
              g.memberIds.every((id) => typeof id === "string"),
          )
        : [],
      categories: value.categories && typeof value.categories === "object" ? value.categories : {},
      hidden: Array.isArray(value.hidden) ? value.hidden.filter((id): id is string => typeof id === "string") : [],
      voices: value.voices && typeof value.voices === "object" ? value.voices : {},
      pinned: Array.isArray(value.pinned) ? value.pinned.filter((id): id is string => typeof id === "string") : [],
      unread: Array.isArray(value.unread) ? value.unread.filter((id): id is string => typeof id === "string") : [],
      seen: value.seen && typeof value.seen === "object" ? value.seen : {},
    };
  } catch {
    return EMPTY_HUB_LOCAL;
  }
}

export function saveHubLocal(userId: string, state: HubLocalState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(state));
  } catch {
    // The hub still works for this session when storage is unavailable.
  }
}

export function makeGroup(input: {
  name: string;
  coordinatorId: string;
  memberIds: string[];
  category?: string;
  id?: string;
  createdAt?: string;
}): AgentGroup {
  const name = input.name.trim();
  const memberIds = [...new Set(input.memberIds.filter(Boolean))];
  if (name.length < 2 || name.length > 60) throw new Error("Group name must be between 2 and 60 characters.");
  if (!input.coordinatorId) throw new Error("The group needs a coordinator.");
  if (memberIds.length < 2) throw new Error("Choose at least two bots for the group.");
  if (memberIds.length > 8) throw new Error("A group can have up to eight bots.");
  return {
    id: input.id || `group-${crypto.randomUUID()}`,
    name,
    coordinatorId: input.coordinatorId,
    memberIds,
    category: input.category?.trim() || "Unassigned",
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function groupPrompt(name: string, members: { name: string; description: string; prompt: string }[]) {
  const roster = members
    .map((member) => `- ${member.name}: ${member.description || "Personal bot"}. ${member.prompt || ""}`.trim())
    .join("\n");
  return `You are the coordinator of the multi-bot group "${name}". Reply in the user's language. Understand the request, decide which listed bot should lead, and identify the speaker before each contribution. When the user mentions @BotName, that bot must lead the next answer. Keep contributions concise and do not invent completed actions. Format every contribution as a separate block beginning with [[speaker: Exact Bot Name]], using only names from this roster. Use one block when one bot is enough and up to three blocks when collaboration helps.\n\nGroup members:\n${roster}`;
}

export function groupTranscript(content: string) {
  const marker = /\[\[speaker:\s*([^\]\n]{1,80})\]\]\s*/g;
  const matches = [...content.matchAll(marker)];
  if (!matches.length) return [{ speaker: "", text: content }];
  return matches.map((match, index) => ({
    speaker: match[1].trim(),
    text: content.slice((match.index || 0) + match[0].length, matches[index + 1]?.index).trim(),
  })).filter((part) => part.text);
}

export function itemKey(kind: "bot" | "group", id: string) {
  return `${kind}:${id}`;
}

export function voiceFor(local: HubLocalState, id: string): VoiceSettings {
  return { ...DEFAULT_VOICE, ...(local.voices[id] || {}) };
}

export function colorForGroup(memberColors: AgentColor[]): AgentColor {
  return memberColors[0] || "aurora";
}
