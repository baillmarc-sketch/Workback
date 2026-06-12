export type CategoryId =
  | "creative"
  | "pre-production"
  | "production"
  | "post-production"
  | "vfx"
  | "finishing"
  | "client-review"
  | "internal-review"
  | "delivery";

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
  schema: 1;
  id: string;
  title: string;
  subtitle: string;
  notes: string;
  events: WorkbackEvent[];
  /** First visible month, yyyy-MM */
  anchorMonth: string;
  monthsVisible: 1 | 2 | 3;
  showLegend: boolean;
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
