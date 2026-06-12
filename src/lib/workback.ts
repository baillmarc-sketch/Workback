import { addDaysKey, diffDays, durationDays } from "./dates";
import type { CategoryId, DateChange, WorkbackEvent } from "./types";
import { uid } from "./types";

function shiftEvent(e: WorkbackEvent, delta: number): WorkbackEvent {
  return {
    ...e,
    startDate: addDaysKey(e.startDate, delta),
    endDate: addDaysKey(e.endDate, delta),
  };
}

function sortKey(a: WorkbackEvent, b: WorkbackEvent): number {
  return a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0;
}

/**
 * Move one event by `delta` days. With `shiftDownstream`, every unlocked event
 * whose start date is >= the moved event's original start shifts by the same
 * delta. Locked events never move. If a downstream shift would push the block
 * into a locked event, the gap between the block and the lock is compressed
 * proportionally instead.
 */
export function moveEvent(
  events: WorkbackEvent[],
  id: string,
  delta: number,
  shiftDownstream: boolean
): WorkbackEvent[] {
  if (delta === 0) return events;
  const moved = events.find((e) => e.id === id);
  if (!moved || moved.locked) return events;

  if (!shiftDownstream) {
    return events.map((e) => (e.id === id ? shiftEvent(e, delta) : e));
  }

  const origStart = moved.startDate;
  const affected = events.filter((e) => !e.locked && e.startDate >= origStart);

  // Nearest locked event at/after the block — the wall we can't push through.
  const lock = events
    .filter((e) => e.locked && e.startDate >= origStart)
    .sort(sortKey)[0];

  // Rigid shift is fine unless it would push the block into the lock
  const block = lock ? affected.filter((e) => e.startDate < lock.startDate) : affected;
  const blockEnd = block.reduce((m, e) => (e.endDate > m ? e.endDate : m), origStart);
  const collides = lock && delta > 0 && addDaysKey(blockEnd, delta) >= lock.startDate;

  if (!lock || !collides) {
    const ids = new Set(affected.map((e) => e.id));
    return events.map((e) => (ids.has(e.id) ? shiftEvent(e, delta) : e));
  }

  // Compress: remap block offsets [0, span) into [delta, span) so the block
  // still ends before the locked date where possible.
  const span = diffDays(origStart, lock.startDate);
  const newSpan = Math.max(span - delta, 0);
  const scale = span > 0 ? newSpan / span : 0;
  const ids = new Set(affected.map((e) => e.id));

  return events.map((e) => {
    if (!ids.has(e.id)) return e;
    if (e.startDate >= lock.startDate) return shiftEvent(e, delta);
    const offset = diffDays(origStart, e.startDate);
    const newOffset = delta + Math.round(offset * scale);
    return shiftEvent(e, newOffset - offset);
  });
}

export function resizeEvent(
  events: WorkbackEvent[],
  id: string,
  edge: "start" | "end",
  dayKey: string
): WorkbackEvent[] {
  return events.map((e) => {
    if (e.id !== id) return e;
    if (edge === "start") {
      return { ...e, startDate: dayKey > e.endDate ? e.endDate : dayKey };
    }
    return { ...e, endDate: dayKey < e.startDate ? e.startDate : dayKey };
  });
}

/**
 * Warning state, derived: an unlocked event is flagged when it overlaps a
 * locked event, or sits with < 1 day of buffer before one.
 */
export function warningIds(events: WorkbackEvent[]): Set<string> {
  const locks = events.filter((e) => e.locked);
  const out = new Set<string>();
  if (locks.length === 0) return out;
  for (const e of events) {
    if (e.locked) continue;
    for (const l of locks) {
      const overlaps = e.startDate <= l.endDate && e.endDate >= l.startDate;
      const buffer = diffDays(e.endDate, l.startDate) - 1;
      const tight = l.startDate > e.endDate && buffer < 1;
      if (overlaps || tight) {
        out.add(e.id);
        break;
      }
    }
  }
  return out;
}

/**
 * Global compress (negative delta) / extend (positive delta) by N days.
 * If a locked event exists, it anchors the END (true workback: dates
 * redistribute backwards from the locked delivery and the start moves).
 * Otherwise the first event anchors the START. Durations are preserved.
 */
