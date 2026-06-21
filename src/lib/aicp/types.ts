/**
 * AICP bid data model. A Bid is the full AICP cost form: lettered cost
 * categories (A–X) down the page, each holding budget lines, with comparison
 * columns across the top. The two canonical columns are Estimate and Actual;
 * extra "version" columns hold bid revisions/scenarios. Every (line × column)
 * cell is a quantity × rate cell — Units (e.g. days) × Rate × QTY (e.g. # of
 * crew) → an evaluated dollar amount — which is what makes this a real AICP
 * builder rather than a flat total grid.
 *
 * Below-the-line economics (labor fringes, talent handling, production fee,
 * insurance, post-production markup/tax) live in `rates`, scoped to the
 * categories they apply to by `applicability`, and are rolled up by the engine
 * in lib/aicp/totals.ts into the AICP summary recap.
 */

import type { Author } from "../author";
import type { AicpCategoryKind, AicpGroup } from "./template";

export type { AicpCategoryKind, AicpGroup } from "./template";

/** Estimate is computed from the qty×rate cells; Actual mirrors it with its own
    booked figures; a Version is an alternate Estimate scenario (v2, "option B"). */
export type ColumnKind = "estimate" | "actual" | "version";

/** A comparison column across the top of the bid. */
export interface BidColumn {
  id: string;
  name: string;
  kind: ColumnKind;
  order: number;
  /** Pixel width when the user has dragged the column; falls back to a default. */
  width?: number;
}

/** One budget line within a category. Lines live in a flat map so reordering or
    moving between categories is a cheap id shuffle that never rewrites cells. */
export interface BidLine {
  id: string;
  /** Optional AICP line number/code shown in the No. column. */
  no?: string;
  label: string;
  /** Unit of the Units field: days, hrs, each, allow, ppl, ft, weeks, flat… */
  unitType: string;
  note?: string;
  /** Hidden from the printed bid (still counts in totals unless empty). */
  hidden?: boolean;
  order: number;
}

/** A named sub-section inside a sub-sectioned category (X, and the P breakouts):
    e.g. an "Online Conform" block under X. Flat categories don't use these. */
export interface BidSubSection {
  id: string;
  name: string;
  lineIds: string[];
  order: number;
}

/** One lettered AICP cost category (a section of the bid). Most categories hold
    a flat `lineIds` list; sub-sectioned ones (X / P breakouts) hold `subSections`
    instead, each with its own line list and subtotal. */
export interface BidCategory {
  id: string;
  /** A, B, C … X, or P1/P2… for breakout sections. */
  letter: string;
  name: string;
  kind: AicpCategoryKind;
  group: AicpGroup;
  /** Carries labor fringes on its subtotal. */
  fringes: boolean;
  /** Carries a talent handling fee on its subtotal. */
  handling: boolean;
  /** A P-breakout section (optional, excludable from the production total). */
  breakout?: boolean;
  /** Whether a breakout section is included in the production total. */
  breakoutIncluded?: boolean;
  /** Flat line list (categories without sub-sections). */
  lineIds: string[];
  /** Named sub-sections (X / P breakouts) — when present, `lineIds` is unused. */
  subSections?: BidSubSection[];
  /** Per-category fringe % override; falls back to `rates.fringePct`. */
  fringePct?: number;
  /** Per-category handling % override; falls back to `rates.handlingPct`. */
  handlingPct?: number;
  order: number;
  /** Hidden from the printed bid. */
  hidden?: boolean;
}

/** One (line × column) cell: the raw expressions the user typed for Units, Rate
    and QTY plus their evaluated numbers, and the cached product. `value` is
    recomputed on edit and re-derived from the exprs on load, so a corrupted or
    missing cache self-heals (RTDB also drops empty maps). */
export interface BidCell {
  unitsExpr: string;
  units: number;
  rateExpr: string;
  rate: number;
  qtyExpr: string;
  qty: number;
  /** units × rate × qty */
  value: number;
}

/** Below-the-line percentages that drive the summary recap. Each is a percent
    (e.g. 21 = 21%); the categories a percent applies to are set in
    `Bid.applicability` (fringes/handling apply to their flagged categories). */
export interface BidRates {
  /** Labor fringes on labor-category subtotals. */
  fringePct: number;
  /** Talent handling fee on talent/expense talent categories. */
  handlingPct: number;
  /** Production fee on the subject production categories. */
  productionFeePct: number;
  /** Insurance on the subject production categories. */
  insuranceProdPct: number;
  /** Production fee applied to Section X. */
  sectionXFeePct: number;
  /** Insurance on the post-production sub-total. */
  postInsurancePct: number;
  /** Markup on the post-production sub-total. */
  postMarkupPct: number;
  /** Tax on the post-production sub-total. */
  postTaxPct: number;
}

/** Which categories the production fee and insurance apply to (the Cover's
    "Production Subject to Production Fee / Insurance" checkbox matrix). Keyed by
    category id; a missing/false entry means not subject. */
export interface BidApplicability {
  productionFee: Record<string, boolean>;
  insurance: Record<string, boolean>;
}

/** A job-information field on the cover (Client, Job #, Agency, dates, …). */
export interface BidField {
  id: string;
  label: string;
  value: string;
}

export interface Bid {
  schema: 1;
  id: string;
  title: string;
  subtitle: string;
  /** AICP template version the bid was seeded from (e.g. "AICP 2023"). */
  templateVersion: string;
  /** Cover job-information fields (Client, Agency, Job #s, dates, titles…). */
  fields: BidField[];
  /** ISO 4217, e.g. "USD". */
  currency: string;
  /** Logo shown on the printed bid header — an image URL or a data: URL. */
  logoUrl?: string;
  /** Bid assumptions/notes (one per line) shown on the cover. */
  notes: string;
  columns: BidColumn[];
  categories: BidCategory[];
  /** id -> line. Flat so add/remove/move is O(1) and round-trips through RTDB. */
  lines: Record<string, BidLine>;
  /** `${lineId}:${columnId}` -> cell. Flat (not nested). */
  cells: Record<string, BidCell>;
  rates: BidRates;
  applicability: BidApplicability;
  /** Contingency notes that are tracked but NOT billed into the grand total. */
  contingencies: string[];
  /** Set when published to the shared cloud copy — the link channel ID. */
  shareId?: string;
  /** Who created this file (team-workspace attribution; absent for personal). */
  createdBy?: Author;
  createdAt: number;
  updatedAt: number;
}

export interface BidSummary {
  id: string;
  title: string;
  subtitle: string;
  updatedAt: number;
  lineCount: number;
  columnCount: number;
}

/** Flat-map key for a single cell. */
export function cellKey(lineId: string, columnId: string): string {
  return `${lineId}:${columnId}`;
}

/** Every line id in a category, whether it's flat or sub-sectioned. */
export function categoryLineIds(cat: BidCategory): string[] {
  if (cat.subSections) return cat.subSections.flatMap((s) => s.lineIds);
  return cat.lineIds;
}
