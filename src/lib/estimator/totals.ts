/**
 * Pure budget math, kept separate from React so it's trivially testable. Order
 * of operations is fixed and additive (not compounded): markup and contingency
 * are both computed off the raw subtotal, then summed into the total.
 */
import type { Adjustment, Estimate, LedgerEntry, LedgerKind } from "./types";
import { cellKey } from "./types";

function cellValue(est: Estimate, lineItemId: string, columnId: string): number {
  const c = est.cells[cellKey(lineItemId, columnId)];
  return c && Number.isFinite(c.value) ? c.value : 0;
}

/** High end of a range cell; equals the low value for non-range cells. */
function cellHigh(est: Estimate, lineItemId: string, columnId: string): number {
  const c = est.cells[cellKey(lineItemId, columnId)];
  if (!c) return 0;
  return Number.isFinite(c.high as number) ? (c.high as number) : Number.isFinite(c.value) ? c.value : 0;
}

/** Sum of one section's line items for a single column (low end). */
export function sectionSubtotal(est: Estimate, sectionId: string, columnId: string): number {
  const section = est.sections.find((s) => s.id === sectionId);
  if (!section) return 0;
  let sum = 0;
  for (const liId of section.lineItemIds) sum += cellValue(est, liId, columnId);
  return sum;
}

/** Section subtotal using the high end of range cells. */
export function sectionSubtotalHigh(est: Estimate, sectionId: string, columnId: string): number {
  const section = est.sections.find((s) => s.id === sectionId);
  if (!section) return 0;
  let sum = 0;
  for (const liId of section.lineItemIds) sum += cellHigh(est, liId, columnId);
  return sum;
}

/** Sum of every line item (across all sections) for a single column (low end). */
export function columnSubtotal(est: Estimate, columnId: string): number {
  let sum = 0;
  for (const section of est.sections) sum += sectionSubtotal(est, section.id, columnId);
  return sum;
}

/** Column subtotal using the high end of range cells. */
export function columnSubtotalHigh(est: Estimate, columnId: string): number {
  let sum = 0;
  for (const section of est.sections) sum += sectionSubtotalHigh(est, section.id, columnId);
  return sum;
}

/** The dollar amount of one adjustment against a given subtotal. */
export function adjustmentAmount(subtotal: number, adj: Adjustment): number {
  return adj.type === "percent" ? subtotal * (adj.value / 100) : adj.value;
}

/** The value of an adjustment for a specific column: a per-column override, or
    null when the column turns it off, or the estimate default. */
export function effectiveAdjustmentValue(
  est: Estimate,
  columnId: string,
  adj: Adjustment
): number | null {
  const col = est.columns.find((c) => c.id === columnId);
  const ov = col?.adjustmentOverrides?.[adj.id];
  if (ov === null) return null; // off for this column
  return typeof ov === "number" && Number.isFinite(ov) ? ov : adj.value;
}

/** Flat-map key for one (adjustment × section) opt-out on a column. */
export function adjustmentSectionKey(adjId: string, sectionId: string): string {
  return `${adjId}:${sectionId}`;
}

/** Whether a percent adjustment applies to this section for this column. Missing
    opt-out = included; an explicit `true` excludes the section's subtotal. */
export function adjustmentSectionEnabled(
  est: Estimate,
  columnId: string,
  adjId: string,
  sectionId: string
): boolean {
  const col = est.columns.find((c) => c.id === columnId);
  return !col?.adjustmentSectionsOff?.[adjustmentSectionKey(adjId, sectionId)];
}

/** True when this column excludes at least one section from a percent
    adjustment (used to flag the column as customized in the grid). */
export function columnHasSectionScope(est: Estimate, columnId: string, adj: Adjustment): boolean {
  if (adj.type !== "percent") return false;
  return est.sections.some((s) => !adjustmentSectionEnabled(est, columnId, adj.id, s.id));
}

/** The base a percent adjustment runs against for a column: the sum of the
    section subtotals it still applies to (low or high end). */
function adjustmentBase(est: Estimate, columnId: string, adj: Adjustment, high: boolean): number {
  let base = 0;
  for (const s of est.sections) {
    if (!adjustmentSectionEnabled(est, columnId, adj.id, s.id)) continue;
    base += high ? sectionSubtotalHigh(est, s.id, columnId) : sectionSubtotal(est, s.id, columnId);
  }
  return base;
}

/** One adjustment's amount for a column (0 when off), low or high end. Percent
    adjustments run against only the sections still enabled for this column;
    flat adjustments are a fixed amount regardless of sections. */
export function columnAdjustmentAmount(est: Estimate, columnId: string, adj: Adjustment, high = false): number {
  const v = effectiveAdjustmentValue(est, columnId, adj);
  if (v === null) return 0;
  if (adj.type === "flat") return v;
  return adjustmentBase(est, columnId, adj, high) * (v / 100);
}

/** Sum of all below-the-line adjustments for a column (respecting overrides). */
export function columnAdjustments(est: Estimate, columnId: string): number {
  return est.adjustments.reduce((sum, adj) => sum + columnAdjustmentAmount(est, columnId, adj), 0);
}

