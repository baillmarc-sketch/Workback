import { dbUrl, newShareId } from "../cloud";
import { parseAppFromHash } from "../toolkit";
import { recentErrors } from "./errorLog";
import type { AccountUser } from "@/state/auth";

/**
 * In-app feedback channel. Reports land at /feedback/{id} in the Workback RTDB.
 * The node is create-open (anyone, signed in or not, can append a new report —
 * the share-style random id is unguessable and writes are append-only) but
 * admin-read only, mirroring the open-write / gated-read posture of /shared and
 * /accessRequests (see database.rules.json). Admins triage from the Admin page.
 *
 * Everything is bounded client-side AND in the rules so a single report can't
 * balloon the database: message ≤ 4 000 chars, errors ≤ 8 000, screenshot
 * ≤ 400 000 (a downscaled JPEG data URL, ~300 KB).
 */

export type FeedbackKind = "bug" | "idea" | "praise" | "other";
export type FeedbackStatus = "new" | "reviewed";

export const FEEDBACK_KINDS: FeedbackKind[] = ["bug", "idea", "praise", "other"];

/** Bumped per release; surfaced in each report's context so a bug can be tied to
    the build that produced it. */
export const APP_VERSION = "1.0.0";

export interface FeedbackEntry {
  id: string;
  createdAt: number;
  kind: FeedbackKind;
  message: string;
  email: string | null;
  name: string | null;
  uid: string | null;
  app: string | null;
  path: string | null;
  userAgent: string | null;
  viewport: string | null;
  appVersion: string | null;
  /** JSON-stringified CapturedError[] from the error ring buffer. */
  errors: string | null;
  /** Downscaled JPEG data URL, or null. */
  screenshot: string | null;
  status: FeedbackStatus;
  reviewedAt: number | null;
  reviewedBy: string | null;
}

const ROOT = "feedback";

function endpoint(path: string, token?: string | null): string {
  const base = `${dbUrl()}/${path}.json`;
  return token ? `${base}?auth=${encodeURIComponent(token)}` : base;
}

interface FeedbackContext {
  app: string;
  path: string;
  userAgent: string;
  viewport: string;
  appVersion: string;
}

/** Snapshot of the current environment. The URL hash is NOT recorded — it can
    hold share secrets (#p=, #wb=, #e=, #bs=) — only the resolved app id. */
function gatherContext(): FeedbackContext {
  if (typeof window === "undefined") {
    return { app: "workback", path: "", userAgent: "", viewport: "", appVersion: APP_VERSION };
  }
  return {
    app: parseAppFromHash(window.location.hash),
    path: window.location.pathname,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    appVersion: APP_VERSION,
  };
}

export interface FeedbackInput {
  kind: FeedbackKind;
  message: string;
  email?: string | null;
  screenshot?: string | null;
  /** When false, no browser/screen/error diagnostics are attached. */
  includeDiagnostics?: boolean;
  user?: AccountUser | null;
}

/** Submit a new report. Works signed-out; the token is attached only for
    Firebase-side attribution and is never required by the rules. */
export async function submitFeedback(input: FeedbackInput, token?: string | null): Promise<void> {
  const ctx = gatherContext();
  const id = newShareId();
  const diag = input.includeDiagnostics !== false;
  const errs = diag ? recentErrors() : [];

  const body: Record<string, unknown> = {
    createdAt: Date.now(),
    kind: input.kind,
    message: input.message.trim().slice(0, 4000),
    email: input.email?.trim() || input.user?.email || null,
    name: input.user?.name ?? null,
    uid: input.user?.uid ?? null,
    app: ctx.app,
    path: ctx.path,
    userAgent: diag ? ctx.userAgent.slice(0, 600) : null,
    viewport: diag ? ctx.viewport : null,
    appVersion: ctx.appVersion,
    errors: errs.length ? JSON.stringify(errs).slice(0, 8000) : null,
    screenshot: input.screenshot || null,
    status: "new",
  };

  const res = await fetch(endpoint(`${ROOT}/${id}`, token), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Feedback failed (${res.status})`);
}

/** All reports, newest first (admin only — gated by the rules). Corrupt rows are
    skipped rather than failing the whole list, like the other admin helpers. */
export async function listFeedback(token: string): Promise<FeedbackEntry[]> {
  const res = await fetch(endpoint(ROOT, token));
  if (!res.ok) throw new Error(`Feedback fetch failed (${res.status})`);
  const data = (await res.json()) as Record<string, Partial<FeedbackEntry>> | null;
  if (!data) return [];
  const out: FeedbackEntry[] = [];
  for (const [id, raw] of Object.entries(data)) {
    if (!raw || typeof raw.message !== "string") continue;
    out.push(normalize(id, raw));
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export async function setFeedbackStatus(
  token: string,
  id: string,
  status: FeedbackStatus,
  reviewer: AccountUser | null
): Promise<void> {
  const reviewed = status === "reviewed";
  const res = await fetch(endpoint(`${ROOT}/${id}`, token), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status,
      reviewedAt: reviewed ? Date.now() : null,
      reviewedBy: reviewed ? reviewer?.email ?? reviewer?.uid ?? null : null,
    }),
  });
  if (!res.ok) throw new Error(`Update failed (${res.status})`);
}

export async function deleteFeedback(token: string, id: string): Promise<void> {
  const res = await fetch(endpoint(`${ROOT}/${id}`, token), { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
}

/** Count of unreviewed reports — drives the Admin nav badge. */
export async function countNewFeedback(token: string): Promise<number> {
  const list = await listFeedback(token);
  return list.reduce((n, f) => (f.status !== "reviewed" ? n + 1 : n), 0);
}

function normalize(id: string, raw: Partial<FeedbackEntry>): FeedbackEntry {
  const kind = FEEDBACK_KINDS.includes(raw.kind as FeedbackKind)
    ? (raw.kind as FeedbackKind)
    : "other";
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
  const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
  return {
    id,
    createdAt: num(raw.createdAt) ?? 0,
    kind,
    message: raw.message as string,
    email: str(raw.email),
    name: str(raw.name),
    uid: str(raw.uid),
    app: str(raw.app),
    path: str(raw.path),
    userAgent: str(raw.userAgent),
    viewport: str(raw.viewport),
    appVersion: str(raw.appVersion),
    errors: str(raw.errors),
    screenshot: str(raw.screenshot),
    status: raw.status === "reviewed" ? "reviewed" : "new",
    reviewedAt: num(raw.reviewedAt),
    reviewedBy: str(raw.reviewedBy),
  };
}

/**
 * Downscale + JPEG-encode an image to a bounded data URL fit for RTDB storage.
 * Tries progressively smaller widths / qualities until it's under the cap;
 * returns null if even the smallest is too big. Dependency-free (canvas).
 */
export async function prepareScreenshot(file: Blob): Promise<string | null> {
  const MAX_CHARS = 380_000; // ~285 KB, comfortably under the rules' 400k cap
  const img = await loadImage(file);
  for (const maxW of [1280, 1024, 800, 640]) {
    for (const quality of [0.7, 0.55, 0.4]) {
      const url = encodeImage(img, maxW, quality);
      if (url && url.length <= MAX_CHARS) return url;
    }
  }
  return null;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

function encodeImage(img: HTMLImageElement, maxW: number, quality: number): string | null {
  const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
  const w = Math.max(1, Math.round((img.naturalWidth || maxW) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || maxW) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  try {
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null; // tainted canvas / unsupported — fail soft
  }
}
