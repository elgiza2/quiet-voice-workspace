export type ProviderFailure = "invalid_key" | "exhausted" | "rate_limit" | "temporary" | "request_error";
/** Never substitute another key to bypass a provider's rate/account limit. */
export function classifyProviderFailure(status: number, exhausted = false): ProviderFailure {
  if (status === 401) return "invalid_key";
  if (status === 402 || exhausted) return "exhausted";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "temporary";
  return "request_error";
}
export function canUseAuthorizedBackup(failure: ProviderFailure, providerAllowsIndependentBackup: boolean) {
  return providerAllowsIndependentBackup && (failure === "invalid_key" || failure === "exhausted" || failure === "temporary");
}