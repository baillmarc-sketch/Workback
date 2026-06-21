/**
 * Pure AICP budget math, kept out of React so it's trivially testable. It reads
 * the cached `value` on each cell (units × rate × qty) and rolls categories up
 * into the AICP summary recap:
 *
 *   category subtotal → + labor fringes / talent handling = category total
 *   Σ category totals (A–O) + insurance + production fee   = Production Total
 *   Σ category totals (Q–X) + Section-X fee + post insurance + markup + tax
 *                                                          = Post-Production Total
 *   Production Total + Post-Production Total               = Grand Total
 *
 * Insurance and the production fee apply only to the categories flagged subject
 * in `Bid.applicability`. Percentages are additive off the relevant subtotal,
 * never compounded. Every figure is computed per column, so Estimate, Actual and
 * any version column share one code path and Variance is just their difference.
 */
import type { Bid, BidCategory } from "./types";
import { cellKey, categoryLineIds } from "./types";

function cellValue(bid: Bid, lineId: string, columnId: string): number {
  const c = bid.cells[cellKey(lineId, columnId)];
  return c && Number.isFinite(c.value) ? c.value : 0;
}

/** Find a category by id. */
export function findCategory(bid: Bid, categoryId: string): BidCategory | undefined {
  return bid.categories.find((c) => c.id === categoryId);
}

/** Sum of a sub-section's lines for one column. */
export function subSectionSubtotal(bid: Bid, lineIds: string[], columnId: string): number {
  let sum = 0;
  for (const id of lineIds) sum += cellValue(bid, id, columnId);
  return sum;
}

/** Raw subtotal of a category for one column (before fringes/handling). */
export function categorySubtotal(bid: Bid, categoryId: string, columnId: string): number {
  const cat = findCategory(bid, categoryId);
  if (!cat) return 0;
  let sum = 0;
  for (const id of categoryLineIds(cat)) sum += cellValue(bid, id, columnId);
  return sum;
}

/** The fringe % in effect for a category (per-category override, else global). */
export function categoryFringePct(bid: Bid, cat: BidCategory): number {
  if (!cat.fringes) return 0;
  return typeof cat.fringePct === "number" && Number.isFinite(cat.fringePct)
    ? cat.fringePct
    : bid.rates.fringePct;
}

/** The handling-fee % in effect for a category (per-category override, else global). */
export function categoryHandlingPct(bid: Bid, cat: BidCategory): number {
  if (!cat.handling) return 0;
  return typeof cat.handlingPct === "number" && Number.isFinite(cat.handlingPct)
    ? cat.handlingPct
    : bid.rates.handlingPct;
}

/** Labor fringes on a category's subtotal for one column (0 if it carries none). */
export function categoryFringe(bid: Bid, categoryId: string, columnId: string): number {
  const cat = findCategory(bid, categoryId);
  if (!cat) return 0;
  return categorySubtotal(bid, categoryId, columnId) * (categoryFringePct(bid, cat) / 100);
}

/** Talent handling fee on a category's subtotal for one column. */
export function categoryHandling(bid: Bid, categoryId: string, columnId: string): number {
  const cat = findCategory(bid, categoryId);
  if (!cat) return 0;
  return categorySubtotal(bid, categoryId, columnId) * (categoryHandlingPct(bid, cat) / 100);
}

/** Category total for one column: subtotal + fringes + handling. */
export function categoryTotal(bid: Bid, categoryId: string, columnId: string): number {
  return (
    categorySubtotal(bid, categoryId, columnId) +
    categoryFringe(bid, categoryId, columnId) +
    categoryHandling(bid, categoryId, columnId)
  );
}

/** Categories that count toward the production total (group "production",
    breakouts only when included), in document order. */
export function productionCategories(bid: Bid): BidCategory[] {
  return bid.categories.filter(
    (c) => c.group === "production" && (!c.breakout || c.breakoutIncluded !== false)
  );
}

/** Post-production categories (group "post"), in document order. */
export function postCategories(bid: Bid): BidCategory[] {
  return bid.categories.filter((c) => c.group === "post");
}

