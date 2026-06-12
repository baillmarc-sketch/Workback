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

export function newShareId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
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
