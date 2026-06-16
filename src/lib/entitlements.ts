import type { AccountUser } from "@/state/auth";
import type { AppId } from "./toolkit";

/**
 * Entitlement check seam for the future paywall. Today every app is free, so
 * this always returns true. When billing lands, this is the single place to
 * read a `/users/{uid}/billing` node (or a cached claim) and gate "pro" apps —
 * call sites in AppGate don't change.
 */
export function hasEntitlement(_user: AccountUser | null, _appId: AppId): boolean {
  return true;
}
