/* End-to-end checks for the Estimator app: the safe formula evaluator, the
   budget math, and the storage round-trip. Run: npx tsx scripts/verify-estimator.ts */

// --- localStorage mock (must be installed before importing storage) ---
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

import { evalExpr, evalOrZero } from "../src/lib/estimator/formula.ts";
import {
  sectionSubtotal,
  columnSubtotal,
  adjustmentAmount,
  columnTotal,
  columnDelta,
  resolveActualsSource,
  lineVariance,
  remainingAmount,
  outstandingAmount,
  actualsTotals,
  sectionActualsTotals,
} from "../src/lib/estimator/totals.ts";
import {
  saveEstimate,
  loadEstimate,
  listEstimates,
  duplicateEstimate,
  migrate,
  newEstimate,
  sampleEstimate,
} from "../src/lib/estimator/storage.ts";
import type { Estimate } from "../src/lib/estimator/types.ts";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`✗ ${name}`, detail ?? "");
  } else {
    console.log(`✓ ${name}`);
  }
}

// 1. Formula evaluator
{
  const ok = (expr: string, v: number) => {
    const r = evalExpr(expr);
    check(`formula: "${expr}" = ${v}`, r.ok && r.value === v, r);
  };
  const bad = (expr: string) => {
    const r = evalExpr(expr);
    check(`formula: "${expr}" rejected`, !r.ok, r);
  };
  ok("2*15000+500", 30500);
  ok("2+3*4", 14);
  ok("(2+3)*4", 20);
  ok("-5", -5);
  ok("2*-4", -8);
  ok("1.5*2", 3);
  ok("10/4", 2.5);
  ok("", 0);
  ok("  ", 0);
  ok("((1+2)*(3+4))", 21);
  ok("100-25-25", 50); // left-associative subtraction
  ok("2*-3+10", 4);
  bad("1/0");
  bad("alert(1)");
  bad("1;2");
  bad("0x10");
  bad("`x`");
  bad("1.2.3");
  bad("(1+2");
  bad("1+2)");
  bad("*5");
  bad("5+");
  check("formula: evalOrZero invalid -> 0", evalOrZero("alert(1)") === 0);
  check("formula: evalOrZero valid", evalOrZero("3*3") === 9);
}

// 2. Totals math
{
  const liA = "liA";
  const liB = "liB";
  const liC = "liC";
  const colX = "colX";
  const colBase = "colBase";
  const est: Estimate = {
    schema: 1,
    id: "totals-test",
    title: "Totals",
    subtitle: "",
    notes: "",
    assumptions: "",
    currency: "USD",
    fields: [],
    deliverables: [],
    team: [],
    adjustments: [
      { id: "adjM", label: "Markup", type: "percent", value: 15 },
      { id: "adjC", label: "Contingency", type: "percent", value: 10 },
    ],
    sections: [
      { id: "s1", name: "Production", lineItemIds: [liA, liB], order: 0 },
      { id: "s2", name: "Post", lineItemIds: [liC], order: 1 },
    ],
    lineItems: {
      [liA]: { id: liA, label: "A", order: 0 },
      [liB]: { id: liB, label: "B", order: 1 },
      [liC]: { id: liC, label: "C", order: 0 },
    },
    columns: [
      { id: colX, name: "X", role: "version", order: 0 },
      { id: colBase, name: "Base", role: "version", order: 1 },
    ],
    cells: {
      [`${liA}:${colX}`]: { expr: "600", value: 600 },
      [`${liB}:${colX}`]: { expr: "400", value: 400 }, // colX subtotal 1000
      [`${liC}:${colX}`]: { expr: "0", value: 0 },
      [`${liA}:${colBase}`]: { expr: "400", value: 400 },
      [`${liB}:${colBase}`]: { expr: "400", value: 400 }, // colBase subtotal 800
    },
    baselineColumnId: colBase,
    ledger: [],
    createdAt: 1,
    updatedAt: 1,
  };
  check("totals: section subtotal", sectionSubtotal(est, "s1", colX) === 1000);
  check("totals: section subtotal other section", sectionSubtotal(est, "s2", colX) === 0);
  check("totals: column subtotal", columnSubtotal(est, colX) === 1000);
  check("totals: adjustment 15% of 1000 = 150", adjustmentAmount(1000, est.adjustments[0]) === 150);
  check("totals: adjustment 10% of 1000 = 100", adjustmentAmount(1000, est.adjustments[1]) === 100);
  check("totals: column total = subtotal + adjustments", columnTotal(est, colX) === 1250);
  check("totals: baseline total (800 + 25%)", columnTotal(est, colBase) === 1000);
  const d = columnDelta(est, colX, colBase);
  check("totals: delta abs", d.abs === 250, d);
  check("totals: delta pct", d.pct === 25, d);
  // baseline total 0 -> pct 0 (no divide-by-zero)
  const emptyBase = { ...est, cells: { [`${liA}:${colX}`]: { expr: "100", value: 100 } } };
  const d0 = columnDelta(emptyBase, colX, colBase);
  // colX total = 100 + 15% markup + 10% contingency = 125; baseline total 0.
  check("totals: baseline 0 -> pct 0", d0.pct === 0 && d0.abs === 125, d0);
}

