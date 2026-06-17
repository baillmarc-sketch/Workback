import type { AccountUser } from "@/state/auth";
import type { AppId } from "./toolkit";
import type { AccessSnapshot } from "./admin/access";

/**
 * Access control for the toolkit. Workback is public; the Estimator (and any
 * future Pro app) and the Admin page are private. Access used to be a hardcoded
 * email allowlist; it is now data-driven — per-user grants, roles, and email
 * invites live in the Realtime Database and are loaded into an `AccessSnapshot`
 * by AccessProvider, which is what these functions consult.
 *
 * The owner email stays hardcoded as a bootstrap: the account that administers
 * the system can never be locked out, even if its `/admins` record is wiped
 * (the database rules let the owner re-seed it). `access` is optional so call
 * sites that don't yet have a snapshot still resolve the owner correctly.
 */
export const OWNER_EMAILS = ["baillmarc@gmail.com"];

export function isOwner(user: AccountUser | null): boolean {
  return !!user?.email && OWNER_EMAILS.includes(user.email.toLowerCase());
}

export function hasEntitlement(
  user: AccountUser | null,
  appId: AppId,
  access?: AccessSnapshot | null
): boolean {
  if (appId === "workback") return true; // public, default app
  if (appId === "admin") return isOwner(user) || !!access?.isAdmin;
  // estimator (and any future pro app): owner, any admin, an explicit grant, or
  // a pre-authorized email invite.
  return (
    isOwner(user) ||
    !!access?.isAdmin ||
    !!access?.estimator ||
    !!access?.invitedEstimator
  );
}

/** True when the user can reach a private toolkit app (drives the menu bar). */
export function canAccessToolkit(
  user: AccountUser | null,
  access?: AccessSnapshot | null
): boolean {
  return hasEntitlement(user, "estimator", access) || hasEntitlement(user, "admin", access);
}
