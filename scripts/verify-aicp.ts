/* Checks for the AICP Bid engine: the qty×rate cell model and the summary
   recap math (category subtotals, fringes/handling, insurance, production fee,
   post-production markup/tax, grand total, variance).
   Run: npx tsx scripts/verify-aicp.ts */

// --- localStorage mock (storage only touches it inside functions) ---
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

import { createBid, evalCell } from "../src/lib/aicp/builder.ts";
import { saveBid, loadBid, listBids, duplicateBid, migrate } from "../src/lib/aicp/storage.ts";
import { AICP_TEMPLATE } from "../src/lib/aicp/template.ts";
import {
  categorySubtotal,
  categoryFringe,
  categoryHandling,
  categoryTotal,
  subtotalAtoK,
  productionInsurance,
  productionFee,
  productionTotal,
  postSubtotal,
  postRecap,
  grandTotal,
  variance,
  estimateColumn,
  actualColumn,
  findCategory,
} from "../src/lib/aicp/totals.ts";
import { cellKey, categoryLineIds } from "../src/lib/aicp/types.ts";
import type { Bid } from "../src/lib/aicp/types.ts";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`✗ ${name}`, detail ?? "");
  } else {
    console.log(`✓ ${name}`);
  }
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** Helper: set a line's Estimate cell to units × rate × qty. */
function setEstimate(bid: Bid, lineId: string, units: string, rate: string, qty: string) {
  const col = estimateColumn(bid)!;
  bid.cells[cellKey(lineId, col)] = evalCell(units, rate, qty);
}

// 1. Template + builder shape
{
  const bid = createBid("Test bid");
  check("22 categories seeded", bid.categories.length === 22, bid.categories.length);
  check(
    "category letters A–X in order",
    bid.categories.map((c) => c.letter).join("") === "ABCDEFGHIJKLMNOQRSTVWX"
  );
  const total = AICP_TEMPLATE.reduce((s, c) => s + c.lines.length, 0);
  check("all template lines instantiated", Object.keys(bid.lines).length === total, {
    have: Object.keys(bid.lines).length,
    want: total,
  });
  check("Estimate + Actual columns", !!estimateColumn(bid) && !!actualColumn(bid));
  const X = bid.categories.find((c) => c.letter === "X")!;
  check("X is sub-sectioned", !!X.subSections && X.subSections.length === 1, X.subSections);
  const A = bid.categories.find((c) => c.letter === "A")!;
  check("A carries fringes, no handling", A.fringes && !A.handling);
  const M = bid.categories.find((c) => c.letter === "M")!;
  check("M (Talent) carries fringes + handling", M.fringes && M.handling);
}

// 2. qty × rate cell
{
  const c = evalCell("2", "1000", "3");
  check("2 days × $1000 × 3 = 6000", c.value === 6000, c.value);
  const blankQty = evalCell("5", "200", "");
  check("blank QTY defaults to 1 (5×200 = 1000)", blankQty.value === 1000, blankQty.value);
  const formula = evalCell("10", "1500+10%", "1");
  check("rate accepts formulas (1500+10% = 1650)", formula.value === 16500, formula.value);
  const blank = evalCell("", "", "");
  check("fully blank cell = $0", blank.value === 0, blank.value);
}

// 3. Category subtotal + fringes/handling
{
  const bid = createBid();
  bid.rates.fringePct = 25;
  bid.rates.handlingPct = 10;
  const A = findCategory(bid, bid.categories.find((c) => c.letter === "A")!.id)!;
  const aLines = categoryLineIds(A);
  setEstimate(bid, aLines[0], "2", "1000", "3"); // 6000
  setEstimate(bid, aLines[1], "1", "2000", "1"); // 2000
  const col = estimateColumn(bid)!;
  check("A subtotal = 8000", categorySubtotal(bid, A.id, col) === 8000, categorySubtotal(bid, A.id, col));
  check("A fringe @25% = 2000", near(categoryFringe(bid, A.id, col), 2000), categoryFringe(bid, A.id, col));
  check("A handling = 0 (no handling)", categoryHandling(bid, A.id, col) === 0);
  check("A total = 10000", near(categoryTotal(bid, A.id, col), 10000), categoryTotal(bid, A.id, col));

  // Talent: fringe + handling both apply
  const M = bid.categories.find((c) => c.letter === "M")!;
  const mLines = categoryLineIds(M);
  setEstimate(bid, mLines[0], "1", "10000", "1"); // 10000
  check("M fringe @25% = 2500", near(categoryFringe(bid, M.id, col), 2500), categoryFringe(bid, M.id, col));
  check("M handling @10% = 1000", near(categoryHandling(bid, M.id, col), 1000), categoryHandling(bid, M.id, col));
  check("M total = 13500", near(categoryTotal(bid, M.id, col), 13500), categoryTotal(bid, M.id, col));

  // Per-category override beats the global rate.
  M.fringePct = 0;
  check("M fringe override 0% → 0", categoryFringe(bid, M.id, col) === 0, categoryFringe(bid, M.id, col));
}

