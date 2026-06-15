# Workback Builder

A production workback calendar for producers, PMs, and creative teams. Build a timeline in
minutes, drag dates around as the project shifts, and export a client-ready PDF — no
spreadsheets, no decks, no backend.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

`npm run build` produces the static export in `out/`, deployed to Firebase Hosting by
the GitHub Action on pushes to `main` (needs the `FIREBASE_SERVICE_ACCOUNT` repo secret).
`npm run build:pages` rebuilds `docs/` for the legacy GitHub Pages URL.
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
- **Undo** — ⌘Z / ⇧⌘Z, 20-step in-memory stack, covers every destructive and multi-event
  action.
- **History** — a persistent, browsable log (the History button) with human-readable
  entries ("Moved Shoot Day +2d", "Added Kickoff") and a Restore button on each. It's
  saved (compressed) per project so you can keep rolling back even after a reload;
  restoring is itself undoable.
- **Call times** — give an event "AM", "EOD", or a specific time (e.g. "2:30 PM") via
  "+ Add time" in its popover. AM events sort first within their day, EOD last. Drag
  blocks within a day to reorder them manually — manual order always wins and is never
  snapped back to time order.
- **New-event color** defaults to the category you last used, with an instant label tag
  under the swatches (no slow hover tooltip).
- **Live presence** — on a shared calendar, a banner shows when other people have it open
  and are editing right now (lightweight heartbeat; identifies people by first name only —
  never email — and needs no rules change).

**Sharing & output**
- **Automatic online backup**: as soon as a project has content, it's backed up to the
  cloud under an unguessable link, so work survives a crash or power loss and a share link
  already exists before you press Share. The tab also flushes the latest state to
  localStorage on hide/close so the autosave debounce can't drop the last edit.
- **Shared links**: the **Share** button copies the short link (`/#p=<id>`) to the
  clipboard and opens the sharing menu (no native share sheet). Everyone who opens it edits
  the *same* calendar — changes push automatically (debounced) and pull when the tab
  regains focus. Last write wins; the unguessable share ID (~131-bit, bias-free) is the
  only access control, same model as a "anyone with the link" Drive file. If the cloud is
  unreachable, it falls back to a long self-contained `#wb=` link.
- **Reset link** (in the Share menu) revokes the current link — it deletes the cloud node
  and mints a new id, so old links stop working while the project stays backed up under the
  new one.
- **Accounts (optional)**: Sign in with Google (header button) and your project list syncs
  across devices under `/users/{uid}` in the Workback Firebase project — per-project
  last-write-wins on login and tab focus, deletions propagate via tombstones. The app is
  fully usable signed out (localStorage only), and shared links never require an account.
- Cloud config (`src/lib/firebase.ts` + `src/lib/cloud.ts`): the Workback Firebase
  project's RTDB, rules in `database.rules.json` (shared docs open, the unguessable ID is
  the secret; user data auth-gated). Links minted before the migration are read once from
  the legacy eggs DB and adopted into the new one. Override the DB per-browser with
  `localStorage["workback:dbUrl"]`.
- Share codes: project → JSON → lz-string → URL-safe text. Paste into "Load from code" (or
  open `/#wb=<code>`). Also accepts raw project JSON. Warns above ~8 KB.
- Full project JSON export/import (in the Share menu).
- **Export** button opens a dialog with four formats:
  - **List by date** — e.g. `06/12/26 - Kickoff`, with `AM -`/`EOD -` prefixes and
    multi-day events shown once as "(thru MM/DD)".
  - **Week overview** — `WEEK OF 06/08/26` + one line per event.
    (Both copy as formatted rich text with a plain-text fallback, so they paste cleanly
    into email or Teams.)
  - **Gantt** — a horizontal timeline (inline SVG: one row per event, bars across a date
    axis) with a **Download PNG** button for slides/Teams.
  - **Spreadsheet** — a **Download CSV** (Title, Start, End, Category, Time, Milestone,
    Notes) that opens in Excel/Sheets.
  - **Calendar (.ics)** — a **Download .ics** (all-day VEVENTs, call time in the SUMMARY)
    to import into Outlook/Google/Apple Calendar. You can also **Import .ics…** from the
    Share menu to open an external calendar as a new workback.
- **Print / PDF** button prints every month that actually contains events — full month,
  one per landscape page, with a large month heading — independent of the 1/2/3-month
  on-screen view. Uses the print pipeline (print CSS, not canvas screenshots): UI chrome
  stripped, project header + legend repeated on every page, exact category colors.

## Labels (categories)

Each project carries its own editable label set, used everywhere (bars, legend,
exports). Click a legend chip to rename, recolor (freeform color picker), or delete a
label; "+ Add label" appends one. New projects start from a template — **Video
production** (Creative, Pre-Production, Production, Post Production, VFX, Finishing,
Client Review, Internal Review, Delivery / Launch), **Event / activation** (Planning,
Vendors & Booking, Permits, Promo / Marketing, Build & Setup, Show Day, Strike / Wrap,
Approvals), or **Blank**. Older schema-1 projects and share codes migrate automatically,
seeded with the classic video palette.

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
