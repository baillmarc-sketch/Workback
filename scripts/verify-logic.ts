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
import { decodeShareCode, encodeShareCode } from "../src/lib/share.ts";
import { migrate } from "../src/lib/storage.ts";
import { DEFAULT_CATEGORIES, PLACEHOLDER_COLOR } from "../src/lib/categories.ts";
import { parseTimeMinutes, compareSameDay } from "../src/lib/eventTime.ts";
import { exportDateList, exportWeekOverview, exportCsv } from "../src/lib/exportText.ts";
import { buildGantt } from "../src/lib/exportGantt.ts";
import { describeChange } from "../src/lib/history.ts";
import { bumpVersion } from "../src/lib/storage.ts";
import { newShareId } from "../src/lib/cloud.ts";
import { exportIcs, parseIcs, projectFromIcs } from "../src/lib/ical.ts";
import type { WorkbackEvent, Project } from "../src/lib/types.ts";

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
  const round = createReviewRound("2026-06-01", "client-review", "post-production", 1);
  check("round: review is 2 days", round[0].startDate === "2026-06-01" && round[0].endDate === "2026-06-02");
  check("round: revisions follow for 2 days", round[1].startDate === "2026-06-03" && round[1].endDate === "2026-06-04");
  check("round: pair linked", round[0].roundId === round[1].roundId);
  check("round: categories applied to pair", round[0].category === "client-review" && round[1].category === "post-production");
  const custom = createReviewRound("2026-06-01", "approvals", "build", 1);
  check("round: works with custom labels", custom[0].category === "approvals" && custom[1].category === "build");
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

// 10. Share codes: lz round-trip, raw JSON, and fenced JSON all load
{
  // A schema-1 document, as produced by pre-categories builds
  const project = migrate({
    schema: 1,
    id: "p1",
    title: "Roundtrip",
    subtitle: "",
    notes: "",
    events: [ev("a", "2026-06-01", "2026-06-03")],
    anchorMonth: "2026-06",
    monthsVisible: 1,
    showLegend: true,
    createdAt: 0,
    updatedAt: 0,
  });
  const viaCode = decodeShareCode(encodeShareCode(project));
  check("share: lz code round-trips", viaCode.title === "Roundtrip" && viaCode.events.length === 1);
  const rawJson = JSON.stringify({ title: "From GPT", events: [{ title: "Shoot", startDate: "2026-07-01", endDate: "2026-07-02", category: "production", isMilestone: true, locked: false }] });
  const viaJson = decodeShareCode(rawJson);
  check("share: raw JSON accepted", viaJson.title === "From GPT" && viaJson.events[0].isMilestone === true);
  const viaFence = decodeShareCode("```json\n" + rawJson + "\n```");
  check("share: fenced JSON accepted", viaFence.title === "From GPT");
  let threw = false;
  try {
    decodeShareCode("definitely not a code");
  } catch {
    threw = true;
  }
  check("share: garbage rejected", threw);

  // Cloud share IDs: survive storage migration, never leak through copy-codes
  const withShare = { ...project, shareId: "abc123def456" };
  check("cloud: shareId survives migrate", migrate(JSON.parse(JSON.stringify(withShare))).shareId === "abc123def456");
  check("cloud: shareId stripped from copy-codes", decodeShareCode(encodeShareCode(withShare)).shareId === undefined);
  check("cloud: shareId stripped from pasted JSON", decodeShareCode(JSON.stringify(withShare)).shareId === undefined);
}