// 3. Persistence round-trip
{
  const est = sampleEstimate();
  est.id = "persist-est";
  est.title = "Persist Estimate v1";
  saveEstimate(est);
  const loaded = loadEstimate("persist-est");
  check("persist: estimate returns", !!loaded);
  check("persist: title survives", loaded?.title === "Persist Estimate v1");
  check("persist: sections survive", loaded?.sections.length === est.sections.length);
  check("persist: columns survive", loaded?.columns.length === est.columns.length);
  check(
    "persist: cells keep expr AND value",
    !!loaded &&
      Object.entries(est.cells).every(([k, c]) => loaded.cells[k]?.expr === c.expr && loaded.cells[k]?.value === c.value),
    loaded?.cells
  );
  check("persist: vendor column role survives", loaded?.columns.some((c) => c.role === "vendor"));
  check("persist: adjustments survive", loaded?.adjustments.length === est.adjustments.length && loaded?.adjustments[0]?.value === est.adjustments[0]?.value);
  check("persist: fields + deliverables survive", loaded?.fields.length === est.fields.length && loaded?.deliverables.length === est.deliverables.length);
  check(
    "persist: appears in index with counts",
    listEstimates().some(
      (s) => s.id === "persist-est" && s.columnCount === est.columns.length && s.lineItemCount === Object.keys(est.lineItems).length
    )
  );
}

// 4. Duplicate: versioned, independent, share cleared
{
  const copy = duplicateEstimate("persist-est");
  check("duplicate: returns a copy", !!copy);
  check("duplicate: bumps version", copy?.title === "Persist Estimate v2", copy?.title);
  check("duplicate: new id", !!copy && copy.id !== "persist-est");
  check("duplicate: shareId cleared", copy?.shareId === undefined);
  // mutate the copy's cells; original must be untouched (deep copy)
  if (copy) {
    const k = Object.keys(copy.cells)[0];
    copy.cells[k] = { expr: "999", value: 999 };
    const orig = loadEstimate("persist-est");
    check("duplicate: original cells unchanged", orig?.cells[k]?.value !== 999);
  }
}

// 5. migrate recomputes a corrupted cached value from expr
{
  const est = newEstimate();
  const li = "li-x";
  const col = est.columns[0].id;
  est.lineItems[li] = { id: li, label: "X", order: 0 };
  est.sections[0].lineItemIds.push(li);
  // value deliberately wrong; migrate should recompute from expr "2*100"
  (est.cells as Record<string, unknown>)[`${li}:${col}`] = { expr: "2*100", value: NaN };
  const fixed = migrate(JSON.parse(JSON.stringify(est)));
  check("migrate: recomputes NaN cache from expr", fixed.cells[`${li}:${col}`]?.value === 200, fixed.cells[`${li}:${col}`]);
}

// 6. Cloud round-trip: RTDB drops empty arrays/undefined; migrate survives it
{
  const est = newEstimate("blank"); // blank seeds no cells
  est.id = "cloud-est";
  const wire = JSON.parse(JSON.stringify(est)); // empty arrays vanish like RTDB
  const out = migrate(wire);
  check("cloud: empty-cell estimate loads clean", out.cells && Object.keys(out.cells).length === 0);
  check("cloud: sections survive even with empty items", out.sections.length === est.sections.length);
  check("cloud: every section has an (empty) lineItemIds array", out.sections.every((s) => Array.isArray(s.lineItemIds)));
}

