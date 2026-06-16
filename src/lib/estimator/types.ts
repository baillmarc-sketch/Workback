/**
 * Estimator data model. An Estimate is a budget grid: line items (grouped into
 * sections) down the left, comparison columns across the top. Each column is
 * either an internal "version" scenario or a "vendor" bid (the triple-bid
 * view filters to vendor columns). A cell holds the raw arithmetic the user
 * typed plus its evaluated dollar amount.
 */

export type ColumnRole = "version" | "vendor";

/** One comparison column. Markup/contingency live here (not on the estimate)
    because a vendor bid and an internal version legitimately carry different
    margins, and the triple-bid comparison is only meaningful per column. */
export interface EstimateColumn {
  id: string;
  name: string;
  role: ColumnRole;
  /** Applied to the column subtotal, e.g. 15 = 15% */
  markupPct: number;
  /** Applied to the column subtotal, e.g. 10 = 10% */
  contingencyPct: number;
  /** Optional company label for vendor columns */
  vendor?: string;
  order: number;
}

/** A budget line. Lives in a flat map so reordering/moving between sections is
    a cheap id shuffle that never rewrites the cells. */
export interface EstimateLineItem {
  id: string;
  label: string;
  note?: string;
  order: number;
}

/** A named group of line items with its own subtotal row. */
export interface EstimateSection {
  id: string;
  name: string;
  /** Ordered line-item ids; the items themselves live in Estimate.lineItems */
  lineItemIds: string[];
  order: number;
}

/** One (line item × column) cell: the raw expression the user typed and its
    cached evaluated value. `value` is recomputed on edit and re-derived from
    `expr` on load so a corrupted/missing cache self-heals. */
export interface CellValue {
  expr: string;
  value: number;
}

export interface Estimate {
  schema: 1;
  id: string;
  title: string;
  subtitle: string;
  notes: string;
  /** ISO 4217, e.g. "USD" */
  currency: string;
  sections: EstimateSection[];
  /** id -> line item */
  lineItems: Record<string, EstimateLineItem>;
  columns: EstimateColumn[];
  /** `${lineItemId}:${columnId}` -> cell. Flat (not nested) so adding/removing
      a row or column is O(1) and it round-trips through RTDB cleanly. */
  cells: Record<string, CellValue>;
  /** Column the delta row compares against; falls back to the first column. */
  baselineColumnId?: string;
  /** Defaults applied to newly created columns. */
  defaultMarkupPct: number;
  defaultContingencyPct: number;
  /** Set when published to the shared cloud copy — the link channel ID */
  shareId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface EstimateSummary {
  id: string;
  title: string;
  subtitle: string;
  updatedAt: number;
  lineItemCount: number;
  columnCount: number;
}

/** Flat-map key for a single cell. */
export function cellKey(lineItemId: string, columnId: string): string {
  return `${lineItemId}:${columnId}`;
}
