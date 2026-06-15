import type { Project, ProjectCategory, ProjectSummary } from "./types";
import { uid } from "./types";
import { DEFAULT_CATEGORIES, PLACEHOLDER_COLOR, humanize } from "./categories";
import { templateById, type TemplateId } from "./templates";
import { monthKey, todayKey, addDaysKey } from "./dates";

const INDEX_KEY = "workback:index";
const PROJECT_PREFIX = "workback:project:";
const LAST_OPEN_KEY = "workback:lastOpen";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // quota exceeded / private mode — nothing useful to do
  }
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
  safeSet(PROJECT_PREFIX + project.id, JSON.stringify(project));
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

/** A small starter project so first launch isn't a blank wall. */
export function sampleProject(): Project {
  const p = newProject();
  p.title = "Sample Campaign";
  p.subtitle = "Client x Brand / Workback v1";
  const d0 = todayKey();
  const day = (n: number) => addDaysKey(d0, n);
  p.events = [
    { id: uid(), title: "Creative Development", startDate: day(0), endDate: day(4), category: "creative", isMilestone: false, locked: false },
    { id: uid(), title: "Pre-Pro & Casting", startDate: day(5), endDate: day(9), category: "pre-production", isMilestone: false, locked: false },
    { id: uid(), title: "Shoot Day", startDate: day(10), endDate: day(11), category: "production", isMilestone: true, locked: false },
    { id: uid(), title: "Offline Edit", startDate: day(12), endDate: day(17), category: "post-production", isMilestone: false, locked: false, skipWeekends: true },
    { id: uid(), title: "Client Review — Round 1", startDate: day(18), endDate: day(19), category: "client-review", isMilestone: false, locked: false },
    { id: uid(), title: "Finishing & Mix", startDate: day(20), endDate: day(23), category: "finishing", isMilestone: false, locked: false },
    { id: uid(), title: "Delivery", startDate: day(25), endDate: day(25), category: "delivery", isMilestone: true, locked: true },
  ];
  return p;
}
