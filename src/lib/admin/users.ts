import { dbUrl } from "../cloud";
import type { Role } from "./access";

/**
 * Admin writes to the access-control namespaces. /admins is the security source
 * of truth (the rules read it); /roles is descriptive metadata kept in lockstep
 * with it, so they're written together in one atomic root PATCH and can't drift.
 */

function url(path: string, token: string): string {
  return `${dbUrl()}/${path}.json?auth=${encodeURIComponent(token)}`;
}

async function send(method: string, path: string, token: string, body?: unknown): Promise<void> {
  const res = await fetch(url(path, token), {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Admin write failed (${res.status})`);
}

/** Grant or revoke a per-user app entitlement (currently just "estimator"). */
export async function setEntitlement(
  uid: string,
  token: string,
  key: "estimator",
  value: boolean
): Promise<void> {
  // PATCH so sibling entitlement keys are preserved; null removes the flag.
  await send("PATCH", `entitlements/${uid}`, token, { [key]: value ? true : null });
}

/**
 * Set a user's role and keep /admins in lockstep in one atomic root PATCH:
 * owner/admin imply membership in /admins; member clears it.
 */
export async function setRole(uid: string, token: string, role: Role): Promise<void> {
  await send("PATCH", "", token, {
    [`roles/${uid}`]: role,
    [`admins/${uid}`]: role === "member" ? null : true,
  });
}

/** Directly add/remove an admin (used by the owner "Claim access" bootstrap). */
export async function setAdmin(uid: string, token: string, isAdmin: boolean): Promise<void> {
  if (isAdmin) await send("PUT", `admins/${uid}`, token, true);
  else await send("DELETE", `admins/${uid}`, token);
}

export interface AccessMaps {
  admins: Record<string, boolean>;
  roles: Record<string, Role>;
  entitlements: Record<string, { estimator?: boolean }>;
}

/** Fetch the admin/role/entitlement maps in one go to render the Users table.
    Each is admin-readable at the collection level (see the rules). */
export async function fetchAccessMaps(token: string): Promise<AccessMaps> {
  const get = async (path: string): Promise<Record<string, unknown>> => {
    try {
      const res = await fetch(url(path, token));
      if (!res.ok) return {};
      return ((await res.json()) as Record<string, unknown>) ?? {};
    } catch {
      return {};
    }
  };
  const [admins, roles, entitlements] = await Promise.all([
    get("admins"),
    get("roles"),
    get("entitlements"),
  ]);
  return {
    admins: admins as Record<string, boolean>,
    roles: roles as Record<string, Role>,
    entitlements: entitlements as Record<string, { estimator?: boolean }>,
  };
}
