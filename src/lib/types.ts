export type CategoryId = string;

/** A per-project label: events reference the id, so renames never touch events */
export interface ProjectCategory {
  id: string;
  label: string;
  /** Base color — the only saturated elements in the UI; text tones derive from it */
  color: string;
}

export interface WorkbackEvent {
  id: string;
  title: string;
  description?: string;
  /** Inclusive, yyyy-MM-dd */
  startDate: string;
  /** Inclusive, yyyy-MM-dd */
  endDate: string;
  category: CategoryId;
  isMilestone: boolean;
  locked: boolean;
  /** When true, the event covers workdays only — bars break around Sat/Sun
      and shifts preserve the workday count rather than the calendar span */
  skipWeekends?: boolean;
  /** Links the Review/Revisions pair of a review round */
  roundId?: string;
  roundRole?: "review" | "revisions";
  /** Time label: "AM", "EOD", or freeform like "2:30 PM" */
  time?: string;
  /** Manual same-day order override (single-day events); wins over time rank */
  dayOrder?: number;
}

/** A non-working day: an office closure or holiday. Greys out the day in the
    grid and print. PTO is modeled as a normal event/milestone, not a closure. */
export interface Closure {
  /** yyyy-MM-dd */
  date: string;
  /** Optional name shown on the day, e.g. "Thanksgiving" */
  label?: string;
}

export interface Project {
  schema: 2;
  id: string;
  title: string;
  subtitle: string;
  notes: string;
  /** Editable per-project label set; rename/recolor/add/delete in the legend */
  categories: ProjectCategory[];
  events: WorkbackEvent[];
  /** Office closures / holidays — non-working days greyed out on the calendar.
      A purely visual marker; PTO stays a normal event, not a closure. */
  closures?: Closure[];
  /** First visible month, yyyy-MM */
  anchorMonth: string;
  monthsVisible: 1 | 2 | 3;
  showLegend: boolean;
  /** Set when published to the shared cloud copy — the link channel ID */
  shareId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSummary {
  id: string;
  title: string;
  subtitle: string;
  updatedAt: number;
  eventCount: number;
}

export interface DateChange {
  id: string;
  title: string;
  category: CategoryId;
  oldStart: string;
  oldEnd: string;
  newStart: string;
  newEnd: string;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}
