/* End-to-end persistence checks: exercises the REAL storage/history/share code
   against a mocked localStorage to prove no field is lost on any save path.
   Run: npx tsx scripts/verify-persistence.ts */

// --- localStorage mock (must be installed before importing storage) ---
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

import {
  saveProject,
  loadProject,
  listProjects,
  duplicateProject,
  lastCategoryId,
  setLastCategoryId,
  migrate,
} from "../src/lib/storage.ts";
import { pushHistory, loadHistory, describeChange, clearHistory } from "../src/lib/history.ts";
import { encodeShareCode, decodeShareCode } from "../src/lib/share.ts";
import type { Project, WorkbackEvent } from "../src/lib/types.ts";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`✗ ${name}`, detail ?? "");
  } else {
    console.log(`✓ ${name}`);
  }
}

const EVENT_KEYS: (keyof WorkbackEvent)[] = [
  "id", "title", "description", "startDate", "endDate", "category",
  "isMilestone", "locked", "skipWeekends", "roundId", "roundRole", "time", "dayOrder",
];
function eventsEqual(a: WorkbackEvent[], b: WorkbackEvent[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((ev, i) => EVENT_KEYS.every((k) => ev[k] === b[i][k]));
}

// A project whose first event sets EVERY optional field (incl. dayOrder: 0)
const proj: Project = {
  schema: 2,
  id: "persist-test",
  title: "Persistence Test v1",
  subtitle: "Acme x Brand · v2",
  notes: "Notes line one\nNotes line two",
  categories: [
    { id: "creative", label: "Creative", color: "#7c3aed" },
    { id: "custom", label: "Custom Label", color: "#10b981" },
  ],
  events: [
    {
      id: "e1",
      title: "Full Event, with comma",
      description: "desc with, comma & <tag>",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      category: "custom",
      isMilestone: true,
      locked: true,
      skipWeekends: true,
      roundId: "r1",
      roundRole: "review",
      time: "2:30 PM",
      dayOrder: 0,
    },
    {
      id: "e2",
      title: "Plain single-day",
      startDate: "2026-06-15",
      endDate: "2026-06-15",
      category: "creative",
      isMilestone: false,
      locked: false,
    },
  ],
  anchorMonth: "2026-06",
  monthsVisible: 2,
  showLegend: true,
  shareId: "abc123def456",
  createdAt: 111,
  updatedAt: 222,
};

// 1. localStorage save → load (what every edit + reload does)
{
  saveProject(proj);
  const loaded = loadProject("persist-test");
  check("save/load: project returns", !!loaded);
  check("save/load: all event fields survive", !!loaded && eventsEqual(loaded.events, proj.events), loaded?.events);
  check("save/load: notes survive", loaded?.notes === proj.notes);
  check("save/load: subtitle survives", loaded?.subtitle === proj.subtitle);
  check("save/load: categories survive", loaded?.categories.length === 2 && loaded?.categories[1].color === "#10b981");
  check("save/load: monthsVisible survives", loaded?.monthsVisible === 2);
  check("save/load: shareId survives", loaded?.shareId === "abc123def456");
  check("save/load: createdAt survives", loaded?.createdAt === 111);
  check("save/load: appears in index", listProjects().some((s) => s.id === "persist-test" && s.eventCount === 2));
}

// 2. Duplicate: versioned, independent, lossless
{
  const copy = duplicateProject("persist-test");
  check("duplicate: returns a copy", !!copy);
  check("duplicate: bumps title version", copy?.title === "Persistence Test v2", copy?.title);
  check("duplicate: new id", !!copy && copy.id !== "persist-test");
  check("duplicate: share state cleared", copy?.shareId === undefined);
  check("duplicate: all event fields copied", !!copy && eventsEqual(copy.events, proj.events));
  // original untouched
  const orig = loadProject("persist-test");
  check("duplicate: original title unchanged", orig?.title === "Persistence Test v1");
  // the copy is itself persisted and reloadable
  const reloaded = copy ? loadProject(copy.id) : null;
  check("duplicate: copy is saved & reloadable", !!reloaded && eventsEqual(reloaded.events, proj.events));
}

// 3. History: snapshot store → load → restore is lossless, and coalesces bursts
{
  clearHistory("persist-test");
  pushHistory("persist-test", "Added Full Event", proj);
  const edited: Project = {
    ...proj,
    events: [{ ...proj.events[0], startDate: "2026-06-11", endDate: "2026-06-13" }, proj.events[1]],
  };
  pushHistory("persist-test", describeChange(proj, edited), edited);
  const hist = loadHistory("persist-test");
  check("history: two entries stored", hist.length === 2, hist.map((h) => h.label));
  check("history: latest snapshot is lossless", eventsEqual(hist[1].snapshot.events, edited.events));
  check("history: a restore returns every field", eventsEqual(hist[0].snapshot.events, proj.events));
  // coalescing: same label within the window collapses to one entry
  pushHistory("persist-test", "typing…", proj);
  pushHistory("persist-test", "typing…", edited);
  const hist2 = loadHistory("persist-test");
  check("history: rapid same-label edits coalesce", hist2.filter((h) => h.label === "typing…").length === 1);
}

// 4. Share code (copy/paste & #wb= links): lossless except the intentionally
//    stripped shareId
{
  const out = decodeShareCode(encodeShareCode(proj));
  check("share: event fields survive", eventsEqual(out.events, proj.events));
  check("share: categories survive", out.categories.length === 2);
  check("share: notes survive", out.notes === proj.notes);
  check("share: shareId stripped (by design)", out.shareId === undefined);
}

// 5. Cloud publish→fetch: RTDB drops undefined/empty arrays and we add a
//    _presence child — make sure neither corrupts the project on read
{
  const wire = JSON.parse(JSON.stringify({ ...proj, _presence: { s1: { name: "x", t: 1 } } }));
  const out = migrate({ events: [], ...wire });
  check("cloud: event fields survive round-trip", eventsEqual(out.events, proj.events));
  check("cloud: _presence child ignored", !("_presence" in out));
  const empty = migrate({ events: [], ...JSON.parse(JSON.stringify({ id: "z", updatedAt: 1 })) });
  check("cloud: zero-event project loads as empty", empty.events.length === 0);
}

// 6. lastCategory memory (new-event default) persists per project
{
  setLastCategoryId("persist-test", "custom");
  check("last-category: persists", lastCategoryId("persist-test") === "custom");
}

// 7. Quota safety net: if the project save hits quota, history is sacrificed
//    so the project itself never silently fails to save.
{
  const pid = "quota-test";
  const qp: Project = { ...proj, id: pid, title: "Quota v1" };
  saveProject(qp);
  pushHistory(pid, "Added", qp);
  check("quota: history exists before pressure", loadHistory(pid).length === 1);

  // Make the very next write to the project key throw once (simulated quota)
  const realSet = localStorage.setItem.bind(localStorage);
  let thrown = false;
  localStorage.setItem = (k: string, v: string) => {
    if (!thrown && k === "workback:project:" + pid) {
      thrown = true;
      throw new DOMException("QuotaExceededError");
    }
    return realSet(k, v);
  };
  const edited: Project = { ...qp, title: "Quota v1 edited", updatedAt: 999 };
  saveProject(edited);
  localStorage.setItem = realSet;

  const reloaded = loadProject(pid);
  check("quota: project still saved despite quota error", reloaded?.title === "Quota v1 edited", reloaded?.title);
  check("quota: history dropped to free space", loadHistory(pid).length === 0);
}

console.log(failures === 0 ? "\nAll persistence checks passed." : `\n${failures} persistence check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
