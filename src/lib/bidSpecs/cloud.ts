import { dbUrl, newShareId } from "../cloud";
import { migrate } from "./storage";
import type { BidSpec } from "./types";

/**
 * Cloud sharing for bid specs, mirroring the Estimator/Workback share model:
 * shared docs live under a `sharedBidSpecs` root, open read/write with the
 * unguessable share ID as the only access control. Reuses the same DB URL and
 * share-ID generator so the whole toolkit shares one Firebase project.
 */
const ROOT = "sharedBidSpecs";

export { newShareId };

export async function publishBidSpec(spec: BidSpec): Promise<void> {
  if (!spec.shareId) throw new Error("Bid spec has no share ID");
  const res = await fetch(`${dbUrl()}/${ROOT}/${spec.shareId}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  });
  if (!res.ok) throw new Error(`Publish failed (${res.status})`);
}

/** Delete a shared bid spec from the cloud — used to revoke a link. */
export async function unpublishBidSpec(shareId: string): Promise<void> {
  const res = await fetch(`${dbUrl()}/${ROOT}/${encodeURIComponent(shareId)}.json`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Unpublish failed (${res.status})`);
}

/** RTDB drops empty objects/arrays, so a sparse spec comes back missing fields —
    migrate fills them back in. */
export function normalizeRemote(data: object): BidSpec {
  return migrate(data);
}

export async function fetchBidSpec(shareId: string): Promise<BidSpec | null> {
  const id = encodeURIComponent(shareId);
  const res = await fetch(`${dbUrl()}/${ROOT}/${id}.json`);
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const data = await res.json();
  if (data === null) return null;
  const spec = normalizeRemote(data);
  spec.shareId = shareId;
  return spec;
}

export function bidSpecShareUrl(shareId: string): string {
  return `${location.origin}${location.pathname}#bs=${shareId}`;
}