// 7. Actuals math + variance
{
  const liA = "aA";
  const liB = "aB";
  const liC = "aC";
  const colEst = "cEst";
  const colVendor = "cVen";
  const est: Estimate = {
    schema: 1,
    id: "actuals-test",
    title: "Actuals",
    subtitle: "",
    notes: "",
    assumptions: "",
    currency: "USD",
    sections: [
      { id: "s1", name: "Production", lineItemIds: [liA, liB], order: 0 },
      { id: "s2", name: "Post", lineItemIds: [liC], order: 1 },
    ],
    lineItems: {
      [liA]: { id: liA, label: "A", order: 0 },
      [liB]: { id: liB, label: "B", order: 1 },
      [liC]: { id: liC, label: "C", order: 0 },
    },
    columns: [
      { id: colEst, name: "Est", role: "version", markupPct: 0, contingencyPct: 0, order: 0 },
      { id: colVendor, name: "Vendor", role: "vendor", markupPct: 0, contingencyPct: 0, order: 1 },
    ],
    cells: {
      [`${liA}:${colEst}`]: { expr: "1000", value: 1000 },
      [`${liB}:${colEst}`]: { expr: "500", value: 500 },
      [`${liC}:${colEst}`]: { expr: "300", value: 300 },
    },
    ledger: [
      { id: "L1", lineItemId: liA, kind: "po", amount: 1000 },
      { id: "L2", lineItemId: liA, kind: "invoice", amount: 900 },
      { id: "L3", lineItemId: liB, kind: "po", amount: 600 },
      { id: "L4", lineItemId: liB, kind: "invoice", amount: 600 },
    ],
    baselineColumnId: colEst,
    defaultMarkupPct: 0,
    defaultContingencyPct: 0,
    createdAt: 1,
    updatedAt: 1,
  };
  const src = resolveActualsSource(est)!;
  check("actuals: source resolves to baseline", src === colEst);
  const g = actualsTotals(est, src);
  check("actuals: estimate total", g.estimate === 1800, g);
  check("actuals: committed total (Σ POs)", g.committed === 1600, g);
  check("actuals: actual total (Σ invoices)", g.actual === 1500, g);
  check("actuals: outstanding total (committed - actual)", g.outstanding === 100, g);
  check("actuals: remaining = estimate - actual", g.remaining === 300, g);
  const s1 = sectionActualsTotals(est, "s1", src);
  check(
    "actuals: section totals",
    s1.estimate === 1500 && s1.actual === 1500 && s1.outstanding === 100 && s1.remaining === 0,
    s1
  );
  check("actuals: remainingAmount", remainingAmount(1000, 900) === 100);
  check("actuals: outstandingAmount", outstandingAmount(1000, 900) === 100);
  const v = lineVariance(900, 1000);
  check("actuals: line variance abs/pct", v.abs === -100 && v.pct === -10, v);
  check("actuals: variance vs 0 estimate -> pct 0", lineVariance(500, 0).pct === 0);
}

// 8. resolveActualsSource fallback order: source > awarded > baseline > first
{
  const base = (over: Partial<Estimate>): Estimate => ({
    ...newEstimate(),
    ...over,
  });
  const cols = newEstimate().columns; // one column
  const e1 = base({ columns: cols, actualsSourceColumnId: cols[0].id });
  check("source: explicit source wins", resolveActualsSource(e1) === cols[0].id);
  const e2 = base({ columns: cols, actualsSourceColumnId: undefined, awardedColumnId: cols[0].id, baselineColumnId: undefined });
  check("source: falls back to awarded", resolveActualsSource(e2) === cols[0].id);
  const e3 = base({ columns: cols, actualsSourceColumnId: undefined, awardedColumnId: undefined, baselineColumnId: cols[0].id });
  check("source: falls back to baseline", resolveActualsSource(e3) === cols[0].id);
  const e4 = base({ columns: cols, actualsSourceColumnId: undefined, awardedColumnId: undefined, baselineColumnId: undefined });
  check("source: falls back to first column", resolveActualsSource(e4) === cols[0].id);
}

