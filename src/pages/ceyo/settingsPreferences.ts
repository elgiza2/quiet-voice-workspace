export type PermissionRuleKind = "ask" | "allow";

export type PermissionPreferences = {
  autoReview: boolean;
  ask: string[];
  allow: string[];
};

export const PERMISSIONS_STORAGE_KEY = "ceyo_permissions_v1";

export const DEFAULT_PERMISSIONS: PermissionPreferences = {
  autoReview: true,
  ask: [],
  allow: [],
};

const cleanRules = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((rule): rule is string => typeof rule === "string").map((rule) => rule.trim()).filter(Boolean)
    : [];

export function parsePermissionPreferences(raw: string | null): PermissionPreferences {
  if (!raw) return DEFAULT_PERMISSIONS;
  try {
    const value = JSON.parse(raw) as Partial<PermissionPreferences>;
    return {
      autoReview: typeof value.autoReview === "boolean" ? value.autoReview : true,
      ask: cleanRules(value.ask),
      allow: cleanRules(value.allow),
    };
  } catch {
    return DEFAULT_PERMISSIONS;
  }
}

export function addPermissionRule(
  preferences: PermissionPreferences,
  kind: PermissionRuleKind,
  text: string,
): PermissionPreferences {
  const rule = text.trim();
  if (!rule) return preferences;
  if (preferences[kind].some((item) => item.toLocaleLowerCase() === rule.toLocaleLowerCase())) return preferences;
  return { ...preferences, [kind]: [...preferences[kind], rule] };
}

export function removePermissionRule(
  preferences: PermissionPreferences,
  kind: PermissionRuleKind,
  index: number,
): PermissionPreferences {
  return { ...preferences, [kind]: preferences[kind].filter((_, itemIndex) => itemIndex !== index) };
}

export function permissionSummary(preferences: PermissionPreferences): string {
  const count = preferences.ask.length + preferences.allow.length;
  return `Auto-review ${preferences.autoReview ? "on" : "off"} · ${count} ${count === 1 ? "rule" : "rules"}`;
}
