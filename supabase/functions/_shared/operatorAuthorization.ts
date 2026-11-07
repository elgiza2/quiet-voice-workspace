/** Scheduled privileged endpoints must fail closed when their secret is absent. */
export function operatorAuthorized(expected: string | undefined, supplied: string | null): boolean {
  return Boolean(expected?.trim()) && supplied === expected?.trim();
}