/** Grand total for a column: subtotal + every adjustment. */
export function columnTotal(est: Estimate, columnId: string): number {
  return columnSubtotal(est, columnId) + columnAdjustments(est, columnId);
}

/** Grand total using the high end of range cells. */
export function columnTotalHigh(est: Estimate, columnId: string): number {
  const sub = columnSubtotalHigh(est, columnId);
  return sub + est.adjustments.reduce((s, adj) => s + columnAdjustmentAmount(est, columnId, adj, true), 0);
}

export interface Delta {
  /** Column total minus baseline total */
  abs: number;
  /** Percentage difference vs baseline; 0 when the baseline total is 0 */
  pct: number;
}

/** Difference of a column's total against the baseline column's total. */
export function columnDelta(est: Estimate, columnId: string, baselineId: string): Delta {
  const colTotal = columnTotal(est, columnId);
  const baseTotal = columnTotal(est, baselineId);
  const abs = colTotal - baseTotal;
  const pct = baseTotal === 0 ? 0 : (abs / baseTotal) * 100;
  return { abs, pct };
}

/** The column deltas compare against — the saved baseline, else the first. */
export function baselineColumnId(est: Estimate): string | undefined {
  if (est.baselineColumnId && est.columns.some((c) => c.id === est.baselineColumnId)) {
    return est.baselineColumnId;
  }
  return est.columns[0]?.id;
}

// --- Bid leveling + Actuals ---

function exists(est: Estimate, columnId: string | undefined): string | undefined {
  return columnId && est.columns.some((c) => c.id === columnId) ? columnId : undefined;
}

/** Which column supplies the per-line "Estimate" figure in Actuals: the chosen
    source, else the awarded bid, else the delta baseline ("award feeds
    actuals"). */
export function resolveActualsSource(est: Estimate): string | undefined {
  return (
    exists(est, est.actualsSourceColumnId) ??
    exists(est, est.awardedColumnId) ??
    baselineColumnId(est)
  );
}

/** The Estimate figure for one line, from the source column's cell. */
export function lineEstimate(est: Estimate, lineItemId: string, sourceColumnId: string): number {
  return cellValue(est, lineItemId, sourceColumnId);
}

/** PO or invoice entries booked against a line, newest dates last. */
export function lineEntries(est: Estimate, lineItemId: string, kind: LedgerKind): LedgerEntry[] {
  return est.ledger.filter((x) => x.lineItemId === lineItemId && x.kind === kind);
}

function sumEntries(est: Estimate, lineItemId: string, kind: LedgerKind): number {
  let sum = 0;
  for (const x of est.ledger) {
    if (x.lineItemId === lineItemId && x.kind === kind && Number.isFinite(x.amount)) sum += x.amount;
  }
  return sum;
}

/** Committed = sum of the line's PO entries. */
export function committedValue(est: Estimate, lineItemId: string): number {
  return sumEntries(est, lineItemId, "po");
}

/** Actual = sum of the line's invoice entries. */
export function actualValue(est: Estimate, lineItemId: string): number {
  return sumEntries(est, lineItemId, "invoice");
}

/** Budget left to spend against this line. */
export function remainingAmount(estimate: number, actual: number): number {
  return estimate - actual;
}

/** Open POs not yet invoiced. */
export function outstandingAmount(committed: number, actual: number): number {
  return committed - actual;
}

/** Estimate vs actual (or any value vs a base): positive abs = over. */
export function lineVariance(value: number, base: number): Delta {
  const abs = value - base;
  const pct = base === 0 ? 0 : (abs / base) * 100;
  return { abs, pct };
}

/** Per-cell leveling variance (a vendor cell vs the baseline cell). */
export const cellVariance = lineVariance;

export interface ActualsTotals {
  estimate: number;
  committed: number;
  actual: number;
  /** committed − actual: open POs not yet invoiced */
  outstanding: number;
  /** estimate − actual: budget left to spend */
  remaining: number;
}

function sumActuals(est: Estimate, lineItemIds: string[], sourceColumnId: string): ActualsTotals {
  let estimate = 0;
  let committed = 0;
  let actual = 0;
  for (const id of lineItemIds) {
    estimate += lineEstimate(est, id, sourceColumnId);
    committed += committedValue(est, id);
    actual += actualValue(est, id);
  }
  return { estimate, committed, actual, outstanding: committed - actual, remaining: estimate - actual };
}

/** Estimate/Committed/Actual/Remaining summed over one section. */
export function sectionActualsTotals(est: Estimate, sectionId: string, sourceColumnId: string): ActualsTotals {
  const section = est.sections.find((s) => s.id === sectionId);
  return sumActuals(est, section?.lineItemIds ?? [], sourceColumnId);
}

/** Estimate/Committed/Actual/Remaining summed over every line item. */
export function actualsTotals(est: Estimate, sourceColumnId: string): ActualsTotals {
  const all = est.sections.flatMap((s) => s.lineItemIds);
  return sumActuals(est, all, sourceColumnId);
}
