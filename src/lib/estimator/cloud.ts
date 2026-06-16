import { dbUrl, newShareId } from "../cloud";
import { migrate } from "./storage";
import type { Estimate } from "./types";

/**
 * Cloud sharing for estimates, mirroring the Workback share model: shared docs
 * live under a `sharedEstimates` root, open read/write with the unguessable
 * share ID as the only access control. Per-account estimates under /users are
 * auth-gated (see database.rules.json). Reuses the same DB URL + share-ID
 * generator as Workback so both apps share one Firebase project.
 */
const ROOT = "sharedEstimates";

export { newShareId };

export async function publishEstimate(estimate: Estimate): Promise<void> {
  if (!estimate.shareId) throw new Error("Estimate has no share ID");
  const res = await fetch(`${dbUrl()}/${ROOT}/${estimate.shareId}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(estimate),
  });
  if (!res.ok) throw new Error(`Publish failed (${res.status})`);
}

/** Delete a shared estimate from the cloud — used to revoke a link. */
export async function unpublishEstimate(shareId: string): Promise<void> {
  const res = await fetch(`${dbUrl()}/${ROOT}/${encodeURIComponent(shareId)}.json`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Unpublish failed (${res.status})`);
}

/** RTDB drops empty objects/arrays, so a sparse estimate comes back missing
    fields — migrate fills them back in. */
export function normalizeRemote(data: object): Estimate {
  return migrate(data);
}

export async function fetchEstimate(shareId: string): Promise<Estimate | null> {
  const id = encodeURIComponent(shareId);
  const res = await fetch(`${dbUrl()}/${ROOT}/${id}.json`);
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const data = await res.json();
  if (data === null) return null;
  const estimate = normalizeRemote(data);
  estimate.shareId = shareId;
  return estimate;
}

export function estimateShareUrl(shareId: string): string {
  return `${location.origin}${location.pathname}#e=${shareId}`;
}
