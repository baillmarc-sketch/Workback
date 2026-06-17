import { dbUrl } from "../cloud";
import type { AccountUser } from "@/state/auth";

/**
 * Self-service access requests. A signed-in user who lacks access can ask for
 * it from the gate; the request lands at /accessRequests/{uid} (writable only by
 * that user — the rules pin the stored email to the verified auth token). Admins
 * see pending requests on the Admin page and either approve (grant Estimator and
 * clear the request, atomically) or dismiss them.
 *
 * Requests are the inbound counterpart to invites (which pre-authorize before a
 * first sign-in); approving one just writes the same /entitlements grant.
 */
export interface AccessRequest {
  uid: string;
  email: string;
  name: string | null;
  message: string | null;
  createdAt: number;
}

function url(path: string, token: string): string {
  return `${dbUrl()}/${path}.json?auth=${encodeURIComponent(token)}`;
}

/** Submit (or refresh) the signed-in user's own access request. `email` MUST be
    the verified auth email — the rules reject anything else. */
export async function requestAccess(
  uid: string,
  token: string,
  user: AccountUser,
  message?: string
): Promise<void> {
  if (!user.email) throw new Error("Your account has no email address.");
  const body: Record<string, unknown> = {
    email: user.email,
    name: user.name ?? null,
    message: message?.trim() ? message.trim() : null,
    createdAt: Date.now(),
  };
  const res = await fetch(url(`accessRequests/${uid}`, token), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
}

/** The signed-in user's own pending request, or null. Drives the gate's
    "request sent" state so a reload doesn't offer the button again. */
export async function myAccessRequest(uid: string, token: string): Promise<AccessRequest | null> {
  try {
    const res = await fetch(url(`accessRequests/${uid}`, token));
    if (!res.ok) return null;
    const raw = (await res.json()) as Partial<AccessRequest> | null;
    if (!raw || typeof raw.email !== "string") return null;
    return normalize(uid, raw);
  } catch {
    return null;
  }
}

/** List every pending request (admin only — gated by the rules). Corrupt rows
    are skipped rather than failing the whole list, mirroring the other admin
    list helpers. */
export async function listAccessRequests(token: string): Promise<AccessRequest[]> {
  const res = await fetch(url("accessRequests", token));
  if (!res.ok) throw new Error(`Requests fetch failed (${res.status})`);
  const data = (await res.json()) as Record<string, Partial<AccessRequest>> | null;
  if (!data) return [];
  const out: AccessRequest[] = [];
  for (const [uid, raw] of Object.entries(data)) {
    if (!raw || typeof raw.email !== "string") continue;
    out.push(normalize(uid, raw));
  }
  return out.sort((a, b) => a.createdAt - b.createdAt); // oldest first — answer in order
}

/** Approve a request: grant Estimator and clear the request in one atomic PATCH
    so a request can't linger after the grant (or vice-versa). */
export async function approveAccessRequest(token: string, uid: string): Promise<void> {
  const res = await fetch(url("", token), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      [`entitlements/${uid}/estimator`]: true,
      [`accessRequests/${uid}`]: null,
    }),
  });
  if (!res.ok) throw new Error(`Approve failed (${res.status})`);
}

/** Dismiss a request without granting access (admin only). */
export async function dismissAccessRequest(token: string, uid: string): Promise<void> {
  const res = await fetch(url(`accessRequests/${uid}`, token), { method: "DELETE" });
  if (!res.ok) throw new Error(`Dismiss failed (${res.status})`);
}

function normalize(uid: string, raw: Partial<AccessRequest>): AccessRequest {
  return {
    uid,
    email: raw.email as string,
    name: typeof raw.name === "string" ? raw.name : null,
    message: typeof raw.message === "string" ? raw.message : null,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : 0,
  };
}
