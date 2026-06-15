import { compressToUTF16, decompressFromUTF16 } from "lz-string";
import type { Project, WorkbackEvent } from "./types";
import { uid } from "./types";
import { diffDays } from "./dates";

/**
 * Persistent, browsable edit history. Every undoable change appends a
 * timestamped snapshot with a human-readable label so the user can see what
 * happened and restore any point — and unlike the in-memory undo stack, it
 * survives reloads (stored compressed in localStorage).
 */

const PREFIX = "workback:history:";
const LIMIT = 60;
/** Collapse a burst of same-kind edits (e.g. typing a title) into one entry */
const COALESCE_MS = 2500;

export interface HistoryEntry {
  id: string;
  ts: number;
  label: string;
  snapshot: Project;
}

export function loadHistory(projectId: string): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(PREFIX + projectId);
    if (!raw) return [];
    const parsed = JSON.parse(decompressFromUTF16(raw)) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(projectId: string, entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(PREFIX + projectId, compressToUTF16(JSON.stringify(entries)));
  } catch {
    // quota — drop the oldest half and retry once
    try {
      const half = entries.slice(Math.floor(entries.length / 2));
      localStorage.setItem(PREFIX + projectId, compressToUTF16(JSON.stringify(half)));
    } catch {}
  }
}

export function pushHistory(projectId: string, label: string, snapshot: Project): void {
  const entries = loadHistory(projectId);
  const last = entries[entries.length - 1];
  if (last && last.label === label && Date.now() - last.ts < COALESCE_MS) {
    last.ts = Date.now();
    last.snapshot = snapshot;
  } else {
    entries.push({ id: uid(), ts: Date.now(), label, snapshot });
  }
  while (entries.length > LIMIT) entries.shift();
  saveHistory(projectId, entries);
}

export function clearHistory(projectId: string): void {
  try {
    localStorage.removeItem(PREFIX + projectId);
  } catch {}
}

const sameLen = (e: WorkbackEvent) => diffDays(e.startDate, e.endDate);

/** A short, human description of what changed between two project states. */
export function describeChange(before: Project, after: Project): string {
  const beforeById = new Map(before.events.map((e) => [e.id, e]));
  const afterById = new Map(after.events.map((e) => [e.id, e]));
  const added = after.events.filter((e) => !beforeById.has(e.id));
  const removed = before.events.filter((e) => !afterById.has(e.id));

  if (added.length === 1 && removed.length === 0) return `Added “${added[0].title}”`;
  if (added.length > 1 && removed.length === 0) return `Added ${added.length} events`;
  if (removed.length === 1 && added.length === 0) return `Deleted “${removed[0].title}”`;
  if (removed.length > 1 && added.length === 0) return `Deleted ${removed.length} events`;
  if (added.length && removed.length) return `Replaced ${removed.length} with ${added.length}`;

  const changed = after.events.filter((e) => {
    const prev = beforeById.get(e.id);
    return prev && JSON.stringify(prev) !== JSON.stringify(e);
  });
  if (changed.length === 1) {
    const e = changed[0];
    const prev = beforeById.get(e.id)!;
    if (e.startDate !== prev.startDate || e.endDate !== prev.endDate) {
      const delta = diffDays(prev.startDate, e.startDate);
      if (delta !== 0 && diffDays(prev.endDate, e.endDate) === delta) {
        return `Moved “${e.title}” ${delta > 0 ? "+" : ""}${delta}d`;
      }
      if (sameLen(e) !== sameLen(prev)) return `Resized “${e.title}”`;
      return `Rescheduled “${e.title}”`;
    }
    return `Edited “${e.title}”`;
  }
  if (changed.length > 1) return `Edited ${changed.length} events`;

  if (JSON.stringify(before.categories) !== JSON.stringify(after.categories)) return "Edited labels";
  if (before.title !== after.title || before.subtitle !== after.subtitle || before.notes !== after.notes) {
    return "Edited project details";
  }
  return "Updated";
}
