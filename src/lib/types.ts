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
