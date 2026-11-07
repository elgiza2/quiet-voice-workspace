/** @doc Phone-call bridge to the Ceyo Android app (same `MegsyAndroid` WebView interface as bridge.ts).
 *  Bot calls are handed to the phone so they ring like a normal call even when the app is in the
 *  background or closed. No-ops in a normal browser. Native side: docs/android-bridge.md. */

export type NativeCall = { id: string; botName: string; kind: "voice" | "video"; reason: string; at: number };
export type NativeCallAction = "answer" | "decline" | "missed";

type CallApi = {
  scheduleCall?: (json: string) => void;
  showIncomingCall?: (json: string) => void;
  cancelCall?: (id: string) => void;
  callStarted?: (json: string) => void;
  callEnded?: (id: string) => void;
};

declare global {
  interface Window {
    megsyNativeCallAction?: (callId: string, action: string) => void;
  }
}

const api = (): CallApi | null =>
  typeof window !== "undefined" && window.MegsyAndroid ? (window.MegsyAndroid as unknown as CallApi) : null;

export const hasNativeCalls = () => !!api()?.showIncomingCall;

const safe = (fn: () => void) => { try { fn(); } catch { /* bridge errors never break the web call */ } };

const payload = (c: NativeCall) => JSON.stringify({ id: c.id, botName: c.botName, kind: c.kind, reason: c.reason.slice(0, 160), at: c.at, path: `/?answerCall=${c.id}` });

/** Ask the phone to ring at `at` (epoch ms) even if the app is closed by then. */
export function scheduleNativeCall(c: NativeCall): boolean {
  const a = api();
  if (!a?.scheduleCall) return false;
  safe(() => a.scheduleCall!(payload(c)));
  return true;
}

/** Show the phone's own incoming-call screen now (works over the lock screen / other apps). */
export function showNativeIncomingCall(c: NativeCall): boolean {
  const a = api();
  if (!a?.showIncomingCall) return false;
  safe(() => a.showIncomingCall!(payload(c)));
  return true;
}

export function cancelNativeCall(id: string): void { const a = api(); if (a?.cancelCall) safe(() => a.cancelCall!(id)); }

/** Keeps an ongoing-call notification + foreground service so audio continues in the background. */
export function nativeCallStarted(id: string, botName: string, kind: "voice" | "video"): void {
  const a = api(); if (a?.callStarted) safe(() => a.callStarted!(JSON.stringify({ id, botName, kind })));
}
export function nativeCallEnded(id: string): void { const a = api(); if (a?.callEnded) safe(() => a.callEnded!(id)); }

/** Native → web: the user tapped Answer/Decline on the phone's call screen. */
export function onNativeCallAction(handler: (callId: string, action: NativeCallAction) => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.megsyNativeCallAction = (id, action) => {
    if (action === "answer" || action === "decline" || action === "missed") handler(String(id), action);
  };
  return () => { delete window.megsyNativeCallAction; };
}

/** `/?answerCall=<id>` — the phone opened the app from its call screen's Answer button. */
export function takeAnswerCallParam(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const id = url.searchParams.get("answerCall");
  if (!id) return null;
  url.searchParams.delete("answerCall");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}
