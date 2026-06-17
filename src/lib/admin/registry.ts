import { dbUrl } from "../cloud";
import { emailKey } from "./email";
import type { AccountUser } from "@/state/auth";

/**
 * The user registry. A static export can't enumerate Firebase Auth users, so a
 * user only becomes visible to the admin page once they've signed in here at
 * least once: each sign-in writes a profile to /registry/{uid}. This is the
 * serverless stand-in for "users that exist in the database".
 *
 * The `emailKey` mirror is load-bearing for invites — the security rules let a
 * user read their own /invites/{emailKey} by matching it against
 * /registry/{uid}/emailKey, so the registry write MUST happen before an invite
 * is read (see AccessProvider).
 */

function url(path: string, token: string): string {
  return `${dbUrl()}/${path}.json?auth=${encodeURIComponent(token)}`;
}

export interface RegistryUser {
  uid: string;
  email: string;
  emailKey: string;
  name: string | null;
  photoURL: string | null;
  createdAt: number;
  lastSeen: number;
}

/**
 * Write the signed-in user's profile. Best-effort: never throw into the sign-in
 * path. `createdAt` is preserved across logins (read once, then re-written);
 * `lastSeen` is bumped every time. The stored `email` is the verified
 * auth.token.email value (the rules validate this), so the `emailKey` mirror can
 * be trusted to authorize that user's own invite read.
 */
export async function writeRegistry(uid: string, token: string, user: AccountUser): Promise<void> {
  if (!user.email) return; // registry is keyed on a verified email
  let createdAt = Date.now();
  try {
    const res = await fetch(url(`registry/${uid}/createdAt`, token));
    if (res.ok) {
      const existing = await res.json();
      if (typeof existing === "number") createdAt = existing;
    }
  } catch {
    // fall back to "now"; a best-effort registry write never blocks sign-in
  }
  const record = {
    email: user.email, // must equal auth.token.email per rules
    emailKey: emailKey(user.email),
    name: user.name ?? null,
    photoURL: user.photoURL ?? null,
    createdAt,
    lastSeen: Date.now(),
  };
  await fetch(url(`registry/${uid}`, token), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
}

/** List every registered user (admin only — gated by the rules). Corrupt rows
    are skipped rather than failing the whole list, mirroring the sync layer. */
export async function listRegistry(token: string): Promise<RegistryUser[]> {
  const res = await fetch(url("registry", token));
  if (!res.ok) throw new Error(`Registry fetch failed (${res.status})`);
  const data = (await res.json()) as Record<string, Partial<RegistryUser>> | null;
  if (!data) return [];
  const out: RegistryUser[] = [];
  for (const [uid, raw] of Object.entries(data)) {
    if (!raw || typeof raw.email !== "string") continue;
    out.push({
      uid,
      email: raw.email,
      emailKey: typeof raw.emailKey === "string" ? raw.emailKey : emailKey(raw.email),
      name: typeof raw.name === "string" ? raw.name : null,
      photoURL: typeof raw.photoURL === "string" ? raw.photoURL : null,
      createdAt: typeof raw.createdAt === "number" ? raw.createdAt : 0,
      lastSeen: typeof raw.lastSeen === "number" ? raw.lastSeen : 0,
    });
  }
  return out.sort((a, b) => b.lastSeen - a.lastSeen);
}
