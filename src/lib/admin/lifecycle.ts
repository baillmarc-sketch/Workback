import { dbUrl } from "../cloud";
import { emailKey } from "./email";
import { listTeams } from "./teams";
import type { RegistryUser } from "./registry";

/**
 * Hard-delete a user: revoke every form of access AND purge their stored data
 * and profile, in one atomic root PATCH so it can't half-apply. This is the
 * GDPR-style "remove + erase" — irreversible.
 *
 * RTDB multi-path updates are all-or-nothing, so if any leaf is rejected the
 * whole thing fails. That's the safety net for protected owners: the
 * `admins/{uid}` delete is blocked by the owner-pin guard in the rules, which
 * fails the entire operation rather than partially stripping a protected owner.
 */
function url(path: string, token: string): string {
  return `${dbUrl()}/${path}.json?auth=${encodeURIComponent(token)}`;
}

export async function removeUser(token: string, target: RegistryUser): Promise<void> {
  const updates: Record<string, null> = {
    [`registry/${target.uid}`]: null,
    [`entitlements/${target.uid}`]: null,
    [`roles/${target.uid}`]: null,
    [`admins/${target.uid}`]: null,
    [`accessRequests/${target.uid}`]: null,
    [`users/${target.uid}`]: null,
    [`invites/${emailKey(target.email)}`]: null,
  };
  // Drop them from any team they belong to (best-effort: a team-list failure
  // shouldn't block erasing the user's core data and access).
  try {
    for (const t of await listTeams(token)) {
      if (t.members[target.uid]) updates[`teams/${t.id}/members/${target.uid}`] = null;
    }
  } catch {
    /* skip team cleanup */
  }
  const res = await fetch(url("", token), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Remove user failed (${res.status})`);
}
