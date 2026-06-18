import { dbUrl, normalizeRemote as normalizeProject } from "../cloud";
import { normalizeRemote as normalizeEstimate } from "../estimator/cloud";
import type { Project } from "../types";
import type { Estimate } from "../estimator/types";
import type { RegistryUser } from "./registry";

/**
 * Read-only "view as" fetchers for the admin page. They read another user's
 * data with the admin's token (authorized by the admin-override read rule on
 * /users/{uid}) and hold it in memory only — they NEVER touch localStorage or
 * write anywhere, so inspecting a user never pollutes the admin's own data.
 * Reuses the same `normalizeRemote` migrators as live sync so RTDB's
 * dropped-empty-collection quirks are handled identically.
 */

function url(targetUid: string, token: string, path: string): string {
  return `${dbUrl()}/users/${encodeURIComponent(targetUid)}${path}.json?auth=${encodeURIComponent(token)}`;
}

async function fetchMap(targetUid: string, token: string, path: string): Promise<Record<string, object>> {
  const res = await fetch(url(targetUid, token, path));
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const data = (await res.json()) as Record<string, object> | null;
  return data ?? {};
}

function toProjects(map: Record<string, object>): Project[] {
  const out: Project[] = [];
  for (const [id, raw] of Object.entries(map)) {
    try {
      const p = normalizeProject(raw);
      p.id = id;
      out.push(p);
    } catch {
      // never let one corrupt doc break the list
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

function toEstimates(map: Record<string, object>): Estimate[] {
  const out: Estimate[] = [];
  for (const [id, raw] of Object.entries(map)) {
    try {
      const e = normalizeEstimate(raw);
      e.id = id;
      out.push(e);
    } catch {
      // skip corrupt
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function fetchUserProjects(targetUid: string, token: string): Promise<Project[]> {
  return toProjects(await fetchMap(targetUid, token, "/projects"));
}

export async function fetchUserEstimates(targetUid: string, token: string): Promise<Estimate[]> {
  return toEstimates(await fetchMap(targetUid, token, "/estimates"));
}

export interface UserWork {
  user: RegistryUser;
  projects: Project[];
  estimates: Estimate[];
  /** True when that user's data couldn't be read (skipped, not fatal). */
  failed: boolean;
}

/**
 * Aggregate every user's calendars + estimates for the admin "All work" view.
 * Each user is independent: one user's read failure marks just that user
 * `failed` instead of breaking the whole view. Fetched in bounded batches
 * (CONCURRENCY) so a large roster doesn't fire hundreds of simultaneous requests
 * and exhaust the browser/connection pool.
 */
const CONCURRENCY = 6;

export async function fetchAllUsersWork(
  token: string,
  users: RegistryUser[]
): Promise<UserWork[]> {
  const out: UserWork[] = [];
  for (let i = 0; i < users.length; i += CONCURRENCY) {
    const batch = users.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (user) => {
        const [projects, estimates] = await Promise.all([
          fetchUserProjects(user.uid, token),
          fetchUserEstimates(user.uid, token),
        ]);
        return { user, projects, estimates, failed: false } satisfies UserWork;
      })
    );
    settled.forEach((r, j) =>
      out.push(
        r.status === "fulfilled"
          ? r.value
          : { user: batch[j], projects: [], estimates: [], failed: true }
      )
    );
  }
  return out;
}

export interface UserTrash {
  projects: Project[];
  estimates: Estimate[];
}

export async function fetchUserTrash(targetUid: string, token: string): Promise<UserTrash> {
  const [pt, et] = await Promise.all([
    fetchMap(targetUid, token, "/projectsTrash"),
    fetchMap(targetUid, token, "/estimatesTrash"),
  ]);
  return { projects: toProjects(pt), estimates: toEstimates(et) };
}

async function fetchTombstones(targetUid: string, token: string, path: string): Promise<Record<string, number>> {
  const res = await fetch(url(targetUid, token, path));
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const data = (await res.json()) as Record<string, number> | null;
  return data ?? {};
}

/**
 * Permanently drop trashed content for a user (retention). The numeric
 * tombstones are left intact so cross-device delete still propagates — purged
 * items simply become non-recoverable (the same state as a pre-soft-delete
 * tombstone). When `beforeMs` is given, only items deleted before that time are
 * purged (using the tombstone timestamp). Returns how many of each were purged.
 *
 * Note: a static export can't run a scheduled sweep, so this is an admin-invoked
 * action; automatic retention would need a scheduled Cloud Function.
 */
export async function purgeUserTrash(
  targetUid: string,
  token: string,
  beforeMs?: number
): Promise<{ projects: number; estimates: number }> {
  const [trashP, trashE, delP, delE] = await Promise.all([
    fetchMap(targetUid, token, "/projectsTrash"),
    fetchMap(targetUid, token, "/estimatesTrash"),
    fetchTombstones(targetUid, token, "/deleted"),
    fetchTombstones(targetUid, token, "/estimatesDeleted"),
  ]);
  const updates: Record<string, null> = {};
  let projects = 0;
  let estimates = 0;
  for (const id of Object.keys(trashP)) {
    if (beforeMs === undefined || (delP[id] ?? 0) < beforeMs) {
      updates[`projectsTrash/${id}`] = null;
      projects++;
    }
  }
  for (const id of Object.keys(trashE)) {
    if (beforeMs === undefined || (delE[id] ?? 0) < beforeMs) {
      updates[`estimatesTrash/${id}`] = null;
      estimates++;
    }
  }
  if (projects + estimates > 0) {
    const res = await fetch(url(targetUid, token, ""), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Purge failed (${res.status})`);
  }
  return { projects, estimates };
}
