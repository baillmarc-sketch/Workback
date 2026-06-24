/**
 * Provider-agnostic error reporting. The app is a static export with no server,
 * so by default this just logs to the console — but it's the single chokepoint
 * every crash flows through, so a real backend (Sentry, a Cloud Function, etc.)
 * can be wired in one place without touching call sites.
 *
 * To turn on remote capture without adding an SDK, set REPORT_ENDPOINT to a
 * collector URL (a Cloud Function / logging endpoint). To use Sentry instead,
 * see docs/OPS.md — add @sentry/nextjs and forward inside reportError().
 */
const REPORT_ENDPOINT = ""; // empty = console-only (default)

let installed = false;

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
  // Always log so it's visible in the user's console and our own sessions.
  // eslint-disable-next-line no-console
  console.error("[workback]", err, context ?? "");

  if (!REPORT_ENDPOINT || typeof navigator === "undefined") return;
  try {
    const body = JSON.stringify({
      message: err.message,
      stack: err.stack ?? null,
      context: context ?? null,
      url: typeof location !== "undefined" ? location.href : null,
      ua: navigator.userAgent,
      ts: Date.now(),
    });
    // sendBeacon is fire-and-forget and survives an unload; fall back to fetch.
    const sent = typeof navigator.sendBeacon === "function" && navigator.sendBeacon(REPORT_ENDPOINT, body);
    if (!sent) void fetch(REPORT_ENDPOINT, { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    // reporting must never throw into the app
  }
}

/**
 * Catch the errors React error boundaries can't: async rejections and errors
 * thrown from event handlers / timers. Idempotent; safe to call on every mount.
 */
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => reportError(e.error ?? e.message, { kind: "window.error" }));
  window.addEventListener("unhandledrejection", (e) =>
    reportError((e as PromiseRejectionEvent).reason, { kind: "unhandledrejection" })
  );
}
