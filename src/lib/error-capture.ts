// Keeps the most recent server error so the SSR error page can log it.
let last: unknown;

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (e: any) => { last = e?.error ?? e; });
  globalThis.addEventListener("unhandledrejection", (e: any) => { last = e?.reason ?? e; });
}

export function consumeLastCapturedError(): unknown {
  const e = last;
  last = undefined;
  return e;
}