export function compressTimeline(
  events: WorkbackEvent[],
  deltaDays: number
): DateChange[] {
  const unlocked = events.filter((e) => !e.locked);
  if (unlocked.length === 0 || deltaDays === 0) return [];

  const firstStart = events.reduce((m, e) => (e.startDate < m ? e.startDate : m), events[0].startDate);
  const locks = events.filter((e) => e.locked).sort(sortKey);
  const lastLock = locks[locks.length - 1];

  const changes: DateChange[] = [];

  if (lastLock) {
    const anchor = lastLock.startDate; // redistribute backwards from delivery
    const span = diffDays(firstStart, anchor);
    if (span <= 0) return [];
    const scale = Math.max(span + deltaDays, 1) / span;
    for (const e of unlocked) {
      if (e.startDate > anchor) continue; // events after delivery stay put
      const back = diffDays(e.startDate, anchor);
      const newStart = addDaysKey(anchor, -Math.round(back * scale));
      if (newStart === e.startDate) continue;
      changes.push(change(e, newStart));
    }
  } else {
    const anchor = firstStart;
    const lastStart = events.reduce((m, e) => (e.startDate > m ? e.startDate : m), events[0].startDate);
    const span = diffDays(anchor, lastStart);
    if (span <= 0) return [];
    const scale = Math.max(span + deltaDays, 1) / span;
    for (const e of unlocked) {
      const offset = diffDays(anchor, e.startDate);
      const newStart = addDaysKey(anchor, Math.round(offset * scale));
      if (newStart === e.startDate) continue;
      changes.push(change(e, newStart));
    }
  }
  return changes;
}

function change(e: WorkbackEvent, newStart: string): DateChange {
  const dur = durationDays(e.startDate, e.endDate);
  return {
    id: e.id,
    title: e.title,
    category: e.category,
    oldStart: e.startDate,
    oldEnd: e.endDate,
    newStart,
    newEnd: addDaysKey(newStart, dur - 1),
  };
}

export function applyChanges(
  events: WorkbackEvent[],
  changes: DateChange[]
): WorkbackEvent[] {
  const map = new Map(changes.map((c) => [c.id, c]));
  return events.map((e) => {
    const c = map.get(e.id);
    return c ? { ...e, startDate: c.newStart, endDate: c.newEnd } : e;
  });
}

/**
 * A review round is a linked pair: Review (default 2 days — a 48h review
 * cycle) followed immediately by Revisions (default 2 days).
 */
export function createReviewRound(
  startKey: string,
  reviewCategory: Extract<CategoryId, "client-review" | "internal-review">,
  roundNumber: number,
  reviewDays = 2,
  revisionDays = 2
): WorkbackEvent[] {
  const roundId = uid();
  const review: WorkbackEvent = {
    id: uid(),
    title: `Review — Round ${roundNumber}`,
    startDate: startKey,
    endDate: addDaysKey(startKey, reviewDays - 1),
    category: reviewCategory,
    isMilestone: false,
    locked: false,
    roundId,
    roundRole: "review",
  };
  const revisions: WorkbackEvent = {
    id: uid(),
    title: `Revisions — Round ${roundNumber}`,
    startDate: addDaysKey(review.endDate, 1),
    endDate: addDaysKey(review.endDate, revisionDays),
    category: "post-production",
    isMilestone: false,
    locked: false,
    roundId,
    roundRole: "revisions",
  };
  return [review, revisions];
}

/** Copies a round's pair downstream, preserving its internal spacing. */
export function duplicateRound(
  events: WorkbackEvent[],
  roundId: string,
  nextRoundNumber: number
): WorkbackEvent[] {
  const pair = events.filter((e) => e.roundId === roundId).sort(sortKey);
  if (pair.length === 0) return [];
  const first = pair[0].startDate;
  const last = pair.reduce((m, e) => (e.endDate > m ? e.endDate : m), pair[0].endDate);
  const offset = durationDays(first, last);
  const newRoundId = uid();
  return pair.map((e) => ({
    ...shiftEvent(e, offset),
    id: uid(),
    roundId: newRoundId,
    title: e.title.replace(/Round \d+/, `Round ${nextRoundNumber}`),
  }));
}

export function countRounds(events: WorkbackEvent[]): number {
  return new Set(events.filter((e) => e.roundId).map((e) => e.roundId)).size;
}
