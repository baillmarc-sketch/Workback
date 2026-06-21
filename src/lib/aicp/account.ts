import { dbUrl } from "../cloud";
import { normalizeRemote } from "./cloud";
import { deleteBid, listBids, loadBid, saveBid } from "./storage";
import type { Bid } from "./types";

/**
 * Per-account AICP bid sync over Realtime Database REST (auth-gated by
 * database.rules.json), mirroring the Estimator account model under a sibling
 * namespace so one signed-in account holds every app's data:
 *   /users/{uid}/aicpBids/{id} — full bid JSON
 *   /users/{uid}/aicpBidsDeleted/{id} — tombstone (deletedAt ms)
 *   /users/{uid}/aicpBidsTrash/{id} — recoverable copy
 *
 * Merge model is per-bid last-write-wins by updatedAt.
 */
function userUrl(uid: string, token: string, path = ""): string {
  return `${dbUrl()}/users/${uid}${path}.json?auth=${encodeURIComponent(token)}`;
}

export async function pushBid(uid: string, token: string, bid: Bid): Promise<void> {
  const res = await fetch(userUrl(uid, token, `/aicpBids/${bid.id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bid),
  });
  if (!res.ok) throw new Error(`Account push failed (${res.status})`);
}

export async function deleteRemoteBid(uid: string, token: string, id: string, bid?: Bid | null): Promise<void> {
  const updates: Record<string, unknown> = {
    [`aicpBids/${id}`]: null,
    [`aicpBidsDeleted/${id}`]: Date.now(),
  };
  if (bid) updates[`aicpBidsTrash/${id}`] = bid;
  const res = await fetch(userUrl(uid, token), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Account delete failed (${res.status})`);
}

export interface SyncResult {
  pulledIds: string[];
  pushedIds: string[];
}

export async function syncBids(uid: string, token: string): Promise<SyncResult> {
  const res = await fetch(userUrl(uid, token));
  if (!res.ok) throw new Error(`Account fetch failed (${res.status})`);
  const data = (await res.json()) as {
    aicpBids?: Record<string, object>;
    aicpBidsDeleted?: Record<string, number>;
  } | null;
  const remote = data?.aicpBids ?? {};
  const tombstones = data?.aicpBidsDeleted ?? {};

  // Deletes propagate unless the local copy was edited after the delete.
  for (const [id, deletedAt] of Object.entries(tombstones)) {
    const local = loadBid(id);
    if (local && local.updatedAt <= deletedAt) deleteBid(id);
  }

  // Pull: remote copies newer than local (or unknown locally).
  const pulledIds: string[] = [];
  for (const [id, raw] of Object.entries(remote)) {
    let re: Bid;
    try {
      re = normalizeRemote(raw);
    } catch {
      continue;
    }
    const local = loadBid(id);
    if (!local || re.updatedAt > local.updatedAt) {
      saveBid(re, { setLastOpen: false });
      pulledIds.push(id);
    }
  }

  // Push: local copies newer than remote (or missing there), one atomic PATCH.
  const updates: Record<string, unknown> = {};
  const pushedIds: string[] = [];
  for (const s of listBids()) {
    const tomb = tombstones[s.id];
    if (tomb !== undefined && tomb >= s.updatedAt) continue;
    const remoteDoc = remote[s.id] as { updatedAt?: number } | undefined;
    if (!remoteDoc || s.updatedAt > (remoteDoc.updatedAt ?? 0)) {
      const local = loadBid(s.id);
      if (!local) continue;
      updates[`aicpBids/${s.id}`] = local;
      if (tomb !== undefined) updates[`aicpBidsDeleted/${s.id}`] = null;
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
