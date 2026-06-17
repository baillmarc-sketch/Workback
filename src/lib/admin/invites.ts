import { dbUrl } from "../cloud";
import { emailKey } from "./email";

/**
 * Email invites pre-authorize access before a person's first sign-in. They're
 * keyed by emailKey and admin-only to write. On the invitee's first sign-in,
 * AccessProvider resolves the grant via the self-read invite rule (no backend
 * conversion step needed). `convertInvite` optionally pins the grant to a uid
 * once the person exists, so access no longer depends on the email mirror.
 */
export interface Invite {
  emailKey: string;
  email: string;
  estimator: boolean;
  createdAt: number;
  invitedBy: string;
}

function url(path: string, token: string): string {
  return `${dbUrl()}/${path}.json?auth=${encodeURIComponent(token)}`;
}

export async function listInvites(token: string): Promise<Invite[]> {
  const res = await fetch(url("invites", token));
  if (!res.ok) throw new Error(`Invites fetch failed (${res.status})`);
  const data = (await res.json()) as Record<string, Partial<Invite>> | null;
  if (!data) return [];
  const out: Invite[] = [];
  for (const [key, raw] of Object.entries(data)) {
    if (!raw || typeof raw.email !== "string") continue;
    out.push({
      emailKey: key,
      email: raw.email,
      estimator: raw.estimator === true,
      createdAt: typeof raw.createdAt === "number" ? raw.createdAt : 0,
      invitedBy: typeof raw.invitedBy === "string" ? raw.invitedBy : "",
    });
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export async function createInvite(
  token: string,
  email: string,
  estimator: boolean,
  invitedBy: string
): Promise<void> {
  const key = emailKey(email);
  const res = await fetch(url(`invites/${key}`, token), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      estimator,
      createdAt: Date.now(),
      invitedBy,
    }),
  });
  if (!res.ok) throw new Error(`Invite failed (${res.status})`);
}

export async function revokeInvite(token: string, key: string): Promise<void> {
  const res = await fetch(url(`invites/${key}`, token), { method: "DELETE" });
  if (!res.ok) throw new Error(`Revoke failed (${res.status})`);
}

/** Pin an invite to a now-known uid: set the explicit grant and remove the
    email invite, atomically. */
export async function convertInvite(
  token: string,
  uid: string,
  key: string,
  estimator: boolean
): Promise<void> {
  const res = await fetch(url("", token), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      [`entitlements/${uid}/estimator`]: estimator ? true : null,
      [`invites/${key}`]: null,
    }),
  });
  if (!res.ok) throw new Error(`Convert failed (${res.status})`);
}
