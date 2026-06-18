# Line Producer Review (Domain Correctness & Workflow)

## Reviewer role & scope

I reviewed Workback Builder as a working Line Producer — the person who builds the
workback, owns the budget line-by-line, tracks actuals against POs/invoices, and lives
with the schedule when the shoot date slips. My lens is domain correctness and workflow
trust, not code style. I read the README and verified behavior directly in the engine:
`src/lib/workback.ts` (scheduling), `src/lib/dates.ts`, `src/lib/eventTime.ts`,
`src/lib/estimator/{totals,formula,currencies,types,format,templates}.ts`, and
`src/lib/bidSpecs/{types,clauses,export}.ts`. Findings reference the file and the
real-world scenario they break. This is a pre-beta battle test, so I weight "could it
silently produce a wrong date or number" above polish.

## Executive summary

The bones are genuinely good: the workback engine is a small, pure, well-tested module
that gets the hard, scary parts right — locked delivery dates never move, true workback
anchors to delivery, weekend-skipping preserves workday counts, and warnings explain
themselves. The bid specs module is the most domain-faithful piece in the app: it mirrors
a real AICP spec sheet (A/P/E/O providers, format flags, clause library, usage matrix)
closely enough that a producer could send it tomorrow. The two areas that will bite real
productions are (1) the calendar's blindness to holidays/closures during scheduling —
the data model has a `Closure` type but the engine ignores it, so every shift and
compression will happily land work on Thanksgiving or a national holiday and silently
miscount duration; and (2) the estimator's flat, additive adjustment model — markup,
contingency, insurance, and tax are all computed off the same raw subtotal and summed,
so the tool cannot represent the compounding (markup-then-tax) that real budgets and tax
authorities require, and there is no concept of fringes/P&W as a calculated line, no
per-vendor currency, and no change-order trail. Both are correctness issues, not feature
gaps, and both can produce a number/date a client signs off on that is quietly wrong.

## What works like the real job

- **Locked delivery is truly immovable.** `moveEvent` (workback.ts:48-49) refuses to move
  a locked event and treats the nearest downstream lock as a wall. `compressTimeline`
  anchors redistribution to the *last lock's start* and dates flow backward (workback.ts:164-174).
  That is exactly how a producer thinks: air date is fixed, everything upstream gives.
- **Downstream shift respects the cut line.** Only events starting on/after the moved
  event's original start move; upstream work stays put (workback.ts:55-70). This matches
  "the shoot slipped two days, push everything after it" without disturbing locked-in prep.
- **Weekend-skipping preserves workday count, not calendar span** (`shiftEvent`
  workback.ts:13-28, `change` :190-209). A 5-workday edit dragged across a weekend stays
  5 workdays. This is the single most common spreadsheet error in real workbacks and the
  tool gets it right, including snapping edges off weekends in the direction of travel.
- **Warnings explain themselves.** `warnings` (workback.ts:112-133) returns a
  human-readable reason naming the lock and dates, surfaced on hover and in the popover.
  A producer can defend the flag to a client instead of guessing.
- **Bid specs are real.** The clause library (clauses.ts) is genuinely on the money:
  cost-plus-15% P&W bid below the line, overage approval "by the morning after each shoot
  day," 50/50 vs 75/25 payment, FX locks on award date, AI disclosure, weather
  contingency, intimacy coordinator. The A/P/E/O provider checklist and AICP form
  reference mirror what agency producers actually send.
- **Safe formula cells.** The estimator's expression evaluator (formula.ts) is sandboxed
  (no `eval`), supports spreadsheet percent semantics (`15000+10%` = 16500), and ranges
  for ballparks. This is the right call for shared documents and matches how producers
  scratch-math a cell.
- **Actuals model is sound in shape.** Committed = Σ POs, Actual = Σ invoices, Outstanding
  = committed − actual, Remaining = estimate − actual (totals.ts:191-241). The vocabulary
  is correct and matches a cost report.

## Findings

### [Critical] The scheduling engine ignores holidays/closures entirely
`workback.ts` only knows weekends (`isWeekendKey`). The data model HAS a `Closure` type
(types.ts:38-45) and projects carry a `closures?` array, but a grep confirms `workback.ts`
never imports or reads it — closures are purely a visual grey-out in `layout.ts`.
Consequences in a real schedule:
- A downstream shift or compress/extend will land a shoot day, a delivery, or a review on
  a known studio closure / national holiday and give no warning.
