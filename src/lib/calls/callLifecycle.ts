export const pendingCallStatuses = ["ringing", "scheduled"];
export function isPendingCall(status: string) { return pendingCallStatuses.includes(status); }

/** A one-off request is authorized by the current user message, never conversation history. */
export function requestsCall(text: string) {
  if (/(?:don't|do not|stop|cancel|no more)\s+(?:call|ring)|(?:مت|ما\s*ت|مات)(?:رن|تصل)|(?:وقف|بطل|الغ[يى])[^.!؟\n]{0,25}(?:رن|مكالم|اتصال)/i.test(text)) return false;
  return /\b(?:call|ring|phone)\s+me\b|(?:رن|اتصل|كلمني|تكلمني)\s*(?:علي[اّ]|عليّ|عليا|بيا|بي|لي)|(?:فكرني|ذكرني|remind\s+me)[\s\S]*(?:مكالم|اتصال|رن|\bcall\b)/i.test(text);
}

export async function callRequestId(conversationId: string, messageId: string) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`call:${conversationId}:${messageId}`)));
  hash[6] = (hash[6] & 15) | 80; hash[8] = (hash[8] & 63) | 128;
  const s = Array.from(hash.slice(0, 16), b => b.toString(16).padStart(2, "0")).join("");
  return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
}