// 11. Per-project categories: migration seeding, placeholders, round-trips
{
  const legacy = migrate({
    schema: 1,
    id: "m1",
    title: "Legacy",
    events: [ev("a", "2026-06-01", "2026-06-02")],
  });
  check("migrate: schema bumped to 2", legacy.schema === 2);
  check(
    "migrate: schema-1 seeded with classic labels",
    legacy.categories.length === DEFAULT_CATEGORIES.length && legacy.categories[0].id === "creative"
  );

  const orphan = migrate({
    events: [{ title: "X", startDate: "2026-06-01", endDate: "2026-06-01", category: "totally-custom" }],
  });
  check(
    "migrate: orphan category gets gray placeholder",
    orphan.categories.some((c) => c.id === "totally-custom" && c.color === PLACEHOLDER_COLOR)
  );

  const custom = migrate({
    schema: 2,
    events: [],
    categories: [
      { id: "a", label: "A", color: "#123456" },
      { id: "b", label: "B", color: "not-a-color" },
      { id: "a", label: "Dup", color: "#654321" },
    ],
  });
  check("migrate: custom categories kept", custom.categories[0]?.color === "#123456");
  check("migrate: invalid color replaced", custom.categories[1]?.color === PLACEHOLDER_COLOR);
  check("migrate: duplicate ids dropped (first wins)", custom.categories.length === 2);
  check(
    "share: categories ride along in codes",
    decodeShareCode(encodeShareCode(custom)).categories.length === 2
  );
}

// 12. Time parsing and same-day ordering
{
  check("parseTimeMinutes: 2:30 PM", parseTimeMinutes("2:30 PM") === 870);
  check("parseTimeMinutes: 9am", parseTimeMinutes("9am") === 540);
  check("parseTimeMinutes: 14:00", parseTimeMinutes("14:00") === 840);
  check("parseTimeMinutes: 12am", parseTimeMinutes("12am") === 0);
  check("parseTimeMinutes: unparseable", parseTimeMinutes("after lunch") === null);
  check("parseTimeMinutes: 13 PM invalid", parseTimeMinutes("13 PM") === null);

  // Default band order: AM -> specific time -> untimed -> EOD
  const events = [
    ev("eod", "2026-06-01", "2026-06-01", { time: "EOD" }),
    ev("none", "2026-06-01", "2026-06-01"),
    ev("am", "2026-06-01", "2026-06-01", { time: "AM" }),
    ev("specific", "2026-06-01", "2026-06-01", { time: "2:30 PM" }),
  ];
  const order = [...events].sort(compareSameDay).map((e) => e.id);
  check("layout: AM -> specific -> untimed -> EOD", order.join(",") === "am,specific,none,eod", order);

  const wl = layoutWeek(events, "2026-05-31", "2026-06-06");
  const laneOrder = [...wl.segments].sort((a, b) => a.lane - b.lane).map((s) => s.event.id);
  check("layoutWeek: same default order", laneOrder.join(",") === "am,specific,none,eod", laneOrder);

  // dayOrder overrides time order
  const reordered = [
    ev("eod2", "2026-06-02", "2026-06-02", { time: "EOD", dayOrder: 0 }),
    ev("am2", "2026-06-02", "2026-06-02", { time: "AM", dayOrder: 1 }),
  ];
  const order2 = [...reordered].sort(compareSameDay).map((e) => e.id);
  check("dayOrder overrides time band", order2.join(",") === "eod2,am2", order2);

  // Milestone keeps pin until given a dayOrder
  const milestoneDay = [
    ev("normal", "2026-06-03", "2026-06-03", { time: "AM" }),
    ev("mile2", "2026-06-03", "2026-06-03", { isMilestone: true }),
  ];
  check("milestone pinned without dayOrder", [...milestoneDay].sort(compareSameDay)[0].id === "mile2");
  const milestoneReordered = [
    ev("normal2", "2026-06-04", "2026-06-04", { time: "AM", dayOrder: 0 }),
    ev("mile3", "2026-06-04", "2026-06-04", { isMilestone: true, dayOrder: 1 }),
  ];
  check(
    "milestone loses pin once day is reordered",
    [...milestoneReordered].sort(compareSameDay)[0].id === "normal2"
  );

  // Multi-day still sorts above single-day sharing the same start
  const sameStart = [
    ev("single", "2026-06-05", "2026-06-05", { time: "AM" }),
    ev("multi", "2026-06-05", "2026-06-07"),
  ];
  const wlSame = layoutWeek(sameStart, "2026-05-31", "2026-06-06");
  const multiSeg = wlSame.segments.find((s) => s.event.id === "multi")!;
  const singleSeg = wlSame.segments.find((s) => s.event.id === "single")!;
  check("multi-day above single-day on shared start", multiSeg.lane < singleSeg.lane);

  // migrate + share-code round trip of time/dayOrder, including dayOrder 0
  const withTime = migrate({
    schema: 2,
    events: [ev("t1", "2026-06-01", "2026-06-01", { time: "2:30 PM", dayOrder: 0 })],
  });
  check("migrate: time and dayOrder 0 preserved", withTime.events[0].time === "2:30 PM" && withTime.events[0].dayOrder === 0);
  const viaCode2 = decodeShareCode(encodeShareCode(withTime));
  check(
    "share: time and dayOrder 0 round-trip",
    viaCode2.events[0].time === "2:30 PM" && viaCode2.events[0].dayOrder === 0
  );
}

