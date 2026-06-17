import { dbUrl, newShareId } from "../cloud";

/**
 * Teams group users (a name + membership set) and can grant the Estimator to all
 * members. Teams are admin-only read, so a member can't read team grants
 * directly; the grant is denormalized into the per-user
 * `entitlements/{uid}/estimatorViaTeam` flag (which the member CAN read) by
 * `syncTeamEntitlements`, called whenever membership or a team's grant changes.
 * That flag is kept separate from the direct `estimator` grant so the two
 * sources never clobber each other.
 */
export interface Team {
  id: string;
  name: string;
  createdAt: number;
  members: Record<string, true>;
  /** Whether membership in this team grants the Estimator. */
  grantsEstimator: boolean;
}

function url(path: string, token: string): string {
  return `${dbUrl()}/${path}.json?auth=${encodeURIComponent(token)}`;
}

async function send(method: string, path: string, token: string, body?: unknown): Promise<void> {
  const res = await fetch(url(path, token), {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Team write failed (${res.status})`);
}

export async function listTeams(token: string): Promise<Team[]> {
  const res = await fetch(url("teams", token));
  if (!res.ok) throw new Error(`Teams fetch failed (${res.status})`);
  const data = (await res.json()) as Record<
    string,
    { name?: string; createdAt?: number; members?: Record<string, boolean>; apps?: { estimator?: boolean } }
  > | null;
  if (!data) return [];
  const out: Team[] = [];
  for (const [id, raw] of Object.entries(data)) {
    if (!raw || typeof raw.name !== "string") continue;
    const members: Record<string, true> = {};
    if (raw.members) for (const [uid, v] of Object.entries(raw.members)) if (v) members[uid] = true;
    out.push({
      id,
      name: raw.name,
      createdAt: typeof raw.createdAt === "number" ? raw.createdAt : 0,
      members,
      grantsEstimator: raw.apps?.estimator === true,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createTeam(token: string, name: string): Promise<string> {
  const id = newShareId();
  await send("PUT", `teams/${id}`, token, { name, createdAt: Date.now() });
  return id;
}

export async function renameTeam(token: string, id: string, name: string): Promise<void> {
  await send("PATCH", `teams/${id}`, token, { name });
}

export async function deleteTeam(token: string, id: string): Promise<void> {
  await send("DELETE", `teams/${id}`, token);
}

export async function setMembership(
  token: string,
  teamId: string,
  uid: string,
  inTeam: boolean
): Promise<void> {
  await send("PATCH", `teams/${teamId}/members`, token, { [uid]: inTeam ? true : null });
}

/** Toggle whether a team grants the Estimator to its members. */
export async function setTeamGrant(token: string, teamId: string, estimator: boolean): Promise<void> {
  await send("PATCH", `teams/${teamId}/apps`, token, { estimator: estimator ? true : null });
}

/**
 * Recompute the team-derived Estimator flag for the given users and write it in
 * one atomic PATCH. Re-reads teams so it reflects the just-made change;
 * `estimatorViaTeam` is true iff the user is a member of any team that grants
 * the Estimator. Call after any membership / team-grant / team-delete change.
 */
export async function syncTeamEntitlements(token: string, uids: string[]): Promise<void> {
  const unique = [...new Set(uids)];
  if (unique.length === 0) return;
  const teams = await listTeams(token);
  const updates: Record<string, true | null> = {};
  for (const uid of unique) {
    const viaTeam = teams.some((t) => t.grantsEstimator && t.members[uid]);
    updates[`entitlements/${uid}/estimatorViaTeam`] = viaTeam ? true : null;
  }
  const res = await fetch(url("", token), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Entitlement sync failed (${res.status})`);
}
