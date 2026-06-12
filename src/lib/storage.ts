import type { Project, ProjectSummary } from "./types";
import { uid } from "./types";
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

export function saveProject(project: Project): void {
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
  safeSet(LAST_OPEN_KEY, project.id);
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

export function migrate(data: unknown): Project {
  const p = data as Partial<Project>;
  if (!p || !Array.isArray(p.events)) throw new Error("Not a Workback project");
  return {
    schema: 1,
    id: typeof p.id === "string" ? p.id : uid(),
    title: p.title ?? "Untitled Workback",
    subtitle: p.subtitle ?? "",
    notes: p.notes ?? "",
    events: p.events.map((e) => ({
      id: e.id ?? uid(),
      title: e.title ?? "Untitled",
      description: e.description,
      startDate: e.startDate,
      endDate: e.endDate ?? e.startDate,
      category: e.category ?? "creative",
      isMilestone: !!e.isMilestone,
      locked: !!e.locked,
      roundId: e.roundId,
      roundRole: e.roundRole,
    })),
    anchorMonth: p.anchorMonth ?? monthKey(new Date()),
    monthsVisible: p.monthsVisible === 2 || p.monthsVisible === 3 ? p.monthsVisible : 1,
    showLegend: p.showLegend ?? true,
    createdAt: p.createdAt ?? Date.now(),
    updatedAt: p.updatedAt ?? Date.now(),
  };
}

export function newProject(): Project {
  const now = Date.now();
  return {
    schema: 1,
    id: uid(),
    title: "Untitled Workback",
    subtitle: "",
    notes: "",
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
    { id: uid(), title: "Offline Edit", startDate: day(12), endDate: day(17), category: "post-production", isMilestone: false, locked: false },
    { id: uid(), title: "Client Review — Round 1", startDate: day(18), endDate: day(19), category: "client-review", isMilestone: false, locked: false },
    { id: uid(), title: "Finishing & Mix", startDate: day(20), endDate: day(23), category: "finishing", isMilestone: false, locked: false },
    { id: uid(), title: "Delivery", startDate: day(25), endDate: day(25), category: "delivery", isMilestone: true, locked: true },
  ];
  return p;
}
