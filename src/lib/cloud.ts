import { DB_URL } from "./firebase";
import { migrate } from "./storage";
import type { Project } from "./types";

/**
 * Cloud sharing via Firebase Realtime Database REST. Shared docs are open
 * read/write — the share ID is the secret (unguessable, ~62 bits) — while
 * per-account data under /users is auth-gated (see database.rules.json).
 * Point the app at a different DB without rebuilding by setting
 * localStorage["workback:dbUrl"].
 */
const ROOT = "shared";

/** Where shared docs lived before the move to the Workback Firebase project */
const LEGACY_DB = "https://eggs-ec17c-default-rtdb.firebaseio.com";
const LEGACY_ROOT = "workback";

export function dbUrl(): string {
  try {
    return localStorage.getItem("workback:dbUrl") || DB_URL;
  } catch {
    return DB_URL;
  }
}

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"; // 62

/** ~131-bit, bias-free, URL-safe share ID. Unguessable: the link is the only
    access control on a shared doc, so this is the security boundary. */
export function newShareId(): string {
  const out: string[] = [];
  const limit = 256 - (256 % ID_ALPHABET.length); // reject above this to avoid modulo bias
  while (out.length < 22) {
    const buf = new Uint8Array(22 - out.length);
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < limit) out.push(ID_ALPHABET[b % ID_ALPHABET.length]);
    }
  }
  return out.join("");
}

export async function publishProject(project: Project): Promise<void> {
  if (!project.shareId) throw new Error("Project has no share ID");
  const res = await fetch(`${dbUrl()}/${ROOT}/${project.shareId}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  if (!res.ok) throw new Error(`Publish failed (${res.status})`);
}

/** Cheap "head" check: just the shared doc's `updatedAt` (ms), or null. Lets us
 *  detect that someone else saved without pulling the whole project. */
export async function fetchRemoteUpdatedAt(shareId: string): Promise<number | null> {
  try {
    const res = await fetch(`${dbUrl()}/${ROOT}/${encodeURIComponent(shareId)}/updatedAt.json`);
    if (!res.ok) return null;
    const v = await res.json();
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

/** Delete a shared doc from the cloud — used to revoke a link (reset link). */
export async function unpublishProject(shareId: string): Promise<void> {
  const res = await fetch(`${dbUrl()}/${ROOT}/${encodeURIComponent(shareId)}.json`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Unpublish failed (${res.status})`);
}

/** RTDB drops empty arrays, so a zero-event project comes back without `events` */
export function normalizeRemote(data: object): Project {
  return migrate({ events: [], ...data });
}

export async function fetchShared(shareId: string): Promise<Project | null> {
  const id = encodeURIComponent(shareId);
  const res = await fetch(`${dbUrl()}/${ROOT}/${id}.json`);
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  let data = await res.json();
  let adopted = false;
  if (data === null) {
    // Links minted before the move: read once from the old DB and adopt the
    // doc into the new one so the link survives the legacy DB closing down
    data = await fetchLegacy(id);
    if (data === null) return null;
    adopted = true;
  }
  const project = normalizeRemote(data);
  project.shareId = shareId;
  if (adopted) publishProject(project).catch(() => {});
  return project;
}

async function fetchLegacy(id: string): Promise<object | null> {
  try {
    const res = await fetch(`${LEGACY_DB}/${LEGACY_ROOT}/${id}.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function shareUrl(shareId: string): string {
  return `${location.origin}${location.pathname}#p=${shareId}`;
}
