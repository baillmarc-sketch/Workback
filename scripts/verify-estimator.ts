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
  markupAmount,
  contingencyAmount,
  columnTotal,
  columnDelta,
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
      { id: colX, name: "X", role: "version", markupPct: 15, contingencyPct: 10, order: 0 },
      { id: colBase, name: "Base", role: "version", markupPct: 0, contingencyPct: 0, order: 1 },
    ],
    cells: {
      [`${liA}:${colX}`]: { expr: "600", value: 600 },
      [`${liB}:${colX}`]: { expr: "400", value: 400 }, // s1 subtotal 1000
      [`${liC}:${colX}`]: { expr: "0", value: 0 },
      [`${liA}:${colBase}`]: { expr: "500", value: 500 },
      [`${liB}:${colBase}`]: { expr: "500", value: 500 },
    },
    baselineColumnId: colBase,
    defaultMarkupPct: 0,
    defaultContingencyPct: 0,
    createdAt: 1,
    updatedAt: 1,
  };
  check("totals: section subtotal", sectionSubtotal(est, "s1", colX) === 1000);
  check("totals: section subtotal other section", sectionSubtotal(est, "s2", colX) === 0);
  check("totals: column subtotal", columnSubtotal(est, colX) === 1000);
  check("totals: markup 15% of 1000 = 150", markupAmount(1000, 15) === 150);
  check("totals: contingency 10% of 1000 = 100", contingencyAmount(1000, 10) === 100);
  check("totals: column total = subtotal+markup+contingency", columnTotal(est, colX) === 1250);
  check("totals: baseline total", columnTotal(est, colBase) === 1000);
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
  check("persist: column role + markup survive", loaded?.columns.some((c) => c.role === "vendor"));
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
  const est = newEstimate(); // sections present but all lineItemIds empty
  est.id = "cloud-est";
  const wire = JSON.parse(JSON.stringify(est)); // empty arrays vanish like RTDB
  const out = migrate(wire);
  check("cloud: empty-cell estimate loads clean", out.cells && Object.keys(out.cells).length === 0);
  check("cloud: sections survive even with empty items", out.sections.length === est.sections.length);
  check("cloud: every section has an (empty) lineItemIds array", out.sections.every((s) => Array.isArray(s.lineItemIds)));
}

console.log(failures === 0 ? "\nAll estimator checks passed." : `\n${failures} estimator check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
