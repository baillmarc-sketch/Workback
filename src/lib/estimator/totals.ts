/**
 * Pure budget math, kept separate from React so it's trivially testable. Order
 * of operations is fixed and additive (not compounded): markup and contingency
 * are both computed off the raw subtotal, then summed into the total.
 */
import type { Estimate } from "./types";
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