- Weekend-skipping events count Thanksgiving, July 4th, Christmas, or a UK bank holiday
  as a *working* day, so a "5 workday" edit is silently short by every holiday it spans.
  `countWorkdays`/`addWorkdaysKey` (dates.ts:86-103) only subtract Sat/Sun.
This is the difference between a schedule that survives Q4 (holiday-dense) and one that
quietly promises delivery on a day no one is working. Closures must feed the workday math.

### [Critical] Estimator adjustments are additive off one base — no compounding, no tax-on-markup
`columnTotal = subtotal + Σ adjustments`, and every percent adjustment runs against the
raw section subtotals (totals.ts:97-124). The bundled test confirms the intent: "100 + 15%
markup + 10% contingency = 125" (verify-estimator.ts:168). Real budgets do not work this
way:
- **Tax must apply to (subtotal + markup)**, not the bare subtotal. Sales/use tax,
  VAT, and GST are charged on the marked-up price the client pays. Here a 9% tax line
  computes 9% of the unmarked subtotal — understating tax on every taxable estimate.
- **Contingency is frequently carried on the marked-up total**, and markup is often taken
  *after* contingency, depending on house rules. The tool can express neither ordering;
  adjustment order is irrelevant because nothing stacks.
- A client could approve a total that is short on tax. That is an audit and a real-money
  exposure, not cosmetics.
Fix needs an ordered/stackable adjustment model (each adjustment optionally based on the
running total), or at minimum a "tax base = subtotal + markup" option.

### [Critical] No fringes / payroll burden as a calculated quantity
P&W (payroll & wrap, ~15-25%+), union fringes (H&W, pension, vacation/holiday), and
payroll-handling fees are the backbone of a production budget. The estimator has only flat
or percent *below-the-line* adjustments applied to the whole column. There is no way to:
- Apply a fringe percentage to *only the labor/talent lines* and have it roll into the
  section subtotal where the client expects it. (Section opt-outs exist for column
  adjustments, but fringes belong inside the section, not as a global below-the-line line.)
- Distinguish fringeable from non-fringeable lines within a section.
The bid-specs clause correctly says "Crew P&W must be bid below the line as Cost Plus 15%"
(clauses.ts:37) — but the estimator can't model that as a derived line tied to crew cost.
A producer would have to hand-key P&W into every cell and re-key it on every rate change.

### [High] Compression can produce overlapping / zero-length events with no warning
`moveEvent`'s lock-collision branch remaps block offsets by `scale = newSpan/span` and
rounds (workback.ts:75-86); `compressTimeline` does the same (:151-188). Rounding several
events toward the same anchor can collapse two events onto the same start, invert ordering,
or crush a multi-day event so its scaled start lands on/after its own end region. The
`warnings` function only checks overlap *with locks* — it never checks event-to-event
overlap or whether compression left a task its real duration. A producer running
"compress 6 days" against a locked air date can get a schedule where edit and review sit
on the same day and the tool shows green. Compression should validate that each event
keeps ≥1 day and that dependent/adjacent events don't collide, and flag when they do.

### [High] No task dependencies — compression scales by calendar position, not logic
The engine treats events as independent bars positioned by date. Real workbacks are
dependency graphs: "Color can't start until Online is locked," "VO record needs final
script." Compression here scales every offset by the same ratio (totals of position), so a
5-day color pass and a 1-day QC compress by the same *proportion*, not by what can actually
give. The result is a mathematically tidy timeline that violates the production sequence —
e.g. it can shrink the immovable shoot block and leave a soft buffer untouched. Without
dependencies, compress/extend is a drawing tool, not a scheduling tool, and a producer
must still hand-check every result.

### [High] Single estimate-level currency; no per-vendor currency, no FX
`Estimate.currency` is one ISO code used purely as a *display* format (format.ts:6-22,
EstimatorToolbar "Display currency"). The triple-bid / leveling view compares vendor
columns dollar-for-dollar, but a foreign vendor bids in EUR/GBP and there is no per-column
currency and no FX rate. The leveling math (`columnDelta`, totals.ts:140-146) will subtract
a EUR bid from a USD bid as if both were the same unit, producing a meaningless variance.
The bid-specs clause even says "Exchange rates lock on the award date" (clauses.ts:97) —
the spec promises FX handling the estimator can't do. International bids will be leveled
wrong.

