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
import {
  addLine,
  removeLine,
  setEstimateField,
  setActualAmount,
  addSubSection,
  removeSubSection,
  addVersionColumn,
  removeColumn,
  toggleApplicability,
  setRate,
  toggleLineHidden,
  addBreakoutCategory,
  toggleBreakoutIncluded,
  removeBreakoutCategory,
  renameCategory,
  setLineNo,
  addLineBelow,
  nextSubNumber,
} from "../src/lib/aicp/mutations.ts";
import { buildBidCsv } from "../src/lib/aicp/exportCsv.ts";
import { studioShootSample } from "../src/lib/aicp/sample.ts";
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

// 10. Mutations are immutable and correct
{
  const bid = createBid();
  const col = estimateColumn(bid)!;
  const A = bid.categories.find((c) => c.letter === "A")!;
  const before = A.lineIds.length;

  const b1 = addLine(bid, A.id, { label: "Drone Op" });
  check("addLine does not mutate the original", bid.categories.find((c) => c.letter === "A")!.lineIds.length === before);
  const A1 = b1.categories.find((c) => c.letter === "A")!;
  check("addLine appends one line", A1.lineIds.length === before + 1);
  const newId = A1.lineIds[A1.lineIds.length - 1];
  check("new line label set", b1.lines[newId].label === "Drone Op");

  const b2 = setEstimateField(b1, newId, col, "rate", "1000");
  const b3 = setEstimateField(b2, newId, col, "units", "2");
  const b4 = setEstimateField(b3, newId, col, "qty", "3");
  check("estimate field edits compute 2×1000×3 = 6000", b4.cells[cellKey(newId, col)].value === 6000, b4.cells[cellKey(newId, col)]?.value);

  const cleared = setEstimateField(setEstimateField(setEstimateField(b4, newId, col, "rate", ""), newId, col, "units", ""), newId, col, "qty", "");
  check("clearing all fields removes the cell (sparse)", cleared.cells[cellKey(newId, col)] === undefined);

  const removed = removeLine(b4, newId);
  check("removeLine drops the line", removed.lines[newId] === undefined);
  check("removeLine drops its cells", removed.cells[cellKey(newId, col)] === undefined);

  const hidden = toggleLineHidden(b1, newId);
  check("toggleLineHidden sets hidden", hidden.lines[newId].hidden === true);
}

// 11. Actual amount column + applicability + rates mutations
{
  let bid = createBid();
  const act = actualColumn(bid)!;
  const D = bid.categories.find((c) => c.letter === "D")!;
  const line = categoryLineIds(D)[0];
  bid = setActualAmount(bid, line, act, "5000");
  check("setActualAmount stores a lump value", bid.cells[cellKey(line, act)].value === 5000, bid.cells[cellKey(line, act)]?.value);

  // Toggle insurance off for A (was on by default) and confirm the recap drops it.
  const A = bid.categories.find((c) => c.letter === "A")!;
  bid = setRate(bid, "insuranceProdPct", 10);
  const est = estimateColumn(bid)!;
  bid = setEstimateField(bid, categoryLineIds(A)[0], est, "units", "1");
  bid = setEstimateField(bid, categoryLineIds(A)[0], est, "rate", "1000");
  const withA = productionInsurance(bid, est);
  const off = toggleApplicability(bid, "insurance", A.id);
  check("toggling insurance off A lowers insurance base", productionInsurance(off, est) < withA, {
    withA,
    off: productionInsurance(off, est),
  });
}