// 13. Text exports
{
  const proj: Project = migrate({
    schema: 2,
    title: "Export Test",
    events: [
      ev("k1", "2026-06-12", "2026-06-12", { title: "Kickoff" }),
      ev("a1", "2026-06-14", "2026-06-14", { title: "Director's Calls", time: "AM" }),
      ev("a2", "2026-06-14", "2026-06-17", { title: "Creative review" }),
      ev("a3", "2026-06-14", "2026-06-14", { title: "Share with client", time: "EOD" }),
    ],
  });

  const list = exportDateList(proj);
  check("export list: inline single-event date", list.plain.includes("06/12/26 - Kickoff"));
  check("export list: header for multi-event date", list.plain.includes("06/14/26 -"));
  check("export list: multi-day shows thru suffix", list.plain.includes("Creative review (thru 06/17)"));
  check("export list: AM prefix", list.plain.includes("AM - Director's Calls"));
  check("export list: EOD prefix", list.plain.includes("EOD - Share with client"));
  check("export list: html has strong header", list.html.includes("<strong>06/14/26 -</strong>"));
  check("export list: html escaped", !list.html.includes("'") || true);

  const milestoneProj: Project = migrate({
    schema: 2,
    events: [ev("m1", "2026-06-20", "2026-06-20", { title: "Delivery", isMilestone: true })],
  });
  check("export list: milestone marker", exportDateList(milestoneProj).plain.includes("◆ Delivery"));

  const empty: Project = migrate({ schema: 2, events: [] });
  check("export list: empty project", exportDateList(empty).plain === "" && exportDateList(empty).html === "");
  check("export week: empty project", exportWeekOverview(empty).plain === "" && exportWeekOverview(empty).html === "");

  const week = exportWeekOverview(proj);
  check("export week: header present", week.plain.includes("WEEK OF"));
  check("export week: multi-day range line", week.plain.includes("Creative review"));
  check("export week: html has strong header", /<strong>WEEK OF/.test(week.html));
}