### [High] No change-order / revision audit trail in the estimator
The workback has a rich, persistent History with restore (README). The estimator has none.
There is no baseline-snapshot-vs-current change log, no change-order line type, no record
of "client added a shoot day on 6/20, +$42k approved." `updatedAt` is a single timestamp;
columns are versions but nothing records *what changed between them or who approved it*.
On a real job, every client-approved scope change must be traceable for the final
reconciliation. As built, the estimate cannot survive a billing dispute.

### [Medium] Currency display forces whole units, hiding cents and breaking JPY-like rounding
`formatCurrency` hard-codes `maximumFractionDigits: 0` (format.ts:13). Two issues:
(1) Sub-dollar amounts and the cents on invoices/POs in the ledger are truncated in
display — a $1,250.49 invoice shows $1,250, so Remaining looks off by up to a dollar per
line and visibly off in aggregate even though the stored math is fine. (2) The label is
always whole-unit regardless of currency convention. The underlying values are full
precision (good), but a producer reconciling a cost report against accounting will see
penny mismatches they can't explain.

### [Medium] Rounding in compress/extend is silent and per-event, so the block "drifts"
`Math.round(offset * scale)` is applied independently to each event (workback.ts:84,172,183).
There is no guarantee the rounded set preserves gaps or that the earliest event lands on
the intended compressed start; cumulative rounding can leave the project a day longer or
shorter than the requested delta. The preview diff shows the result, but a producer asking
"compress exactly 5 days" may get 4 or 6 net days of movement on the critical path with no
indication that rounding changed the answer.

### [Medium] Review rounds and "duplicate round" don't respect weekends or holidays
`createReviewRound` builds Review then Revisions with raw `addDaysKey` (workback.ts:226-258)
— no `skipWeekends`, no closure awareness. A 2-day review created on a Friday runs through
the weekend. `duplicateRound` chains by raw calendar `durationDays` (workback.ts:261-278),
so chained rounds drift onto weekends. Review cycles are exactly where weekend-skipping
matters most (clients don't review Saturday), and it's off by default here.

### [Medium] Warnings don't cover negative buffers between non-locked dependent work
`warnings` only relates unlocked events to *locked* ones (workback.ts:112-133). There is no
flag when, say, Online ends 6/18 but Color (its successor) was dragged to start 6/16 — a
real, schedule-breaking negative buffer that has nothing to do with a lock. Combined with
the no-dependencies finding, the tool can show a logically impossible schedule as clean.

### [Medium] No half-day / partial-day or working-hours model
Call times exist as *labels* ("AM", "EOD", "2:30 PM") for sorting within a day
(eventTime.ts), but everything is an all-day, whole-day unit. A producer can't model a
half-day shoot, an overnight, a 4-hour pickup, or per-day crew hours that drive cost. The
estimator's `TeamMember.hours` is a free-text string (estimator/types.ts:79), not a
computed quantity. Hours never feed a rate × hours line. For day-rate/crew-heavy budgets
this means all labor is hand-totaled.

### [Low] `parseTimeMinutes` accepts "0am" as null but allows bare 24-hour overflow edge
Time parsing (eventTime.ts:12-27) is solid for the common cases and tested, but it is a
display/sort label only and never validates against the event's day or feeds duration. Low
impact because it's cosmetic, but worth noting it cannot represent a time *range* (call to
wrap), which is what a call sheet actually needs.

### [Low] Insurance defaults to 2% as a below-the-line line, but real insurance is often a
flat premium or agency-covered
`STD_ADJUSTMENTS` ships Insurance at 2% (templates.ts:30). The bid-specs default clause
says "Do not bid for production insurance — the Agency will cover it" (clauses.ts:61). The
two modules ship contradictory defaults; a producer copying numbers between them double-
counts or mis-states insurance. Minor, but it's a cross-module consistency trap.

## Missing capabilities a real production needs