// 12. Sub-sections + version columns
{
  let bid = createBid();
  const X = bid.categories.find((c) => c.letter === "X")!;
  bid = addSubSection(bid, X.id, "Online Conform");
  const X1 = bid.categories.find((c) => c.letter === "X")!;
  check("addSubSection adds a section", (X1.subSections?.length ?? 0) === 2, X1.subSections?.length);
  const sub = X1.subSections![X1.subSections!.length - 1];
  bid = addLine(bid, X.id, { subSectionId: sub.id, label: "Conform Artist" });
  const X2 = bid.categories.find((c) => c.letter === "X")!;
  check("addLine into sub-section", X2.subSections!.find((s) => s.id === sub.id)!.lineIds.length === 1);
  bid = removeSubSection(bid, X.id, sub.id);
  const X3 = bid.categories.find((c) => c.letter === "X")!;
  check("removeSubSection removes it", !X3.subSections!.some((s) => s.id === sub.id));

  const withV = addVersionColumn(bid, "Option B");
  check("addVersionColumn adds a version", withV.columns.some((c) => c.kind === "version" && c.name === "Option B"));
  const vId = withV.columns.find((c) => c.kind === "version")!.id;
  const withoutV = removeColumn(withV, vId);
  check("removeColumn drops the version", !withoutV.columns.some((c) => c.id === vId));
  const estId = withV.columns.find((c) => c.kind === "estimate")!.id;
  check("removeColumn refuses to drop Estimate", removeColumn(withV, estId).columns.some((c) => c.id === estId));
}

// 13b. CSV export
{
  let bid = createBid("Acme Spot");
  const est = estimateColumn(bid)!;
  const A = bid.categories.find((c) => c.letter === "A")!;
  bid = setEstimateField(bid, categoryLineIds(A)[0], est, "units", "2");
  bid = setEstimateField(bid, categoryLineIds(A)[0], est, "rate", "1000");
  bid = setEstimateField(bid, categoryLineIds(A)[0], est, "qty", "3");
  const csv = buildBidCsv(bid);
  check("CSV includes the bid title", csv.includes("Acme Spot"));
  check("CSV includes a category band", csv.includes("A. Prep Crew"));
  check("CSV includes the line value 6000", csv.includes("6000"), csv.split("\n").find((l) => l.includes("6000")));
  check("CSV includes the Grand Total recap", csv.includes("Grand Total"));
  check("CSV escapes commas in quotes", buildBidCsv((() => { const b = createBid("Big, Bold"); return b; })()).includes('"Big, Bold"'));
}

// 13. P breakout sections
{
  let bid = createBid();
  const est = estimateColumn(bid)!;
  // A baseline so production total is non-trivial.
  const C = bid.categories.find((c) => c.letter === "C")!;
  bid = setEstimateField(bid, categoryLineIds(C)[0], est, "units", "1");
  bid = setEstimateField(bid, categoryLineIds(C)[0], est, "rate", "100000");
  const baseTotal = productionTotal(bid, est);

  bid = addBreakoutCategory(bid, "Overtime Estimate");
  const P = bid.categories.find((c) => c.breakout)!;
  check("breakout added with P1 letter", P.letter === "P1", P.letter);
  check("breakout is a production category", P.group === "production");
  check("breakout included by default", P.breakoutIncluded !== false);
  check("renameCategory works on breakout", renameCategory(bid, P.id, "OT").categories.find((c) => c.id === P.id)!.name === "OT");

  // Put a value in the breakout's sub-section and confirm it adds to production.
  bid = addLine(bid, P.id, { subSectionId: P.subSections![0].id, label: "OT pool" });
  const pLine = bid.categories.find((c) => c.id === P.id)!.subSections![0].lineIds[0];
  bid = setEstimateField(bid, pLine, est, "units", "1");
  bid = setEstimateField(bid, pLine, est, "rate", "20000");
  check("included breakout adds to production total", productionTotal(bid, est) === baseTotal + 20000, productionTotal(bid, est));

  const excluded = toggleBreakoutIncluded(bid, P.id);
  check("excluded breakout drops out of production total", productionTotal(excluded, est) === baseTotal, productionTotal(excluded, est));

  const removed = removeBreakoutCategory(bid, P.id);
  check("removeBreakoutCategory removes it", !removed.categories.some((c) => c.id === P.id));
  check("removeBreakoutCategory refuses standard categories", removeBreakoutCategory(bid, C.id).categories.some((c) => c.id === C.id));
}

