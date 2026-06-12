import { migrate } from "./storage";
import type { Project } from "./types";

/**
 * Cloud sharing via Firebase Realtime Database REST — same zero-auth pattern
 * as the eggs leaderboard. The share ID is the secret (unguessable, ~62 bits).
 *
 * Default DB is the eggs project; its rules must allow the `workback` node:
 *   "workback": { ".read": true, ".write": true }
 * Point the app at a different DB without rebuilding by setting
 * localStorage["workback:dbUrl"].
 */
const DEFAULT_DB = "https://eggs-ec17c-default-rtdb.firebaseio.com";
const ROOT = "workback";

function dbUrl(): string {
  try {
    return localStorage.getItem("workback:dbUrl") || DEFAULT_DB;
  } catch {
    return DEFAULT_DB;
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

export async function fetchShared(shareId: string): Promise<Project | null> {
  const res = await fetch(`${dbUrl()}/${ROOT}/${encodeURIComponent(shareId)}.json`);
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const data = await res.json();
  if (data === null) return null;
  const project = migrate(data);
  project.shareId = shareId;
  return project;
}

export function shareUrl(shareId: string): string {
  return `${location.origin}${location.pathname}#p=${shareId}`;
}
