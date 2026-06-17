/**
 * Estimator data model. An Estimate is a budget grid: line items (grouped into
 * sections) down the left, comparison columns across the top. Each column is
 * either an internal "version" scenario or a "vendor" bid (the triple-bid
 * view filters to vendor columns). A cell holds the raw arithmetic the user
 * typed plus its evaluated dollar amount.
 */

export type ColumnRole = "version" | "vendor";

/** A reference link on a column — the treatment, the full bid PDF, a reel, etc.
    Stored as a URL (host the file on Drive/Dropbox/etc.) plus a label. */
export interface ColumnLink {
  label: string;
  url: string;
}

/** One comparison column (an internal version or a vendor bid). */
export interface EstimateColumn {
  id: string;
  name: string;
  role: ColumnRole;
  /** When true, cells hold a low–high ballpark range and totals show a range. */
  range?: boolean;
  /** Optional company label for vendor columns */
  vendor?: string;
  /** Free-text notes about this bid/version */
  notes?: string;
  /** Links to the treatment, full bid, reel, etc. */
  links?: ColumnLink[];
  /** Per-column overrides for estimate-level adjustments: adjustmentId -> a
      value (override) or null (off for this column). Missing key = default. */
  adjustmentOverrides?: Record<string, number | null>;
  /** Per-(adjustment × section) opt-outs for THIS column. Keyed
      `${adjustmentId}:${sectionId}`; a present `true` means that percent
      adjustment skips that section's subtotal for this column. Missing key =
      the section is included. Lets markup/insurance be toggled section-by-section
      and vendor-by-vendor (the full matrix). */
  adjustmentSectionsOff?: Record<string, true>;
  /** Pixel width when the user has dragged the column; falls back to a default. */
  width?: number;
  order: number;
}

/** A below-the-line adjustment applied to every column's subtotal — markup,
    contingency, insurance (2%), sales tax, etc. Rolls Net Subtotal → Total. */
export type AdjustmentType = "percent" | "flat";
export interface Adjustment {
  id: string;
  label: string;
  type: AdjustmentType;
  /** Percent of the column subtotal (type "percent") or a flat amount ("flat") */
  value: number;
}

/** Project metadata field (Client, Job #, Director, Shoot Dates, …). */
export interface ProjectField {
  id: string;
  label: string;
  value: string;
}

/** A deliverable line (Title / Length / Usage). */
export interface Deliverable {
  id: string;
  title: string;
  length: string;
  usage: string;
}

/** A team line (Name / Role / Level / Hours). */
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  level: string;
  hours: string;
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
  /** High end of a ballpark range (range columns only); `value` is the low end. */
  highExpr?: string;
  high?: number;
}

/** A single PO or invoice booked against a line item. The Committed total for a
    line is the sum of its "po" entries; the Actual total is the sum of its
    "invoice" entries. */
export type LedgerKind = "po" | "invoice";

export interface LedgerEntry {
  id: string;
  lineItemId: string;
  kind: LedgerKind;
  amount: number;
  /** PO # / invoice # */
  ref?: string;
  vendor?: string;
  /** yyyy-MM-dd */
  date?: string;
  note?: string;
}

export interface Estimate {
  schema: 1;
  id: string;
  title: string;
  subtitle: string;
  notes: string;
  /** Client-facing assumptions the estimate is built on (one per line). */
  assumptions: string;
  /** ISO 4217, e.g. "USD" */
  currency: string;
  /** Project info panel (Client, Job #, Director, dates, …). */
  fields: ProjectField[];
  /** Deliverables (Title / Length / Usage). */
  deliverables: Deliverable[];
  /** Whether the deliverables table shows Length/Usage columns (off for events). */
  deliverablesShowSpecs?: boolean;
  /** Logo shown on the client PDF header — an image URL or a data: URL. */
  logoUrl?: string;
  /** Team (Name / Role / Level / Hours). */
  team: TeamMember[];
  /** Below-the-line adjustments applied to every column (markup, contingency,
      insurance, sales tax). */
  adjustments: Adjustment[];
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
  /** PO + invoice ledger driving the Actuals view. Committed = Σ po entries,
      Actual = Σ invoice entries, per line item. */
  ledger: LedgerEntry[];
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