// 14. AICP line numbers
{
  check("template A line 1 carries AICP # 1", AICP_TEMPLATE[0].lines[0].no === "1", AICP_TEMPLATE[0].lines[0].no);
  check("post category Q lines carry no AICP #", AICP_TEMPLATE.find((c) => c.letter === "Q")!.lines.every((l) => l.no === ""));

  const bid = createBid();
  const A = bid.categories.find((c) => c.letter === "A")!;
  const first = bid.lines[categoryLineIds(A)[0]];
  check("seeded line gets its AICP #", first.no === "1", first.no);

  const added = addLine(bid, A.id, { label: "Custom" });
  const newId = added.categories.find((c) => c.letter === "A")!.lineIds.slice(-1)[0];
  check("added line auto-numbers off the last line (49.1)", added.lines[newId].no === "49.1", added.lines[newId].no);

  const set = setLineNo(added, newId, "49a");
  check("setLineNo overrides the number", set.lines[newId].no === "49a");
  check("setLineNo blank clears it", setLineNo(set, newId, "").lines[newId].no === undefined);
}

// 15. Auto sub-numbering (dot notation) for added lines
{
  check('nextSubNumber("193", []) = 193.1', nextSubNumber("193", []) === "193.1");
  check('nextSubNumber with siblings -> next', nextSubNumber("193", ["193.1", "193.2"]) === "193.3");
  check('sub-line subs off its base (193.2 -> 193.3)', nextSubNumber("193.2", ["193.1", "193.2"]) === "193.3");
  check("blank parent yields blank", nextSubNumber("", ["1", "2"]) === "" && nextSubNumber(undefined, []) === "");

  const bid = createBid();
  const A = bid.categories.find((c) => c.letter === "A")!;
  const ids = categoryLineIds(A);
  const seventh = ids[6]; // AICP # 7 (Prop Master)
  check("parent line is #7", bid.lines[seventh].no === "7", bid.lines[seventh].no);
  const below = addLineBelow(bid, seventh);
  const aIds = categoryLineIds(below.categories.find((c) => c.letter === "A")!);
  const insertedId = aIds[aIds.indexOf(seventh) + 1];
  check("added line is inserted directly below its parent", !!insertedId && insertedId !== ids[7]);
  check("added line auto-numbers as 7.1", below.lines[insertedId].no === "7.1", below.lines[insertedId].no);
  const below2 = addLineBelow(below, seventh);
  const a2 = categoryLineIds(below2.categories.find((c) => c.letter === "A")!);
  const inserted2 = a2[a2.indexOf(seventh) + 1];
  check("a second add below #7 becomes 7.2", below2.lines[inserted2].no === "7.2", below2.lines[inserted2].no);

  // Bottom add subs off the last line in the category.
  const bottom = addLine(bid, A.id);
  const bIds = categoryLineIds(bottom.categories.find((c) => c.letter === "A")!);
  const lastAdded = bIds[bIds.length - 1];
  check("bottom + Add line subs off last line (49 -> 49.1)", bottom.lines[lastAdded].no === "49.1", bottom.lines[lastAdded].no);
}

// 16. Realistic studio-shoot sample lands near its targets and round-trips
{
  const s = studioShootSample();
  const col = estimateColumn(s)!;
  const prod = productionTotal(s, col);
  const post = postRecap(s, col).total;
  check("sample production total ≈ $250k", Math.abs(prod - 250000) < 12000, Math.round(prod));
  check("sample post total ≈ $130k", Math.abs(post - 130000) < 8000, Math.round(post));
  check("sample includes a production fee", productionFee(s, col) > 0);
  check("sample includes insurance", productionInsurance(s, col) > 0);
  check("sample leaves the production company blank", s.fields.every((f) => f.label !== "Production Co." || f.value === ""));
  check("sample fills the client field", s.fields.some((f) => f.value === "Northwind Beverages"));
  // RTDB round-trip via migrate keeps the totals intact.
  const round = migrate(JSON.parse(JSON.stringify(s)));
  check("sample round-trips with the same grand total", grandTotal(round, estimateColumn(round)!) === grandTotal(s, col));
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll AICP engine checks passed.");