- **Holiday / blackout calendars feeding the workday engine** (per-region; productions
  span countries). Today closures are decorative only.
- **Task dependencies / predecessors** so compress/extend and downstream shift respect
  the production sequence, not just calendar position.
- **Crew & resource conflict detection** — the same DP, edit suite, or location double-
  booked across overlapping events. No resource model exists.
- **Time zones** — multi-territory shoots and remote reviews have no TZ concept; all dates
  are bare `yyyy-MM-dd`. A locked "delivery" has no time/zone, so a global team can't
  agree on the actual deadline.
- **Fringes / P&W / payroll handling as derived lines** tied to labor subtotals.
- **Stacked/ordered adjustments** (tax on subtotal+markup; contingency before or after
  markup).
- **Per-vendor currency + FX** for international leveling.
- **Change orders / approval log** in the estimator with baseline snapshots.
- **Rate cards** — reusable role→rate tables so a rate change updates every line.
- **Half-day / hours / call-to-wrap ranges** for day-rate budgets and call sheets.
- **Templates for the *schedule*** — the README mentions label templates and estimate
  templates, but no saved *workback* templates (a reusable "30-second TVC" timeline) to
  build a 40-event schedule fast.

## Trust & correctness risks (the "this could produce a wrong number/date" list)

1. **[Critical] Holiday-blind workday math** — `addWorkdaysKey`/`countWorkdays` (dates.ts)
   miscount any range spanning a holiday; every weekend-skipping duration and every shifted
   delivery can be silently wrong in Q4 and around any closure the user even *entered*.
2. **[Critical] Tax computed on un-marked subtotal** — `columnTotal` (totals.ts:122-124)
   gives 9% of subtotal, not 9% of (subtotal+markup). Understated tax on every taxable bid.
3. **[Critical] No fringes/P&W derivation** — labor burden must be hand-keyed and re-keyed;
   easy to forget on a changed line, understating cost.
4. **[High] Compression overlap/zero-length, unflagged** — `moveEvent`/`compressTimeline`
   rounding can collapse or invert events; `warnings` won't catch it (workback.ts:75-86,151-188).
5. **[High] Cross-currency leveling subtracts unlike units** — `columnDelta` on mixed-
   currency vendor columns is meaningless (totals.ts:140-146).
6. **[High] No dependency logic** — compress/extend scales by position, can violate the
   production sequence while showing a clean board.
7. **[Medium] Per-event rounding drift in compress** — requested delta ≠ net schedule
   movement, no indication (workback.ts:84,172,183).
8. **[Medium] Cents truncated in display** — ledger/actuals reconciliation shows penny
   mismatches vs accounting (format.ts:13).
9. **[Medium] Review rounds run through weekends/holidays by default** (workback.ts:226-278).
10. **[Medium] No event-to-event negative-buffer warning** — impossible schedules read as
    clean (workback.ts:112-133).

## Top 5 priorities before beta

1. **Make closures first-class in the scheduling engine.** Feed `project.closures` into
   `countWorkdays`, `addWorkdaysKey`, `snapWorkday`, and the move/compress paths so workday
   math and "skip weekends" also skip holidays, and warn when any shift lands a milestone or
   delivery on a closure. This is the single biggest silent-wrong-date risk.
2. **Fix the adjustment model for tax and stacking.** At minimum, let an adjustment choose
   its base (raw subtotal vs subtotal+markup), so sales tax/VAT computes on the marked-up
   price. Ideally make adjustments ordered and optionally compounding. This is a real-money
   correctness fix, not a feature.
3. **Add overlap / negative-buffer validation to compression and downstream shift.** Block
   or loudly flag any result where an event loses its duration or two events collide. The
   preview diff should refuse to show a logically impossible schedule as safe.
4. **Add fringes/P&W as a derived line tied to labor**, and per-vendor currency for
   leveling (or, short term, refuse to compute a cross-currency delta and warn). These are
   the two estimator gaps most likely to put a wrong total in front of a client.
5. **Make review rounds and round duplication weekend/closure-aware**, and give the
   workback saved *schedule* templates so a producer can stand up a 40-event timeline in
   minutes instead of clicking 40 days. Speed-under-deadline and not-running-reviews-on-
   Saturday are both daily realities.
