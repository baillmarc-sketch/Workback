import type { AccountUser } from "@/state/auth";
import type { AppId } from "./toolkit";

/**
 * Access control for the toolkit. Workback is public; the Estimator (and any
 * future Pro app) is private to the owner's Google account. This is the single
 * place that decides who can open what — the future paywall reads billing here
 * instead of a hardcoded allowlist, and call sites in AppGate don't change.
 */
const ALLOWED_EMAILS = ["baillmarc@gmail.com"];

function isAllowed(user: AccountUser | null): boolean {
  return !!user?.email && ALLOWED_EMAILS.includes(user.email.toLowerCase());
}

export function hasEntitlement(user: AccountUser | null, appId: AppId): boolean {
  if (appId === "workback") return true; // public, default app
  return isAllowed(user);
}

/** True when the user can reach the private toolkit apps (drives the menu bar). */
export function canAccessToolkit(user: AccountUser | null): boolean {
  return isAllowed(user);
}
