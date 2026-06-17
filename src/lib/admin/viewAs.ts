import { dbUrl, normalizeRemote as normalizeProject } from "../cloud";
import { normalizeRemote as normalizeEstimate } from "../estimator/cloud";
import type { Project } from "../types";
import type { Estimate } from "../estimator/types";

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
