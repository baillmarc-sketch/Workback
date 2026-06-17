import { dbUrl } from "../cloud";
import { normalizeRemote } from "./cloud";
import { deleteBidSpec, listBidSpecs, loadBidSpec, saveBidSpec } from "./storage";
import type { BidSpec } from "./types";

/**
 * Per-account bid-specs sync over Realtime Database REST (auth-gated by
 * database.rules.json), mirroring the Estimator account model under a sibling
 * namespace so one signed-in account holds every toolkit app's data:
 *   /users/{uid}/bidSpecs/{id} — full bid-spec JSON
 *   /users/{uid}/bidSpecsDeleted/{id} — tombstone (deletedAt ms)
 *
 * Merge model is per-spec last-write-wins by updatedAt.
 */

function userUrl(uid: string, token: string, path = ""): string {
  return `${dbUrl()}/users/${uid}${path}.json?auth=${encodeURIComponent(token)}`;
}

export async function pushBidSpec(uid: string, token: string, spec: BidSpec): Promise<void> {
  const res = await fetch(userUrl(uid, token, `/bidSpecs/${spec.id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  });
  if (!res.ok) throw new Error(`Account push failed (${res.status})`);
}

export async function deleteRemoteBidSpec(uid: string, token: string, id: string): Promise<void> {
  const res = await fetch(userUrl(uid, token), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [`bidSpecs/${id}`]: null, [`bidSpecsDeleted/${id}`]: Date.now() }),
  });
  if (!res.ok) throw new Error(`Account delete failed (${res.status})`);
}

export interface SyncResult {
  pulledIds: string[];
  pushedIds: string[];
}

export async function syncBidSpecs(uid: string, token: string): Promise<SyncResult> {
  const res = await fetch(userUrl(uid, token));
  if (!res.ok) throw new Error(`Account fetch failed (${res.status})`);
  const data = (await res.json()) as {
    bidSpecs?: Record<string, object>;
    bidSpecsDeleted?: Record<string, number>;
  } | null;
  const remote = data?.bidSpecs ?? {};
  const tombstones = data?.bidSpecsDeleted ?? {};

  for (const [id, deletedAt] of Object.entries(tombstones)) {
    const local = loadBidSpec(id);
    if (local && local.updatedAt <= deletedAt) deleteBidSpec(id);
  }

  const pulledIds: string[] = [];
  for (const [id, raw] of Object.entries(remote)) {
    let re: BidSpec;
    try {
      re = normalizeRemote(raw);
    } catch {
      continue;
    }
    const local = loadBidSpec(id);
    if (!local || re.updatedAt > local.updatedAt) {
      saveBidSpec(re, { setLastOpen: false });
      pulledIds.push(id);
    }
  }

  const updates: Record<string, unknown> = {};
  const pushedIds: string[] = [];
  for (const s of listBidSpecs()) {
    const tomb = tombstones[s.id];
    if (tomb !== undefined && tomb >= s.updatedAt) continue;
    const remoteDoc = remote[s.id] as { updatedAt?: number } | undefined;
    if (!remoteDoc || s.updatedAt > (remoteDoc.updatedAt ?? 0)) {
      const local = loadBidSpec(s.id);
      if (!local) continue;
      updates[`bidSpecs/${s.id}`] = local;
      if (tomb !== undefined) updates[`bidSpecsDeleted/${s.id}`] = null;
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
