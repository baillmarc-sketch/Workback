import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export const WEEK_STARTS_ON = 1; // Monday — production schedules run Mon–Fri

export function toKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function fromKey(key: string): Date {
  return parse(key, "yyyy-MM-dd", new Date());
}

export function addDaysKey(key: string, days: number): string {
  return toKey(addDays(fromKey(key), days));
}

/** b - a in calendar days */
export function diffDays(a: string, b: string): number {
  return differenceInCalendarDays(fromKey(b), fromKey(a));
}

export function durationDays(startKey: string, endKey: string): number {
  return diffDays(startKey, endKey) + 1;
}

export function monthKey(d: Date): string {
  return format(d, "yyyy-MM");
}

export function monthFromKey(key: string): Date {
  return parse(key, "yyyy-MM", new Date());
}

export function addMonthsKey(key: string, n: number): string {
  return monthKey(addMonths(monthFromKey(key), n));
}

export function monthLabel(key: string): string {
  return format(monthFromKey(key), "MMMM yyyy");
}

export function fmtShort(key: string): string {
  return format(fromKey(key), "MMM d");
}

export function fmtLong(key: string): string {
  return format(fromKey(key), "EEE, MMM d, yyyy");
}

export interface WeekGrid {
  /** Keys of the 7 days, Monday-first */
  days: string[];
  start: string;
  end: string;
}

/** All weeks needed to display a month, each as 7 day keys */
export function weeksOfMonth(mKey: string): WeekGrid[] {
  const m = monthFromKey(mKey);
  const weekStarts = eachWeekOfInterval(
    { start: startOfMonth(m), end: endOfMonth(m) },
    { weekStartsOn: WEEK_STARTS_ON }
  );
  return weekStarts.map((ws) => {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) days.push(toKey(addDays(ws, i)));
    return { days, start: days[0], end: days[6] };
  });
}

export function isInMonth(dayKey: string, mKey: string): boolean {
  return dayKey.startsWith(mKey);
}

export function todayKey(): string {
  return toKey(new Date());
}

export function weekStartOf(dayKey: string): string {
  return toKey(startOfWeek(fromKey(dayKey), { weekStartsOn: WEEK_STARTS_ON }));
}

export function weekEndOf(dayKey: string): string {
  return toKey(endOfWeek(fromKey(dayKey), { weekStartsOn: WEEK_STARTS_ON }));
}

export function maxKey(a: string, b: string): string {
  return a > b ? a : b;
}

export function minKey(a: string, b: string): string {
  return a < b ? a : b;
}