// 4. Production recap: subtotal A–K, insurance, fee, production total
{
  const bid = createBid();
  bid.rates.fringePct = 0;
  bid.rates.insuranceProdPct = 2; // 2% insurance
  bid.rates.productionFeePct = 20; // 20% production fee
  const col = estimateColumn(bid)!;
  const C = bid.categories.find((c) => c.letter === "C")!; // expense, A–K, subject by default
  setEstimate(bid, categoryLineIds(C)[0], "1", "100000", "1"); // 100000

  check("A–K subtotal = 100000", subtotalAtoK(bid, col) === 100000, subtotalAtoK(bid, col));
  check("insurance @2% of 100000 = 2000", near(productionInsurance(bid, col), 2000), productionInsurance(bid, col));
  check("production fee @20% = 20000", near(productionFee(bid, col), 20000), productionFee(bid, col));
  check("production total = 122000", near(productionTotal(bid, col), 122000), productionTotal(bid, col));

  // L is not subject to fee/insurance by default → adds straight through.
  const L = bid.categories.find((c) => c.letter === "L")!;
  setEstimate(bid, categoryLineIds(L)[0], "1", "10000", "1"); // 10000 director prep
  check(
    "L not subject: production total = 132000 (no extra fee/ins on L)",
    near(productionTotal(bid, col), 132000),
    productionTotal(bid, col)
  );
}

// 5. Post-production recap + grand total
{
  const bid = createBid();
  bid.rates.postInsurancePct = 1;
  bid.rates.postMarkupPct = 10;
  bid.rates.postTaxPct = 5;
  const col = estimateColumn(bid)!;
  const Q = bid.categories.find((c) => c.letter === "Q")!; // Editorial (post)
  setEstimate(bid, categoryLineIds(Q)[0], "1", "50000", "1"); // 50000
  const r = postRecap(bid, col);
  check("post subtotal = 50000", r.subtotal === 50000, r.subtotal);
  check("post insurance @1% = 500", near(r.insurance, 500), r.insurance);
  check("post markup @10% = 5000", near(r.markup, 5000), r.markup);
  check("post tax @5% = 2500", near(r.tax, 2500), r.tax);
  check("post total = 58000", near(r.total, 58000), r.total);
  check("grand total = production + post = 58000", near(grandTotal(bid, col), 58000), grandTotal(bid, col));
}

// 6. Variance (Actual vs Estimate)
{
  const bid = createBid();
  const est = estimateColumn(bid)!;
  const act = actualColumn(bid)!;
  const D = bid.categories.find((c) => c.letter === "D")!;
  const line = categoryLineIds(D)[0];
  bid.cells[cellKey(line, est)] = evalCell("1", "10000", "1");
  bid.cells[cellKey(line, act)] = evalCell("1", "12000", "1");
  const eVal = categorySubtotal(bid, D.id, est);
  const aVal = categorySubtotal(bid, D.id, act);
  const v = variance(aVal, eVal);
  check("variance abs = +2000 (over)", v.abs === 2000, v.abs);
  check("variance pct = +20%", near(v.pct, 20), v.pct);
  check("variance vs 0 base → 0%", variance(100, 0).pct === 0);
}

// 7. JSON round-trip (RTDB-safe: plain data, no functions)
{
  const bid = createBid();
  const col = estimateColumn(bid)!;
  setEstimate(bid, categoryLineIds(bid.categories[0])[0], "2", "500", "2");
  const round = JSON.parse(JSON.stringify(bid)) as Bid;
  check(
    "round-trips through JSON with same A subtotal",
    categorySubtotal(round, round.categories[0].id, col) ===
      categorySubtotal(bid, bid.categories[0].id, col)
  );
}

// 8. Storage: save/load round-trip, duplicate version bump
{
  const bid = createBid("Acme Spot");
  const col = estimateColumn(bid)!;
  setEstimate(bid, categoryLineIds(bid.categories[0])[0], "3", "1000", "2"); // 6000
  saveBid(bid);
  const loaded = loadBid(bid.id)!;
  check("save → load round-trips", !!loaded && loaded.id === bid.id, loaded?.id);
  check(
    "loaded A subtotal preserved",
    categorySubtotal(loaded, loaded.categories[0].id, col) === 6000,
    categorySubtotal(loaded, loaded.categories[0].id, col)
  );
  check("appears in index", listBids().some((s) => s.id === bid.id));

  const dup = duplicateBid(bid.id)!;
  check("duplicate gets new id", dup.id !== bid.id);
  check("duplicate bumps title to v2", dup.title === "Acme Spot v2", dup.title);
  check("duplicate clears share link", dup.shareId === undefined);
}

// 9. Migration heals RTDB-sparse data (dropped empty maps/arrays, stale cache)
{
  const full = createBid("Sparse");
  const col = estimateColumn(full)!;
  const line = categoryLineIds(full.categories[0])[0];
  full.cells[cellKey(line, col)] = evalCell("2", "500", "2"); // 2000, value cache = 2000
  // Simulate RTDB: drop the cached value + qty number, keep exprs; drop empty maps.
  const wire = JSON.parse(JSON.stringify(full)) as Record<string, unknown>;
  const cells = wire.cells as Record<string, Record<string, unknown>>;
  delete cells[cellKey(line, col)].value; // stale/missing cache
  delete cells[cellKey(line, col)].qty;
  const healed = migrate(wire);
  check(
    "cell value re-derived from exprs after cache drop",
    healed.cells[cellKey(line, col)].value === 2000,
    healed.cells[cellKey(line, col)].value
  );
  check("healed bid still has 22 categories", healed.categories.length === 22);
  // A bid with no columns at all still gets an Estimate column back.
  const noCols = migrate({ id: "x", title: "t", updatedAt: 1, createdAt: 1 });
  check("missing columns → Estimate column restored", !!estimateColumn(noCols));
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll AICP engine checks passed.");
