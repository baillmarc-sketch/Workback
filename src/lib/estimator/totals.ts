/**
 * Pure budget math, kept separate from React so it's trivially testable. Order
 * of operations is fixed and additive (not compounded): markup and contingency
 * are both computed off the raw subtotal, then summed into the total.
 */
import type { Estimate, LedgerEntry, LedgerKind } from "./types";
import { cellKey } from "./types";

function cellValue(est: Estimate, lineItemId: string, columnId: string): number {
  const c = est.cells[cellKey(lineItemId, columnId)];
  return c && Number.isFinite(c.value) ? c.value : 0;
}

/** Sum of one section's line items for a single column. */
export function sectionSubtotal(est: Estimate, sectionId: string, columnId: string): number {
  const section = est.sections.find((s) => s.id === sectionId);
  if (!section) return 0;
  let sum = 0;
  for (const liId of section.lineItemIds) sum += cellValue(est, liId, columnId);
  return sum;
}

/** Sum of every line item (across all sections) for a single column. */
export function columnSubtotal(est: Estimate, columnId: string): number {
  let sum = 0;
  for (const section of est.sections) sum += sectionSubtotal(est, section.id, columnId);
  return sum;
}

export function markupAmount(subtotal: number, markupPct: number): number {
  return subtotal * (markupPct / 100);
}

export function contingencyAmount(subtotal: number, contingencyPct: number): number {
  return subtotal * (contingencyPct / 100);
}

/** Grand total for a column: subtotal + markup + contingency. */
export function columnTotal(est: Estimate, columnId: string): number {
  const col = est.columns.find((c) => c.id === columnId);
  if (!col) return 0;
  const subtotal = columnSubtotal(est, columnId);
  return subtotal + markupAmount(subtotal, col.markupPct) + contingencyAmount(subtotal, col.contingencyPct);
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
