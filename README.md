# Workback Builder

A production workback calendar for producers, PMs, and creative teams. Build a timeline in
minutes, drag dates around as the project shifts, and export a client-ready PDF — no
spreadsheets, no decks, no backend.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

`npm run build && npm start` for a production build.
`npx tsx scripts/verify-logic.ts` runs sanity checks on the workback engine.

## What it does

**Calendar** — month grid (1, 2, or 3 months stacked), Sunday-first weeks, multi-day events
as horizontal bars, rows auto-expand with event density, "+N more" overflow popovers,
milestones with diamond markers always sorted to the top of their day.

**Events** — click an empty day to create; click an event to edit in place (title,
description, dates, category, milestone, lock). Drag to move, drag edges to resize,
duplicate, ⌘C/⌘V copy-paste (pastes under the cursor), Delete to remove. No save buttons —
everything commits immediately and auto-saves to localStorage.

Each event has an **Include weekends** checkbox (on by default). With weekends excluded,
the bar breaks around Sat/Sun while spanning as many weeks as needed, edges snap to
workdays, and moves/shifts/compressions preserve the event's *workday* count instead of
its calendar span.

**Workback logic**
- **Shift downstream** — hold `Shift` while dragging (or arm the toolbar toggle): every
  unlocked event starting on/after the moved event's original start shifts by the same
  delta. Events before it don't move.
- **Lock delivery date** — locked events never move. If a downstream shift would push the
  block into a locked date, the gap compresses proportionally and anything overlapping or
  left with < 1 day of buffer gets a red warning flag.
- **Compress / extend** — global action with a preview diff. With a locked delivery the
  redistribution anchors to the delivery date (true workback: the start moves, the delivery
  never does); without one it anchors to the project start.
- **Review rounds** — linked Review + Revisions pairs (48-hour cycle by default, durations
  editable), with "Duplicate round" to chain rounds downstream with the same spacing.
- **Undo** — ⌘Z / ⇧⌘Z, 20-step history, covers every destructive and multi-event action.

**Sharing & output**
- **Shared links (text someone the calendar)**: the Share button publishes the project to
  a Firebase Realtime Database and opens the native share sheet with a short link
  (`/#p=<id>`). Everyone who opens it edits the *same* calendar — changes push
  automatically (debounced) and pull when the tab regains focus. Last write wins; the
  unguessable share ID is the only access control, same model as a private link.
  If the cloud is unreachable or not configured, Share falls back to a long
  self-contained `#wb=` link (recipient gets an independent copy).
- Cloud config (`src/lib/cloud.ts`): defaults to the eggs Firebase RTDB, which needs this
  added to its rules in the Firebase console before short links work:
  `"workback": { ".read": true, ".write": true }`. Any RTDB works — override per-browser
  with `localStorage["workback:dbUrl"]` or edit the constant.
- Share codes: project → JSON → lz-string → URL-safe text. Paste into "Load from code" (or
  open `/#wb=<code>`). Also accepts raw project JSON. Warns above ~8 KB.
- Full project JSON export/import.
- **Export PDF** via the print pipeline (print CSS, not canvas screenshots): UI chrome
  stripped, project header + legend repeated on every page, one month per landscape page,
  exact category colors.

## Categories

Fixed list with one color each, used everywhere (bars, legend, exports): Creative,
Pre-Production, Production, Post Production, VFX, Finishing, Client Review, Internal
Review, Delivery / Launch.

## Stack & architecture

Next.js (App Router) + React + TypeScript, Tailwind CSS, dnd-kit, date-fns, lz-string.

- `src/lib/workback.ts` — pure workback engine (shift, lock compression, global
  compress/extend, review rounds, warning derivation). Unit-checked by
  `scripts/verify-logic.ts`.
- `src/lib/layout.ts` — week-lane layout (segments, lane packing, overflow). The view layer
  consumes plain layout data, so alternate layouts (timeline/Gantt, list) can be added
  later without touching the engine.
- `src/state/store.tsx` — project store with undo/redo history and debounced
  localStorage auto-save.
- `src/components/` — calendar, popovers, dialogs. Dates are `yyyy-MM-dd` strings
  throughout; all date math goes through date-fns.

Mobile is fully editable: tap a day to add, tap an event to edit in a bottom sheet,
long-press an event to drag it (a quick swipe still scrolls). V1 scope: month grid only,
no rich text, no auth.