/** Production sub-total A–K (the categories before Director's Fees). The recap
    shows this as "Sub-Total A to K"; it excludes L/M/N/O, which are added after. */
export function subtotalAtoK(bid: Bid, columnId: string): number {
  const AK = new Set(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]);
  let sum = 0;
  for (const cat of productionCategories(bid)) {
    if (AK.has(cat.letter)) sum += categoryTotal(bid, cat.id, columnId);
  }
  return sum;
}

/** Insurance for one column: percent of every production category flagged
    subject to insurance. */
export function productionInsurance(bid: Bid, columnId: string): number {
  let base = 0;
  for (const cat of productionCategories(bid)) {
    if (bid.applicability.insurance[cat.id]) base += categoryTotal(bid, cat.id, columnId);
  }
  return base * (bid.rates.insuranceProdPct / 100);
}

/** Production fee for one column: percent of every production category flagged
    subject to the production fee. */
export function productionFee(bid: Bid, columnId: string): number {
  let base = 0;
  for (const cat of productionCategories(bid)) {
    if (bid.applicability.productionFee[cat.id]) base += categoryTotal(bid, cat.id, columnId);
  }
  return base * (bid.rates.productionFeePct / 100);
}

/** Production Total for one column: every production category total + insurance
    + production fee. */
export function productionTotal(bid: Bid, columnId: string): number {
  let sum = 0;
  for (const cat of productionCategories(bid)) sum += categoryTotal(bid, cat.id, columnId);
  return sum + productionInsurance(bid, columnId) + productionFee(bid, columnId);
}

/** Post-production sub-total for one column: every post category total. */
export function postSubtotal(bid: Bid, columnId: string): number {
  let sum = 0;
  for (const cat of postCategories(bid)) sum += categoryTotal(bid, cat.id, columnId);
  return sum;
}

/** The production fee applied to Section X for one column. */
export function sectionXFee(bid: Bid, columnId: string): number {
  const x = bid.categories.find((c) => c.letter === "X" && c.group === "post");
  if (!x) return 0;
  return categoryTotal(bid, x.id, columnId) * (bid.rates.sectionXFeePct / 100);
}

export interface PostRecap {
  subtotal: number;
  sectionXFee: number;
  insurance: number;
  markup: number;
  tax: number;
  total: number;
}

/** The full post-production recap for one column. Insurance, markup and tax are
    each a percent of the post sub-total (additive); the Section-X fee is added
    on top. */
export function postRecap(bid: Bid, columnId: string): PostRecap {
  const subtotal = postSubtotal(bid, columnId);
  const xFee = sectionXFee(bid, columnId);
  const insurance = subtotal * (bid.rates.postInsurancePct / 100);
  const markup = subtotal * (bid.rates.postMarkupPct / 100);
  const tax = subtotal * (bid.rates.postTaxPct / 100);
  return { subtotal, sectionXFee: xFee, insurance, markup, tax, total: subtotal + xFee + insurance + markup + tax };
}

/** Grand total for one column: Production Total + Post-Production Total. */
export function grandTotal(bid: Bid, columnId: string): number {
  return productionTotal(bid, columnId) + postRecap(bid, columnId).total;
}

export interface Variance {
  /** value − base (positive = the column is over the base). */
  abs: number;
  /** Percentage difference vs base; 0 when base is 0. */
  pct: number;
}

/** Difference of one value against a base (e.g. Actual vs Estimate). */
export function variance(value: number, base: number): Variance {
  const abs = value - base;
  const pct = base === 0 ? 0 : (abs / base) * 100;
  return { abs, pct };
}

/** The Estimate column (the qty×rate scenario the bid is built in). */
export function estimateColumn(bid: Bid): string | undefined {
  return (bid.columns.find((c) => c.kind === "estimate") ?? bid.columns[0])?.id;
}

/** The Actual column, if the bid tracks actuals. */
export function actualColumn(bid: Bid): string | undefined {
  return bid.columns.find((c) => c.kind === "actual")?.id;
}