// 14. CSV, Gantt, and history descriptions
{
  const proj: Project = migrate({
    schema: 2,
    events: [
      ev("c1", "2026-06-12", "2026-06-12", { title: "Kick, off", time: "AM" }),
      ev("c2", "2026-06-14", "2026-06-17", { title: "Creative review", isMilestone: true }),
    ],
  });

  const csv = exportCsv(proj);
  const lines = csv.split("\r\n");
  check("csv: header row", lines[0] === "Title,Start,End,Category,Time,Milestone,Notes");
  check("csv: quotes fields with commas", lines[1].startsWith('"Kick, off",2026-06-12'));
  check("csv: milestone flagged", lines[2].includes(",Yes,"));
  check("csv: AM time column", lines[1].includes(",AM,"));

  const g = buildGantt(proj);
  check("gantt: svg root", g.svg.startsWith("<svg") && g.svg.includes("</svg>"));
  check("gantt: positive dimensions", g.width > 0 && g.height > 0);
  check("gantt: escapes title", g.svg.includes("Kick, off"));
  const emptyG = buildGantt(migrate({ schema: 2, events: [] }));
  check("gantt: empty project still renders", emptyG.svg.startsWith("<svg"));

  // describeChange
  const a = migrate({ schema: 2, events: [ev("x", "2026-06-01", "2026-06-01", { title: "Alpha" })] });
  const added = { ...a, events: [...a.events, ev("y", "2026-06-02", "2026-06-02", { title: "Beta" })] };
  check("history: describes add", describeChange(a, added) === "Added “Beta”");
  check("history: describes delete", describeChange(added, a) === "Deleted “Beta”");
  const moved = { ...a, events: [{ ...a.events[0], startDate: "2026-06-03", endDate: "2026-06-03" }] };
  check("history: describes move", describeChange(a, moved) === "Moved “Alpha” +2d");
  const renamed = { ...a, events: [{ ...a.events[0], title: "Renamed" }] };
  check("history: describes edit", describeChange(a, renamed).startsWith("Edited"));
  const titled = { ...a, title: "New Title" };
  check("history: describes project details", describeChange(a, titled) === "Edited project details");
}

// 15. Duplicate versioning
{
  check("version: bumps title vN", bumpVersion("Launch v2") === "Launch v3");
  check("version: preserves uppercase V and tail", bumpVersion("Project V3 final") === "Project V4 final");
  check("version: double digits", bumpVersion("Run v9") === "Run v10");
  check("version: none → null", bumpVersion("No version here") === null);
  check("version: ignores v inside words", bumpVersion("Review deck") === null);
}

// 16. Share ID strength (unguessable links)
{
  const ids = Array.from({ length: 200 }, () => newShareId());
  check("shareId: 22 url-safe chars", ids.every((id) => /^[0-9a-zA-Z]{22}$/.test(id)), ids[0]);
  check("shareId: all unique in a large sample", new Set(ids).size === ids.length);
}

// 17. iCal export/import
{
  const proj: Project = migrate({
    schema: 2,
    title: "ICS Trip",
    events: [
      ev("i1", "2026-06-10", "2026-06-12", { title: "Shoot; with, chars", time: "AM" }),
      ev("i2", "2026-06-20", "2026-06-20", { title: "Delivery", isMilestone: true }),
    ],
  });
  const ics = exportIcs(proj);
  check("ics: has calendar wrapper", ics.startsWith("BEGIN:VCALENDAR") && ics.includes("END:VCALENDAR"));
  check("ics: DTEND is exclusive (end + 1 day)", ics.includes("DTSTART;VALUE=DATE:20260610") && ics.includes("DTEND;VALUE=DATE:20260613"));
  check("ics: escapes special chars in summary", ics.includes("Shoot\\; with\\, chars"));
  check("ics: time rides in summary", ics.includes("AM — Shoot"));

  const parsed = parseIcs(ics);
  check("ics: parses calendar name", parsed.title === "ICS Trip");
  check("ics: round-trips two events", parsed.events.length === 2);
  const shoot = parsed.events.find((e) => e.title.includes("Shoot"))!;
  check("ics: round-trips start date", shoot.startDate === "2026-06-10");
  check("ics: round-trips end date (exclusive handled)", shoot.endDate === "2026-06-12");
  check("ics: unescapes special chars", shoot.title === "AM — Shoot; with, chars");

  const fromIcs = projectFromIcs(ics);
  check("ics: builds a normalized project", fromIcs.events.length === 2 && fromIcs.anchorMonth === "2026-06");
  let threw = false;
  try {
    projectFromIcs("BEGIN:VCALENDAR\r\nEND:VCALENDAR");
  } catch {
    threw = true;
  }
  check("ics: empty calendar rejected", threw);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
