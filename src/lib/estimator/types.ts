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

/** Actuals for one line item (independent of the version/vendor columns): the
    PO raised and the amount invoiced. Both are formula cells like CellValue. */
export interface LineActual {
  committed: CellValue;
  actual: CellValue;
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
  /** Bid leveling: the vendor column chosen as the awarded bid (highlighted,
      and the default Estimate source for the Actuals view). */
  awardedColumnId?: string;
  /** Which column supplies the per-line "Estimate" figure in the Actuals view;
      falls back to the awarded column, then the baseline. */
  actualsSourceColumnId?: string;
  /** Actuals axis: lineItemId -> committed/actual. Flat (RTDB-safe) like cells. */
  actuals: Record<string, LineActual>;
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
