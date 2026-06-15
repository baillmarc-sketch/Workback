import type { WorkbackEvent } from "./types";
import { durationDays } from "./dates";

/**
 * Same-day ordering: AM events first, EOD last, specific times in between
 * (chronological where parseable). A manual dayOrder — written when the user
 * drags blocks within a day — always wins and is never snapped back to time
 * order.
 */

/** "2:30 PM" | "9am" | "14:00" → minutes since midnight, else null */
export function parseTimeMinutes(raw: string): number | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(raw.trim());
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  if (minutes > 59) return null;
  const meridiem = m[3]?.toLowerCase();
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (hours === 12) hours = 0;
    if (meridiem === "pm") hours += 12;
  } else if (hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}

/** Band: 0 = AM, 1 = specific/freeform time, 2 = untimed, 3 = EOD */
export function timeBand(time?: string): 0 | 1 | 2 | 3 {
  const t = time?.trim().toLowerCase();
  if (!t) return 2;
  if (t === "am") return 0;
  if (t === "eod") return 3;
  return 1;
}

/** Default in-day rank for an event's time label */
export function timeRank(time?: string): number {
  const band = timeBand(time);
  const minutes = band === 1 ? (parseTimeMinutes(time!) ?? 9_999) : 0;
  return band * 10_000 + minutes;
}

/** Effective in-day sort key: manual order wins; defaults sort after manual */
export function inDayKey(e: WorkbackEvent): number {
  return e.dayOrder != null ? e.dayOrder : 1_000_000 + timeRank(e.time);
}

/**
 * Total order for events sharing a day. Milestones stay pinned on top only
 * while untouched — once a day is manually reordered every event in it has
 * an explicit dayOrder, so the milestone obeys the user's order too.
 */
export function compareSameDay(a: WorkbackEvent, b: WorkbackEvent): number {
  const pinA = a.isMilestone && a.dayOrder == null ? 0 : 1;
  const pinB = b.isMilestone && b.dayOrder == null ? 0 : 1;
  if (pinA !== pinB) return pinA - pinB;
  const ka = inDayKey(a);
  const kb = inDayKey(b);
  if (ka !== kb) return ka - kb;
  const lenA = durationDays(a.startDate, a.endDate);
  const lenB = durationDays(b.startDate, b.endDate);
  if (lenA !== lenB) return lenB - lenA;
  return a.id < b.id ? -1 : 1;
}
