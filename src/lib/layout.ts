import type { WorkbackEvent } from "./types";
import { addDaysKey, diffDays, isWeekendKey, maxKey, minKey } from "./dates";

export interface Segment {
  event: WorkbackEvent;
  /** 0–6 column within the week */
  startCol: number;
  span: number;
  continuesLeft: boolean;
  continuesRight: boolean;
  lane: number;
}

export interface WeekLayout {
  segments: Segment[];
  /** Lanes actually rendered (<= MAX_LANES) */
  laneCount: number;
  /** dayKey -> events hidden behind "+N more" for that day */
  overflow: Map<string, WorkbackEvent[]>;
}

export const MAX_LANES = 6;

/**
 * Lay out all events intersecting a week into lanes. Milestones always sort
 * to the top of their day; remaining order is start date, then longer first.
 */
export function layoutWeek(
  events: WorkbackEvent[],
  weekStart: string,
  weekEnd: string
): WeekLayout {
  const intersecting = events.filter(
    (e) => e.startDate <= weekEnd && e.endDate >= weekStart
  );

  const sorted = [...intersecting].sort((a, b) => {
    if (a.isMilestone !== b.isMilestone) return a.isMilestone ? -1 : 1;
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
    const lenA = diffDays(a.startDate, a.endDate);
    const lenB = diffDays(b.startDate, b.endDate);
    if (lenA !== lenB) return lenB - lenA;
    return a.id < b.id ? -1 : 1;
  });

  // Greedy lane assignment: first lane with no column collision
  const laneCols: boolean[][] = [];
  const segments: Segment[] = [];
  const overflow = new Map<string, WorkbackEvent[]>();

  for (const e of sorted) {
    let segStart = maxKey(e.startDate, weekStart);
    let segEnd = minKey(e.endDate, weekEnd);

    // Weekend-skipping events: trim Sat/Sun off the segment so the bar
    // breaks around weekends (weekend days sit at the edges of a week)
    if (e.skipWeekends) {
      const rawStart = segStart;
      const rawEnd = segEnd;
      while (segStart <= segEnd && isWeekendKey(segStart)) segStart = addDaysKey(segStart, 1);
      while (segEnd >= segStart && isWeekendKey(segEnd)) segEnd = addDaysKey(segEnd, -1);
      if (segStart > segEnd) {
        // No workdays this week. If the event lives entirely inside this
        // week (legacy weekend-only data), show it untrimmed; otherwise skip.
        if (e.startDate >= weekStart && e.endDate <= weekEnd) {
          segStart = rawStart;
          segEnd = rawEnd;
        } else {
          continue;
        }
      }
    }

    const startCol = diffDays(weekStart, segStart);
    const span = diffDays(segStart, segEnd) + 1;

    let lane = 0;
    for (; lane < laneCols.length; lane++) {
      const cols = laneCols[lane];
      let free = true;
      for (let c = startCol; c < startCol + span; c++) {
        if (cols[c]) {
          free = false;
          break;
        }
      }
      if (free) break;
    }
    if (lane === laneCols.length) laneCols.push(new Array(7).fill(false));

    if (lane >= MAX_LANES) {
      // Hidden — record per day for the "+N more" popover
      for (let c = startCol; c < startCol + span; c++) {
        const dayKey = addCol(weekStart, c);
        const list = overflow.get(dayKey) ?? [];
        list.push(e);
        overflow.set(dayKey, list);
      }
      continue;
    }

    for (let c = startCol; c < startCol + span; c++) laneCols[lane][c] = true;
    segments.push({
      event: e,
      startCol,
      span,
      continuesLeft: e.startDate < weekStart,
      continuesRight: e.endDate > weekEnd,
      lane,
    });
  }

  return {
    segments,
    laneCount: Math.min(laneCols.length, MAX_LANES),
    overflow,
  };
}

function addCol(weekStart: string, col: number): string {
  // weekStart + col days; avoids importing addDaysKey circularly heavy paths
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + col);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
