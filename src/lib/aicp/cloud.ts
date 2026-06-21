import { dbUrl, newShareId } from "../cloud";
import { migrate } from "./storage";
import type { Bid } from "./types";

/**
 * Cloud sharing for AICP bids, mirroring the Estimator/Workback share model:
 * shared docs live under a `sharedAicpBids` root, open read/write with the
 * unguessable share ID as the only access control. Per-account bids under
 * /users/{uid}/aicpBids are auth-gated (see database.rules.json). Reuses the
 * shared DB URL + share-ID generator so the whole toolkit is one Firebase app.
 */
const ROOT = "sharedAicpBids";

export { newShareId };

export async function publishBid(bid: Bid): Promise<void> {
  if (!bid.shareId) throw new Error("Bid has no share ID");
  const res = await fetch(`${dbUrl()}/${ROOT}/${bid.shareId}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bid),
  });
  if (!res.ok) throw new Error(`Publish failed (${res.status})`);
}

/** Delete a shared bid from the cloud — used to revoke a link. */
export async function unpublishBid(shareId: string): Promise<void> {
  const res = await fetch(`${dbUrl()}/${ROOT}/${encodeURIComponent(shareId)}.json`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Unpublish failed (${res.status})`);
}

/** RTDB drops empty objects/arrays, so a sparse bid comes back missing fields —
    migrate fills them back in (and re-derives cell caches). */
export function normalizeRemote(data: object): Bid {
  return migrate(data);
}

export async function fetchBid(shareId: string): Promise<Bid | null> {
  const id = encodeURIComponent(shareId);
  const res = await fetch(`${dbUrl()}/${ROOT}/${id}.json`);
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const data = await res.json();
  if (data === null) return null;
  const bid = normalizeRemote(data);
  bid.shareId = shareId;
  return bid;
}

export function bidShareUrl(shareId: string): string {
  return `${location.origin}${location.pathname}#a=${shareId}`;
}
