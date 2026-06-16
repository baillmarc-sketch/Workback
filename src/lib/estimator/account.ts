import { dbUrl } from "../cloud";
import { normalizeRemote } from "./cloud";
import { deleteEstimate, listEstimates, loadEstimate, saveEstimate } from "./storage";
import type { Estimate } from "./types";

/**
 * Per-account estimate sync over Realtime Database REST (auth-gated by
 * database.rules.json), mirroring the Workback account model but under a
 * sibling namespace so one signed-in account holds both apps' data:
 *   /users/{uid}/estimates/{id} — full estimate JSON
 *   /users/{uid}/estimatesDeleted/{id} — tombstone (deletedAt ms)
 *
 * Merge model is per-estimate last-write-wins by updatedAt.
 */

function userUrl(uid: string, token: string, path = ""): string {
  return `${dbUrl()}/users/${uid}${path}.json?auth=${encodeURIComponent(token)}`;
}

export async function pushEstimate(uid: string, token: string, estimate: Estimate): Promise<void> {
  const res = await fetch(userUrl(uid, token, `/estimates/${estimate.id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(estimate),
  });
  if (!res.ok) throw new Error(`Account push failed (${res.status})`);
}

export async function deleteRemoteEstimate(uid: string, token: string, id: string): Promise<void> {
  const res = await fetch(userUrl(uid, token), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [`estimates/${id}`]: null, [`estimatesDeleted/${id}`]: Date.now() }),
  });
  if (!res.ok) throw new Error(`Account delete failed (${res.status})`);
}

export interface SyncResult {
  pulledIds: string[];
  pushedIds: string[];
}

export async function syncEstimates(uid: string, token: string): Promise<SyncResult> {
  const res = await fetch(userUrl(uid, token));
  if (!res.ok) throw new Error(`Account fetch failed (${res.status})`);
  const data = (await res.json()) as {
    estimates?: Record<string, object>;
    estimatesDeleted?: Record<string, number>;
  } | null;
  const remote = data?.estimates ?? {};
  const tombstones = data?.estimatesDeleted ?? {};

  // Deletes propagate unless the local copy was edited after the delete
  for (const [id, deletedAt] of Object.entries(tombstones)) {
    const local = loadEstimate(id);
    if (local && local.updatedAt <= deletedAt) deleteEstimate(id);
  }

  // Pull: remote copies newer than local (or unknown locally)
  const pulledIds: string[] = [];
  for (const [id, raw] of Object.entries(remote)) {
    let re: Estimate;
    try {
      re = normalizeRemote(raw);
    } catch {
      continue; // never let one corrupt doc break the whole sync
    }
    const local = loadEstimate(id);
    if (!local || re.updatedAt > local.updatedAt) {
      saveEstimate(re, { setLastOpen: false });
      pulledIds.push(id);
    }
  }

  // Push: local copies newer than remote (or missing there), one atomic PATCH.
  const updates: Record<string, unknown> = {};
  const pushedIds: string[] = [];
  for (const s of listEstimates()) {
    const tomb = tombstones[s.id];
    if (tomb !== undefined && tomb >= s.updatedAt) continue;
    const remoteDoc = remote[s.id] as { updatedAt?: number } | undefined;
    if (!remoteDoc || s.updatedAt > (remoteDoc.updatedAt ?? 0)) {
      const local = loadEstimate(s.id);
      if (!local) continue;
      updates[`estimates/${s.id}`] = local;
      if (tomb !== undefined) updates[`estimatesDeleted/${s.id}`] = null;
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
