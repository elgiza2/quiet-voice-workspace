export interface CerebrasKeyCandidate {
  id: string;
  key: string;
}

export interface LegacyProviderKeyRow {
  api_key?: unknown;
}

/**
 * Preserve the encrypted vault's rotation order, then append active legacy-pool
 * and function-secret keys without duplicates. Legacy/env keys intentionally
 * have an empty id so service_keys failure bookkeeping never updates them.
 */
export function mergeCerebrasKeyCandidates(
  vaultKeys: readonly CerebrasKeyCandidate[],
  legacyRows: readonly LegacyProviderKeyRow[],
  envKey: string,
): CerebrasKeyCandidate[] {
  const candidates = vaultKeys.map(({ id, key }) => ({ id, key }));

  const append = (value: unknown) => {
    if (typeof value !== "string") return;
    const key = value.trim();
    if (key.length <= 12 || candidates.some((candidate) => candidate.key === key)) return;
    candidates.push({ id: "", key });
  };

  for (const row of legacyRows) append(row?.api_key);
  append(envKey);
  return candidates;
}
