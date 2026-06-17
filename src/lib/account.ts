import { dbUrl, normalizeRemote } from "./cloud";
import { deleteProject, listProjects, loadProject, saveProject } from "./storage";
import type { Project } from "./types";

/**
 * Per-account project sync over Realtime Database REST (auth-gated by
 * database.rules.json):
 *   /users/{uid}/projects/{projectId} — full project JSON
 *   /users/{uid}/deleted/{projectId}  — tombstone (deletedAt ms), so a delete
 *     on one device isn't resurrected by another device's next sync
 *
 * Merge model is per-project last-write-wins by updatedAt — the same model
 * the shared-link sync already uses.
 */

function userUrl(uid: string, token: string, path = ""): string {
  return `${dbUrl()}/users/${uid}${path}.json?auth=${encodeURIComponent(token)}`;
}

export async function pushProject(uid: string, token: string, project: Project): Promise<void> {
  const res = await fetch(userUrl(uid, token, `/projects/${project.id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  if (!res.ok) throw new Error(`Account push failed (${res.status})`);
}

/**
 * Soft-delete: null the live doc and tombstone it (so other devices don't
 * resurrect it), but also stash the full doc under `projectsTrash` so it can be
 * recovered. When `project` is omitted (e.g. a bulk reset where the local copy
 * is already gone) only the tombstone is written and the project is not
 * recoverable — backward compatible with old clients that never wrote trash.
 */
export async function deleteRemoteProject(
  uid: string,
  token: string,
  id: string,
  project?: Project | null
): Promise<void> {
  const updates: Record<string, unknown> = {
    [`projects/${id}`]: null,
    [`deleted/${id}`]: Date.now(),
  };
  if (project) updates[`projectsTrash/${id}`] = project;
  const res = await fetch(userUrl(uid, token), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Account delete failed (${res.status})`);
}

/**
 * Recover a soft-deleted project: move the trashed doc back to live (bumping
 * updatedAt to now so it out-races any stale tombstone on another device),
 * clear the tombstone, and empty the trash slot — all in one atomic PATCH.
 * Returns the recovered project, or null when there's no recoverable content
 * (an old tombstone with no trashed doc). Authorized for the owner or any admin.
 */
export async function recoverRemoteProject(
  uid: string,
  token: string,
  id: string
): Promise<Project | null> {
  const res = await fetch(userUrl(uid, token, `/projectsTrash/${id}`));
  if (!res.ok) throw new Error(`Trash fetch failed (${res.status})`);
  const raw = (await res.json()) as object | null;
  if (!raw) return null;
  let project: Project;
  try {
    project = normalizeRemote(raw);
  } catch {
    return null;
  }
  project.id = id;
  project.updatedAt = Date.now();
  const put = await fetch(userUrl(uid, token), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      [`projects/${id}`]: project,
      [`deleted/${id}`]: null,
      [`projectsTrash/${id}`]: null,
    }),
  });
  if (!put.ok) throw new Error(`Recover failed (${put.status})`);
  return project;
}

export interface SyncResult {
  pulledIds: string[];
  pushedIds: string[];
}

export async function syncAccount(uid: string, token: string): Promise<SyncResult> {
  const res = await fetch(userUrl(uid, token));
  if (!res.ok) throw new Error(`Account fetch failed (${res.status})`);
  const data = (await res.json()) as {
    projects?: Record<string, object>;
    deleted?: Record<string, number>;
  } | null;
  const remote = data?.projects ?? {};
  const tombstones = data?.deleted ?? {};

  // Deletes propagate unless the local copy was edited after the delete
  for (const [id, deletedAt] of Object.entries(tombstones)) {
    const local = loadProject(id);
    if (local && local.updatedAt <= deletedAt) deleteProject(id);
  }

  // Pull: remote copies newer than local (or unknown locally)
  const pulledIds: string[] = [];
  for (const [id, raw] of Object.entries(remote)) {
    let rp: Project;
    try {
      rp = normalizeRemote(raw);
    } catch {
      continue; // never let one corrupt doc break the whole sync
    }
    const local = loadProject(id);
    if (!local || rp.updatedAt > local.updatedAt) {
      saveProject(rp, { setLastOpen: false });
      pulledIds.push(id);
    }
  }

  // Push: local copies newer than remote (or missing there), one atomic PATCH.
  // A local copy newer than its tombstone resurrects the project.
  const updates: Record<string, unknown> = {};
  const pushedIds: string[] = [];
  for (const s of listProjects()) {
    const tomb = tombstones[s.id];
    if (tomb !== undefined && tomb >= s.updatedAt) continue;
    const remoteDoc = remote[s.id] as { updatedAt?: number } | undefined;
    if (!remoteDoc || s.updatedAt > (remoteDoc.updatedAt ?? 0)) {
      const local = loadProject(s.id);
      if (!local) continue;
      updates[`projects/${s.id}`] = local;
      if (tomb !== undefined) updates[`deleted/${s.id}`] = null;
      pushedIds.push(s.id);
    }
  }
  if (pushedIds.length > 0) {
    const push = await fetch(userUrl(uid, token), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!push.ok) throw new Error(`Account push failed (${push.status})`);
  }

  return { pulledIds, pushedIds };
}
