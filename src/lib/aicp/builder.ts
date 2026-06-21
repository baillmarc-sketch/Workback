/**
 * Builds a live Bid from the authoritative AICP template, and the small helpers
 * for creating/evaluating qty×rate cells. Kept separate from storage so tests
 * and the seed path don't pull in localStorage.
 */
import { uid } from "../types";
import { evalExpr } from "../estimator/formula";
import { AICP_TEMPLATE, AICP_TEMPLATE_VERSION } from "./template";
import type {
  Bid,
  BidApplicability,
  BidCategory,
  BidCell,
  BidColumn,
  BidLine,
  BidRates,
} from "./types";

/** Categories A–K are subject to the production fee & insurance by default; the
    rest (L/M/N/O) are added below the line and start not-subject, matching the
    AICP cover defaults. */
const DEFAULT_SUBJECT = new Set(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]);

/** Standard cover job-information fields (empty), in AICP order. */
const DEFAULT_FIELDS: ReadonlyArray<string> = [
  "Client / Advertiser",
  "Product",
  "Agency",
  "Job #",
  "Director",
  "Production Co.",
  "Shoot Dates",
  "Location",
];

export function defaultRates(): BidRates {
  return {
    fringePct: 0,
    handlingPct: 0,
    productionFeePct: 0,
    insuranceProdPct: 0,
    sectionXFeePct: 0,
    postInsurancePct: 0,
    postMarkupPct: 0,
    postTaxPct: 0,
  };
}

/** Evaluate a qty×rate cell's three expressions into numbers + their product.
    Blank fields read as 0 (units/qty) — a blank cell is a valid $0 line. */
export function evalCell(unitsExpr: string, rateExpr: string, qtyExpr: string): BidCell {
  const u = evalExpr(unitsExpr);
  const r = evalExpr(rateExpr);
  const q = evalExpr(qtyExpr);
  const units = u.ok && u.value !== undefined ? u.value : 0;
  const rate = r.ok && r.value !== undefined ? r.value : 0;
  // A blank QTY means "1" (most lines are a single quantity of Units × Rate).
  const qty = qtyExpr.trim() === "" ? 1 : q.ok && q.value !== undefined ? q.value : 0;
  return { unitsExpr, units, rateExpr, rate, qtyExpr, qty, value: units * rate * qty };
}

/** An empty cell (all blank → $0, qty defaults to 1). */
export function emptyCell(): BidCell {
  return evalCell("", "", "");
}

function makeLine(label: string, unitType: string, order: number): BidLine {
  return { id: uid(), label, unitType, order };
}

/** Instantiate the AICP categories + their default lines from the template. */
function buildCategories(): { categories: BidCategory[]; lines: Record<string, BidLine> } {
  const lines: Record<string, BidLine> = {};
  const categories: BidCategory[] = AICP_TEMPLATE.map((tc, ci) => {
    const made = tc.lines.map((l, i) => makeLine(l.title, l.unitType, i));
    for (const l of made) lines[l.id] = l;
    const base: BidCategory = {
      id: uid(),
      letter: tc.letter,
      name: tc.name,
      kind: tc.kind,
      group: tc.group,
      fringes: tc.fringes,
      handling: tc.handling,
      lineIds: tc.subSections ? [] : made.map((l) => l.id),
      order: ci,
    };
    if (tc.subSections) {
      // Sub-sectioned categories (X) seed one empty named sub-section to start.
      base.subSections = [{ id: uid(), name: "Section 1", lineIds: made.map((l) => l.id), order: 0 }];
    }
    return base;
  });
  return { categories, lines };
}

/** Default applicability: A–K subject to production fee & insurance, L/M/N/O not. */
function buildApplicability(categories: BidCategory[]): BidApplicability {
  const productionFee: Record<string, boolean> = {};
  const insurance: Record<string, boolean> = {};
  for (const c of categories) {
    if (c.group !== "production") continue;
    const subject = DEFAULT_SUBJECT.has(c.letter);
    productionFee[c.id] = subject;
    insurance[c.id] = subject;
  }
  return { productionFee, insurance };
}

/** Create a fresh AICP bid seeded from the template. */
export function createBid(title = "Untitled bid"): Bid {
  const { categories, lines } = buildCategories();
  const columns: BidColumn[] = [
    { id: uid(), name: "Estimate", kind: "estimate", order: 0 },
    { id: uid(), name: "Actual", kind: "actual", order: 1 },
  ];
  const now = Date.now();
  return {
    schema: 1,
    id: uid(),
    title,
    subtitle: "",
    templateVersion: AICP_TEMPLATE_VERSION,
    fields: DEFAULT_FIELDS.map((label) => ({ id: uid(), label, value: "" })),
    currency: "USD",
    notes: "",
    columns,
    categories,
    lines,
    cells: {},
    rates: defaultRates(),
    applicability: buildApplicability(categories),
    contingencies: [],
    createdAt: now,
    updatedAt: now,
  };
}
