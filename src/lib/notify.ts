/**
 * One-way channel for non-React libs to surface a user-facing toast — e.g.
 * storage warning that it had to trim undo history to stay under quota. App
 * listens for NOTICE_EVENT and shows the message.
 */
export const NOTICE_EVENT = "workback:notice";

export function notify(message: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTICE_EVENT, { detail: message }));
}