// 9. Persistence of ledger + award + source column
{
  const e = sampleEstimate();
  e.id = "actuals-persist";
  e.actualsSourceColumnId = e.columns[0].id;
  saveEstimate(e);
  const loaded = loadEstimate("actuals-persist");
  check("ledger persist: awardedColumnId survives", loaded?.awardedColumnId === e.awardedColumnId);
  check("ledger persist: source column survives", loaded?.actualsSourceColumnId === e.columns[0].id);
  check(
    "ledger persist: entries (amount/kind/ref) survive",
    !!loaded &&
      loaded.ledger.length === e.ledger.length &&
      e.ledger.every((x) => {
        const m = loaded.ledger.find((y) => y.id === x.id);
        return m && m.amount === x.amount && m.kind === x.kind && m.ref === x.ref && m.lineItemId === x.lineItemId;
      }),
    loaded?.ledger
  );

  // duplicate deep-copies the ledger
  const copy = duplicateEstimate("actuals-persist");
  if (copy) {
    copy.ledger[0].amount = 999999;
    const orig = loadEstimate("actuals-persist");
    check("ledger duplicate: deep-copied (original untouched)", orig?.ledger[0]?.amount !== 999999);
  }
}

// 10. migrate: legacy actuals fold into the ledger; RTDB-dropped ledger -> []
{
  const li = "li-a";
  const legacy = {
    ...newEstimate(),
    ledger: undefined, // RTDB drops empty arrays
    actuals: { [li]: { committed: { value: 300 }, actual: { value: 250 } } },
  };
  legacy.lineItems[li] = { id: li, label: "A", order: 0 };
  legacy.sections[0].lineItemIds.push(li);
  const fixed = migrate(JSON.parse(JSON.stringify(legacy)));
  check("migrate: legacy committed -> po entry", fixed.ledger.some((x) => x.lineItemId === li && x.kind === "po" && x.amount === 300), fixed.ledger);
  check("migrate: legacy actual -> invoice entry", fixed.ledger.some((x) => x.lineItemId === li && x.kind === "invoice" && x.amount === 250), fixed.ledger);
  check("migrate: dropped ledger -> []", Array.isArray(migrate(JSON.parse(JSON.stringify(newEstimate()))).ledger));
  // ledger round-trips through a JSON (RTDB-style) clone unchanged
  const withLedger = { ...newEstimate(), ledger: [{ id: "z1", lineItemId: li, kind: "po", amount: 4200, ref: "PO-9" }] };
  const out = migrate(JSON.parse(JSON.stringify(withLedger)));
  check("migrate: ledger round-trip", out.ledger.length === 1 && out.ledger[0].amount === 4200 && out.ledger[0].ref === "PO-9", out.ledger);
}

// 11. Templates + assumptions
{
  const video = newEstimate("video");
  check("template: video has sections", video.sections.length > 3);
  check("template: video pre-fills line items", Object.keys(video.lineItems).length > 8);
  check(
    "template: every line item belongs to a section",
    video.sections.flatMap((s) => s.lineItemIds).length === Object.keys(video.lineItems).length
  );
  check("template: starts with one version column", video.columns.length === 1 && video.columns[0].role === "version");
  check("template: seeds project fields", video.fields.length > 5 && video.fields.every((f) => f.value === ""));
  check("template: seeds adjustments (Insurance etc.)", video.adjustments.some((a) => a.label === "Insurance" && a.type === "percent"));
  check("template: seeds firm Project Archive cell ($750)", Object.values(video.cells).some((c) => c.value === 750));
  const blank = newEstimate("blank");
  check("template: blank has empty sections", blank.sections.length > 0 && Object.keys(blank.lineItems).length === 0);

  const e = newEstimate("event");
  e.id = "assume-test";
  e.assumptions = "2 shoot days\nUsage 1yr NA\nExcludes tax";
  saveEstimate(e);
  const loaded = loadEstimate("assume-test");
  check("assumptions: persist round-trip", loaded?.assumptions === e.assumptions, loaded?.assumptions);
}

console.log(failures === 0 ? "\nAll estimator checks passed." : `\n${failures} estimator check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
