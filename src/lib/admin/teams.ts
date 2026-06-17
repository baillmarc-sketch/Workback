import { dbUrl, newShareId } from "../cloud";

/**
 * Teams are organizational metadata in v1: a name plus a membership set. They
 * are admin-only read/write (see the rules) and carry no data-sharing semantics
 * yet — that would require per-resource ACLs, which we deliberately keep out to
 * keep the rule surface flat and auditable.
 */
export interface Team {
  id: string;
  name: string;
  createdAt: number;
  members: Record<string, true>;
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
    { name?: string; createdAt?: number; members?: Record<string, boolean> }
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
