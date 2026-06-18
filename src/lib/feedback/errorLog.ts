/**
 * Lightweight client-side error capture. Installs window `error` and
 * `unhandledrejection` listeners once and keeps a short ring buffer of the most
 * recent errors, so the feedback dialog can attach "what went wrong"
 * automatically — the app otherwise ships with no error telemetry at all.
 * Best-effort and dependency-free; never throws into the host page.
 */

export interface CapturedError {
  ts: number;
  message: string;
  source?: string;
  stack?: string;
}

const MAX = 15;
const buffer: CapturedError[] = [];
let installed = false;

function push(err: CapturedError): void {
  buffer.push(err);
  while (buffer.length > MAX) buffer.shift();
}

/** Manually record an error (e.g. from a caught exception worth reporting). */
export function recordError(
  message: string,
  opts: { source?: string; stack?: string } = {}
): void {
  push({
    ts: Date.now(),
    message: String(message).slice(0, 1000),
    source: opts.source,
    stack: opts.stack?.slice(0, 2000),
  });
}

/** A copy of the recent errors, newest last. */
export function recentErrors(): CapturedError[] {
  return [...buffer];
}

export function clearErrors(): void {
  buffer.length = 0;
}

/** Install the global listeners once. Returns a teardown for symmetry/tests. */
export function installErrorCapture(): () => void {
  if (installed || typeof window === "undefined") return () => {};
  installed = true;

  const onError = (e: ErrorEvent) => {
    recordError(e.message || "Unknown error", {
      source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined,
      stack: e.error?.stack,
    });
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Unhandled promise rejection";
    recordError(message, {
      source: "unhandledrejection",
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    installed = false;
  };
}
