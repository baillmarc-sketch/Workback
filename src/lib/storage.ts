import type { Project, ProjectCategory, ProjectSummary } from "./types";
import { uid } from "./types";
import { DEFAULT_CATEGORIES, PLACEHOLDER_COLOR, humanize } from "./categories";
import { templateById, type TemplateId } from "./templates";
import { monthKey, todayKey, addDaysKey } from "./dates";

const INDEX_KEY = "workback:index";
const PROJECT_PREFIX = "workback:project:";
const LAST_OPEN_KEY = "workback:lastOpen";
const LAST_CATEGORY_PREFIX = "workback:lastCategory:";
// Mirrors history.ts PREFIX — kept literal to avoid an import cycle. Used only
// to reclaim space if a project save hits quota (project data wins).
const HISTORY_PREFIX = "workback:history:";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function trySet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeSet(key: string, value: string): void {
  trySet(key, value);
}

export function listProjects(): ProjectSummary[] {
  const raw = safeGet(INDEX_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as ProjectSummary[];
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function loadProject(id: string): Project | null {
  const raw = safeGet(PROJECT_PREFIX + id);
  if (!raw) return null;
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveProject(project: Project, opts: { setLastOpen?: boolean } = {}): void {
  const key = PROJECT_PREFIX + project.id;
  const data = JSON.stringify(project);
  if (!trySet(key, data)) {
    // Out of space: history snapshots are the largest, most disposable thing —
    // drop this project's history so the project itself never fails to save.
    try {
      localStorage.removeItem(HISTORY_PREFIX + project.id);
    } catch {}
    trySet(key, data);
  }
  const index = listProjects().filter((p) => p.id !== project.id);
  index.unshift({
    id: project.id,
    title: project.title,
    subtitle: project.subtitle,
    updatedAt: project.updatedAt,
    eventCount: project.events.length,
  });
  safeSet(INDEX_KEY, JSON.stringify(index));
  // Background account syncs save quietly so they don't hijack which
  // project reopens on the next visit
  if (opts.setLastOpen !== false) safeSet(LAST_OPEN_KEY, project.id);
}

export function deleteProject(id: string): void {
  try {
    localStorage.removeItem(PROJECT_PREFIX + id);
  } catch {}
  safeSet(INDEX_KEY, JSON.stringify(listProjects().filter((p) => p.id !== id)));
}

export function lastOpenId(): string | null {
  return safeGet(LAST_OPEN_KEY);
}

/** Remember the last category used when creating an event, per project, so
    new events default to the color you just used rather than the first one. */
export function lastCategoryId(projectId: string): string | null {
  return safeGet(LAST_CATEGORY_PREFIX + projectId);
}

export function setLastCategoryId(projectId: string, categoryId: string): void {
  safeSet(LAST_CATEGORY_PREFIX + projectId, categoryId);
}

/** Bump the last "vN" token in a string, e.g. "Launch v2" → "Launch v3"
    (case of the v is preserved). Returns null when there's nothing to bump. */
export function bumpVersion(text: string): string | null {
  const re = /\bv(\d+)/gi;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) last = m;
  if (!last) return null;
  const n = parseInt(last[1], 10) + 1;
  const start = last.index;
  return text.slice(0, start) + text[start] + n + text.slice(start + last[0].length);
}

/** Clone a saved project into an independent copy. Versioning is automatic:
    an existing "vN" in the title (or, failing that, the subtitle) is bumped by
    one; otherwise the title gets a "v2" (the original being the implied v1). */
export function duplicateProject(id: string): Project | null {
  const src = loadProject(id);
  if (!src) return null;
  const now = Date.now();
  let title = src.title || "Untitled Workback";
  let subtitle = src.subtitle;
  const bumpedTitle = bumpVersion(title);
  if (bumpedTitle !== null) {
    title = bumpedTitle;
  } else {
    const bumpedSub = bumpVersion(subtitle);
    if (bumpedSub !== null) subtitle = bumpedSub;
    else title = `${title} v2`;
  }
  const copy: Project = {
    ...src,
    id: uid(),
    title,
    subtitle,
    shareId: undefined,
    createdAt: now,
    updatedAt: now,
    categories: src.categories.map((c) => ({ ...c })),
    events: src.events.map((e) => ({ ...e })),
  };
  saveProject(copy);
  return copy;
}

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

function migrateCategories(raw: unknown, events: Project["events"]): ProjectCategory[] {
  const seen = new Set<string>();
  const categories: ProjectCategory[] = [];
  if (Array.isArray(raw)) {
    for (const c of raw as Partial<ProjectCategory>[]) {
      if (!c || typeof c.id !== "string" || !c.id || seen.has(c.id)) continue;
      seen.add(c.id);
      categories.push({
        id: c.id,
        label: typeof c.label === "string" && c.label ? c.label : humanize(c.id),
        color: typeof c.color === "string" && HEX_COLOR.test(c.color) ? c.color : PLACEHOLDER_COLOR,
      });
    }
  }
  // Schema-1 projects (and anything without categories) get the classic set
  if (categories.length === 0) {
    for (const c of DEFAULT_CATEGORIES) {
      seen.add(c.id);
      categories.push({ ...c });
    }
  }
  // Orphaned event categories (hand-edited / LLM JSON) get gray placeholders
  for (const e of events) {
    if (!seen.has(e.category)) {
      seen.add(e.category);
      categories.push({ id: e.category, label: humanize(e.category), color: PLACEHOLDER_COLOR });
    }
  }
  return categories;
}

export function migrate(data: unknown): Project {
  const p = data as Partial<Project>;
  if (!p || !Array.isArray(p.events)) throw new Error("Not a Workback project");
  const fallbackCategory =
    (Array.isArray(p.categories) && p.categories[0]?.id) || DEFAULT_CATEGORIES[0].id;
  const events = p.events.map((e) => ({
    id: e.id ?? uid(),
    title: e.title ?? "Untitled",
    description: e.description,
    startDate: e.startDate,
    endDate: e.endDate ?? e.startDate,
    category: e.category ?? fallbackCategory,
    isMilestone: !!e.isMilestone,
    locked: !!e.locked,
    skipWeekends: e.skipWeekends ? true : undefined,
    roundId: e.roundId,
    roundRole: e.roundRole,
    time: typeof e.time === "string" && e.time.trim() ? e.time : undefined,
    dayOrder: typeof e.dayOrder === "number" && Number.isFinite(e.dayOrder) ? e.dayOrder : undefined,
  }));
  return {
    schema: 2,
    id: typeof p.id === "string" ? p.id : uid(),
    title: p.title ?? "Untitled Workback",
    subtitle: p.subtitle ?? "",
    notes: p.notes ?? "",
    categories: migrateCategories(p.categories, events),
    events,
    anchorMonth: p.anchorMonth ?? monthKey(new Date()),
    monthsVisible: p.monthsVisible === 2 || p.monthsVisible === 3 ? p.monthsVisible : 1,
    showLegend: p.showLegend ?? true,
    shareId: typeof p.shareId === "string" && p.shareId ? p.shareId : undefined,
    createdAt: p.createdAt ?? Date.now(),
    updatedAt: p.updatedAt ?? Date.now(),
  };
}

export function newProject(templateId: TemplateId = "video"): Project {
  const now = Date.now();
  return {
    schema: 2,
    id: uid(),
    title: "Untitled Workback",
    subtitle: "",
    notes: "",
    categories: templateById(templateId).categories.map((c) => ({ ...c })),
    events: [],
    anchorMonth: monthKey(new Date()),
    monthsVisible: 1,
    showLegend: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** A fuller starter project that shows off the app at a glance: call times,
    stacked same-day events, two linked client-review rounds, a PPM, generous
    edit/production lead, weekend-skipping blocks, and a locked delivery. */
export function sampleProject(): Project {
  const p = newProject();
  p.title = "Sample Campaign";
  p.subtitle = "Acme x Brand · Workback v1";
  const start = addDaysKey(todayKey(), -7);
  const day = (n: number) => addDaysKey(start, n);
  const r1 = uid();
  const r2 = uid();
  p.events = [
    { id: uid(), title: "Creative Kickoff", startDate: day(0), endDate: day(0), category: "creative", isMilestone: true, locked: false, time: "AM" },
    { id: uid(), title: "Creative Development", startDate: day(1), endDate: day(8), category: "creative", isMilestone: false, locked: false },
    { id: uid(), title: "Internal Creative Review", startDate: day(9), endDate: day(9), category: "internal-review", isMilestone: false, locked: false, time: "AM" },
    { id: uid(), title: "Creative Lock", startDate: day(9), endDate: day(9), category: "internal-review", isMilestone: false, locked: false, time: "EOD" },
    { id: uid(), title: "Pre-Pro & Casting", startDate: day(10), endDate: day(18), category: "pre-production", isMilestone: false, locked: false, skipWeekends: true },
    { id: uid(), title: "Location Scout", startDate: day(12), endDate: day(12), category: "pre-production", isMilestone: false, locked: false, time: "1:00 PM" },
    { id: uid(), title: "PPM — Pre-Production Meeting", startDate: day(17), endDate: day(17), category: "pre-production", isMilestone: true, locked: false, time: "AM" },
    { id: uid(), title: "Call Sheet Out", startDate: day(20), endDate: day(20), category: "production", isMilestone: false, locked: false, time: "EOD" },
    { id: uid(), title: "Crew Call", startDate: day(21), endDate: day(21), category: "production", isMilestone: false, locked: false, time: "AM" },
    { id: uid(), title: "Shoot Days", startDate: day(21), endDate: day(22), category: "production", isMilestone: false, locked: false },
    { id: uid(), title: "Production Wrap", startDate: day(22), endDate: day(22), category: "production", isMilestone: true, locked: false, time: "EOD" },
    { id: uid(), title: "Offline Edit", startDate: day(25), endDate: day(39), category: "post-production", isMilestone: false, locked: false, skipWeekends: true },
    { id: uid(), title: "Client Review — Round 1", startDate: day(40), endDate: day(41), category: "client-review", isMilestone: false, locked: false, time: "AM", roundId: r1, roundRole: "review" },
    { id: uid(), title: "Revisions — Round 1", startDate: day(42), endDate: day(43), category: "post-production", isMilestone: false, locked: false, roundId: r1, roundRole: "revisions" },
    { id: uid(), title: "Client Review — Round 2", startDate: day(44), endDate: day(45), category: "client-review", isMilestone: false, locked: false, time: "AM", roundId: r2, roundRole: "review" },
    { id: uid(), title: "Revisions — Round 2", startDate: day(46), endDate: day(47), category: "post-production", isMilestone: false, locked: false, roundId: r2, roundRole: "revisions" },
    { id: uid(), title: "VFX / Online", startDate: day(48), endDate: day(52), category: "vfx", isMilestone: false, locked: false, skipWeekends: true },
    { id: uid(), title: "Color Grade", startDate: day(50), endDate: day(52), category: "finishing", isMilestone: false, locked: false },
    { id: uid(), title: "Audio Mix", startDate: day(53), endDate: day(54), category: "finishing", isMilestone: false, locked: false },
    { id: uid(), title: "Final Client Approval", startDate: day(55), endDate: day(55), category: "client-review", isMilestone: true, locked: false, time: "AM" },
    { id: uid(), title: "Delivery", startDate: day(57), endDate: day(57), category: "delivery", isMilestone: true, locked: true, time: "EOD" },
  ];
  return p;
}
