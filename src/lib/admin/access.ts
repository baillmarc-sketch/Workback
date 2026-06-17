import { dbUrl } from "../cloud";
import { emailKey } from "./email";

export type Role = "owner" | "admin" | "member";

/**
 * A snapshot of the current user's access, loaded once after sign-in and cached
 * by AccessProvider so the render paths (AppBar, AppGate) can stay synchronous
 * even though the data now lives in the database.
 */
export interface AccessSnapshot {
  isAdmin: boolean;
  role: Role | null;
  /** Explicit per-user Estimator grant (/entitlements/{uid}). */
  estimator: boolean;
  /** Estimator granted by an email invite (/invites/{emailKey}). */
  invitedEstimator: boolean;
}

export const EMPTY_ACCESS: AccessSnapshot = {
  isAdmin: false,
  role: null,
  estimator: false,
  invitedEstimator: false,
};

function url(path: string, token: string): string {
  return `${dbUrl()}/${path}.json?auth=${encodeURIComponent(token)}`;
}

async function getJson(path: string, token: string): Promise<unknown> {
  try {
    const res = await fetch(url(path, token));
    if (!res.ok) return null; // permission-denied / missing → treated as "no access"
    return await res.json();
  } catch {
    return null;
  }
}

function hasEstimatorFlag(val: unknown): boolean {
  return !!(val && typeof val === "object" && (val as { estimator?: unknown }).estimator === true);
}

/**
 * Load the current user's admin/role/entitlement snapshot. Every read is
 * independently fault-tolerant: a permission-denied (a node the rules don't let
 * this user read) resolves to "no", never an exception, so a regular user comes
 * back all-false. Reads run in parallel.
 */
export async function loadAccess(
  uid: string,
  token: string,
  email: string | null
): Promise<AccessSnapshot> {
  const key = email ? emailKey(email) : null;
  const [adminVal, roleVal, entVal, inviteVal] = await Promise.all([
    getJson(`admins/${uid}`, token),
    getJson(`roles/${uid}`, token),
    getJson(`entitlements/${uid}`, token),
    key ? getJson(`invites/${key}`, token) : Promise.resolve(null),
  ]);
  const role: Role | null =
    roleVal === "owner" || roleVal === "admin" || roleVal === "member" ? roleVal : null;
  return {
    isAdmin: adminVal === true,
    role,
    estimator: hasEstimatorFlag(entVal),
    invitedEstimator: hasEstimatorFlag(inviteVal),
  };
}
