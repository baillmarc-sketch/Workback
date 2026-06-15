import { dbUrl } from "./cloud";

/**
 * Lightweight live presence for shared projects. Stored under the shared doc's
 * own `_presence` child, which inherits the shared node's open read/write — so
 * it needs no rules change — and is best-effort: every call swallows errors so
 * presence can never disturb the project or its sync. Each tab writes a
 * heartbeat; collaborators are anyone with a fresh heartbeat from another tab.
 */

const STALE_MS = 45_000;

export interface Presence {
  name: string;
  t: number;
}

function base(shareId: string): string {
  return `${dbUrl()}/shared/${encodeURIComponent(shareId)}/_presence`;
}

export async function heartbeat(shareId: string, sessionId: string, name: string): Promise<void> {
  try {
    await fetch(`${base(shareId)}/${encodeURIComponent(sessionId)}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, t: Date.now() }),
    });
  } catch {}
}

export async function readOthers(shareId: string, sessionId: string): Promise<Presence[]> {
  try {
    const res = await fetch(`${base(shareId)}.json`);
    if (!res.ok) return [];
    const data = (await res.json()) as Record<string, Presence> | null;
    if (!data) return [];
    const now = Date.now();
    return Object.entries(data)
      .filter(([sid, p]) => sid !== sessionId && p && typeof p.t === "number" && now - p.t < STALE_MS)
      .map(([, p]) => ({ name: typeof p.name === "string" ? p.name : "Someone", t: p.t }));
  } catch {
    return [];
  }
}

export function leave(shareId: string, sessionId: string): void {
  try {
    fetch(`${base(shareId)}/${encodeURIComponent(sessionId)}.json`, {
      method: "DELETE",
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
