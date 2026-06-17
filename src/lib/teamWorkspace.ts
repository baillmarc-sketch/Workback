import { dbUrl } from "./cloud";
import type { Presence } from "./presence";

/**
 * Team-owned shared workspaces, generic across all toolkit apps. A team's files
 * live under /teamWorkspaces/{teamId}/docs/{appId}/{docId} (full doc JSON, each
 * stamped with createdBy), gated by the security rules to that team's members
 * (or an admin). Per-file presence sits under a sibling /presence subtree, and
 * soft-deletes under /trash — so reading the doc list never pulls either.
 *
 * Last-write-wins on save (no monotonic guard), with live presence to coordinate
 * concurrent editors. Callers migrate the raw JSON with their app's migrator.
 */
export type WorkspaceAppId = "workback" | "estimator" | "bid-specs";

interface SavableDoc {
  id: string;
  updatedAt: number;
}

const STALE_MS = 45_000;

function root(teamId: string): string {
  return `${dbUrl()}/teamWorkspaces/${encodeURIComponent(teamId)}`;
}
function auth(token: string): string {
  return `?auth=${encodeURIComponent(token)}`;
}

/** Every doc of one app in a team, keyed by id (raw JSON — caller migrates). */
export async function listTeamDocs(
  teamId: string,
  appId: WorkspaceAppId,
  token: string
): Promise<Record<string, object>> {
  const res = await fetch(`${root(teamId)}/docs/${appId}.json${auth(token)}`);
  if (!res.ok) throw new Error(`Team docs fetch failed (${res.status})`);
  return ((await res.json()) as Record<string, object> | null) ?? {};
}

export async function loadTeamDoc(
  teamId: string,
  appId: WorkspaceAppId,
  id: string,
  token: string
): Promise<object | null> {
  const res = await fetch(`${root(teamId)}/docs/${appId}/${encodeURIComponent(id)}.json${auth(token)}`);
  if (!res.ok) throw new Error(`Team doc fetch failed (${res.status})`);
  return (await res.json()) as object | null;
}

export async function saveTeamDoc(
  teamId: string,
  appId: WorkspaceAppId,
  doc: SavableDoc,
  token: string
): Promise<void> {
  const res = await fetch(`${root(teamId)}/docs/${appId}/${encodeURIComponent(doc.id)}.json${auth(token)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
  if (!res.ok) throw new Error(`Team save failed (${res.status})`);
}

/** Soft-delete: stash the doc in /trash and null the live copy in one atomic
    PATCH, so a team file can be recovered (mirrors the per-account trash). */
export async function deleteTeamDoc(
  teamId: string,
  appId: WorkspaceAppId,
  doc: SavableDoc,
  token: string
): Promise<void> {
  const res = await fetch(`${root(teamId)}.json${auth(token)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      [`docs/${appId}/${doc.id}`]: null,
      [`trash/${appId}/${doc.id}`]: doc,
    }),
  });
  if (!res.ok) throw new Error(`Team delete failed (${res.status})`);
}

// --- presence (who's viewing a team file, by name) ---

function presBase(teamId: string, appId: WorkspaceAppId, docId: string): string {
  return `${root(teamId)}/presence/${appId}/${encodeURIComponent(docId)}`;
}

export async function teamHeartbeat(
  teamId: string,
  appId: WorkspaceAppId,
  docId: string,
  sessionId: string,
  name: string,
  token: string
): Promise<void> {
  try {
    await fetch(`${presBase(teamId, appId, docId)}/${encodeURIComponent(sessionId)}.json${auth(token)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, t: Date.now() }),
    });
  } catch {}
}

export async function teamReadOthers(
  teamId: string,
  appId: WorkspaceAppId,
  docId: string,
  sessionId: string,
  token: string
): Promise<Presence[]> {
  try {
    const res = await fetch(`${presBase(teamId, appId, docId)}.json${auth(token)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as Record<string, Presence> | null;
    if (!data) return [];
    const now = Date.now();
    return Object.entries(data)
      .filter(([sid, p]) => sid !== sessionId && p && typeof p.t === "number" && now - p.t < STALE_MS)
      .map(([, p]) => ({ name: typeof p.name === "string" ? p.name : "Someone", t: p.t }));
  } catch {
    return [];
  }
}

export function teamLeave(
  teamId: string,
  appId: WorkspaceAppId,
  docId: string,
  sessionId: string,
  token: string
): void {
  try {
    fetch(`${presBase(teamId, appId, docId)}/${encodeURIComponent(sessionId)}.json${auth(token)}`, {
      method: "DELETE",
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
