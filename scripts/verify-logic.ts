/* Sanity checks for the workback engine. Run: node --experimental-strip-types scripts/verify-logic.ts */
import {
  moveEvent,
  resizeEvent,
  compressTimeline,
  applyChanges,
  warningIds,
  createReviewRound,
  duplicateRound,
} from "../src/lib/workback.ts";
import { layoutWeek } from "../src/lib/layout.ts";
import type { WorkbackEvent } from "../src/lib/types.ts";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`✗ ${name}`, detail ?? "");
  } else {
    console.log(`✓ ${name}`);
  }
}

function ev(id: string, start: string, end: string, extra: Partial<WorkbackEvent> = {}): WorkbackEvent {
  return {
    id,
    title: id,
    startDate: start,
    endDate: end,
    category: "creative",
    isMilestone: false,
    locked: false,
    ...extra,
  };
}

const base = [
  ev("a", "2026-06-01", "2026-06-03"),
  ev("b", "2026-06-05", "2026-06-08"),
  ev("c", "2026-06-10", "2026-06-12"),
  ev("d", "2026-06-20", "2026-06-20", { locked: true }),
];

// 1. Plain move: only the moved event changes
{
  const out = moveEvent(base, "b", 2, false);
  check("plain move shifts only target", out[1].startDate === "2026-06-07" && out[0].startDate === "2026-06-01" && out[2].startDate === "2026-06-10");
}

// 2. Downstream shift: b and c move, a stays, locked d stays
{
  const out = moveEvent(base, "b", 2, true);
  check("downstream: upstream untouched", out[0].startDate === "2026-06-01");
  check("downstream: target moved", out[1].startDate === "2026-06-07");
  check("downstream: later events moved", out[2].startDate === "2026-06-12");
  check("downstream: locked never moves", out[3].startDate === "2026-06-20");
}

// 3. Downstream shift into a lock compresses the gap proportionally
{
  const out = moveEvent(base, "b", 8, true);
  const d = out.find((e) => e.id === "d")!;
  const c = out.find((e) => e.id === "c")!;
  const b = out.find((e) => e.id === "b")!;
  check("lock compression: lock fixed", d.startDate === "2026-06-20");
  check("lock compression: block start respects delta", b.startDate === "2026-06-13", b.startDate);
  check("lock compression: c squeezed before lock", c.startDate > "2026-06-13" && c.startDate < "2026-06-20", c.startDate);
}

// 4. Warnings: overlap with lock or < 1 day buffer
{
  const tight = [ev("x", "2026-06-18", "2026-06-19"), ev("y", "2026-06-10", "2026-06-11"), ev("L", "2026-06-20", "2026-06-20", { locked: true })];
  const w = warningIds(tight);
  check("warning: zero-buffer event flagged", w.has("x"));
  check("warning: distant event not flagged", !w.has("y"));
  const overlap = [ev("x", "2026-06-19", "2026-06-21"), ev("L", "2026-06-20", "2026-06-20", { locked: true })];
  check("warning: overlap flagged", warningIds(overlap).has("x"));
}

// 5. Compress timeline anchored to locked delivery: delivery fixed, start moves later
{
  const changes = compressTimeline(base, -6);
  const out = applyChanges(base, changes);
  check("compress: locked delivery unchanged", out[3].startDate === "2026-06-20");
  check("compress: first event moved later", out[0].startDate > "2026-06-01", out[0].startDate);
  const durA = base[0], newA = out[0];
  check(
    "compress: durations preserved",
    Date.parse(newA.endDate) - Date.parse(newA.startDate) === Date.parse(durA.endDate) - Date.parse(durA.startDate)
  );
}

// 6. Extend with no lock: anchored at start, last event moves later
{
  const noLock = base.slice(0, 3);
  const out = applyChanges(noLock, compressTimeline(noLock, 9));
  check("extend: anchor start fixed", out[0].startDate === "2026-06-01");
  check("extend: last event pushed out", out[2].startDate === "2026-06-19", out[2].startDate);
}

// 7. Review rounds: linked pair, revisions follow review immediately
{
  const round = createReviewRound("2026-06-01", "client-review", 1);
  check("round: review is 2 days", round[0].startDate === "2026-06-01" && round[0].endDate === "2026-06-02");
  check("round: revisions follow for 2 days", round[1].startDate === "2026-06-03" && round[1].endDate === "2026-06-04");
  check("round: pair linked", round[0].roundId === round[1].roundId);
  const dup = duplicateRound(round, round[0].roundId!, 2);
  check("dup round: placed downstream with same spacing", dup[0].startDate === "2026-06-05" && dup[1].startDate === "2026-06-07", dup.map((e) => e.startDate));
  check("dup round: renumbered", dup[0].title.includes("Round 2"));
}

// 8. Week layout: milestone sorts to top lane, lanes don't collide
{
  const events = [
    ev("long", "2026-06-01", "2026-06-05"),
    ev("mile", "2026-06-03", "2026-06-03", { isMilestone: true }),
    ev("other", "2026-06-03", "2026-06-04"),
  ];
  const wl = layoutWeek(events, "2026-06-01", "2026-06-07");
  const mile = wl.segments.find((s) => s.event.id === "mile")!;
  check("layout: milestone on top lane", mile.lane === 0, wl.segments.map((s) => [s.event.id, s.lane]));
  const byLaneCol = new Set(wl.segments.flatMap((s) => Array.from({ length: s.span }, (_, i) => `${s.lane}:${s.startCol + i}`)));
  check("layout: no lane collisions", byLaneCol.size === wl.segments.reduce((n, s) => n + s.span, 0));
}

// 9. Weekend-skipping events (2026-06-01 is a Monday, 2026-05-31 a Sunday)
{
  const wk = [ev("w", "2026-06-01", "2026-06-05", { skipWeekends: true })]; // Mon–Fri, 5 workdays
  const fwd = moveEvent(wk, "w", 2, false)[0];
  check("skip-weekends: +2 keeps 5 workdays over the weekend", fwd.startDate === "2026-06-03" && fwd.endDate === "2026-06-09", [fwd.startDate, fwd.endDate]);
  const back = moveEvent(wk, "w", -1, false)[0];
  check("skip-weekends: -1 from Monday snaps back to Friday", back.startDate === "2026-05-29" && back.endDate === "2026-06-04", [back.startDate, back.endDate]);

  const resized = resizeEvent(wk, "w", "end", "2026-06-06")[0]; // Saturday → Friday
  check("skip-weekends: resize end onto Saturday snaps to Friday", resized.endDate === "2026-06-05", resized.endDate);

  // Sunday-first week containing the whole range: bar trims to Mon–Fri
  const wl = layoutWeek(
    [ev("w2", "2026-05-31", "2026-06-06", { skipWeekends: true })],
    "2026-05-31",
    "2026-06-06"
  );
  check("skip-weekends: segment trimmed to Mon–Fri", wl.segments.length === 1 && wl.segments[0].startCol === 1 && wl.segments[0].span === 5, wl.segments.map((s) => [s.startCol, s.span]));

  const inclusive = layoutWeek([ev("w3", "2026-05-31", "2026-06-06")], "2026-05-31", "2026-06-06");
  check("weekends included: segment spans full week", inclusive.segments[0].startCol === 0 && inclusive.segments[0].span === 7);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
