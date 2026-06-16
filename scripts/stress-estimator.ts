/* Adversarial battle-test for the Estimator engine: fuzzes the formula
   evaluator, the totals math (incl. adjustments), and migrate() against
   malformed/legacy/RTDB-mangled input. Run: npx tsx scripts/stress-estimator.ts */

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

import { evalExpr } from "../src/lib/estimator/formula.ts";
import {
  columnSubtotal,
  columnTotal,
  columnAdjustments,
  adjustmentAmount,
  sectionSubtotal,
} from "../src/lib/estimator/totals.ts";
import { migrate, newEstimate, duplicateEstimate, saveEstimate, loadEstimate } from "../src/lib/estimator/storage.ts";
import { cellKey, type Estimate } from "../src/lib/estimator/types.ts";

let failures = 0;
let checks = 0;
function bad(name: string, detail?: unknown) {
  failures++;
  console.error(`✗ ${name}`, detail ?? "");
}
function ok() {
  checks++;
}

// --- helpers ---
let seed = 1234567;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const approx = (a: number, b: number) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

// 1. FORMULA FUZZ — generate well-formed arithmetic, compare to JS evaluation.
function genExpr(depth: number): string {
  if (depth <= 0 || rnd() < 0.3) {
    const n = Math.floor(rnd() * 100000);
    return rnd() < 0.25 ? `${n}.${Math.floor(rnd() * 100)}` : String(n);
  }
  const op = pick(["+", "-", "*", "/"]);
  const a = genExpr(depth - 1);
  const b = genExpr(depth - 1);
  return rnd() < 0.4 ? `(${a}${op}${b})` : `${a}${op}${b}`;
}
{
  let mismatches = 0;
  let threw = 0;
  for (let i = 0; i < 8000; i++) {
    const expr = genExpr(4);
    let ref: number;
    try {
      // test-only reference: these strings are generated from digits/operators
      ref = Function(`"use strict";return (${expr});`)() as number;
    } catch {
      continue;
    }
    let r;
    try {
      r = evalExpr(expr);
    } catch (e) {
      threw++;
      bad("formula fuzz: evalExpr threw", { expr, e: String(e) });
      continue;
    }
    if (!Number.isFinite(ref)) {
      // division by zero etc — evalExpr should reject, never return Infinity/NaN
      if (r.ok && Number.isFinite(r.value!)) {
        mismatches++;
        bad("formula fuzz: accepted non-finite", { expr, ref, got: r.value });
      }
      continue;
    }
    if (!r.ok || !approx(r.value!, ref)) {
      mismatches++;
      if (mismatches <= 5) bad("formula fuzz: value mismatch", { expr, ref, got: r.value });
    }
  }
  if (!mismatches && !threw) ok();
  console.log(`formula fuzz: 8000 expressions, ${mismatches} mismatches, ${threw} throws`);
}

// 2. FORMULA GARBAGE — random junk must never throw; disallowed chars → ok:false.
{
  const chars = "0123456789.+-*/() abcXYZ;=$%&[]{}\"'`\\\n\t";
  let threw = 0;
  for (let i = 0; i < 5000; i++) {
    let s = "";
    const len = Math.floor(rnd() * 12);
    for (let j = 0; j < len; j++) s += pick(chars.split(""));
    try {
      const r = evalExpr(s);
      if (/[^0-9.+\-*/()%\s]/.test(s) && r.ok && s.trim() !== "") {
        bad("formula garbage: disallowed chars accepted", { s });
      }
    } catch (e) {
      threw++;
      bad("formula garbage: threw", { s, e: String(e) });
    }
  }
  if (!threw) ok();
  console.log(`formula garbage: 5000 strings, ${threw} throws`);
}

// 3. TOTALS INVARIANTS on random estimates.
{
  let viol = 0;
  for (let t = 0; t < 500; t++) {
    const e = newEstimate(pick(["video", "event", "blank"]));
    // random adjustments
    e.adjustments = [];
    const nAdj = Math.floor(rnd() * 4);
    for (let i = 0; i < nAdj; i++) {
      e.adjustments.push({ id: `a${i}`, label: `Adj${i}`, type: rnd() < 0.5 ? "percent" : "flat", value: Math.floor(rnd() * 200) - 50 });
    }
    // random extra column + random cell values
    const colId = e.columns[0].id;
    const liIds = Object.keys(e.lineItems);
    for (const li of liIds) {
      if (rnd() < 0.6) {
        const v = Math.floor(rnd() * 50000) - 5000;
        e.cells[cellKey(li, colId)] = { expr: String(v), value: v };
      }
    }
    const sub = columnSubtotal(e, colId);
    // section subtotals sum to column subtotal
    const sumSections = e.sections.reduce((s, sec) => s + sectionSubtotal(e, sec.id, colId), 0);
    if (!approx(sumSections, sub)) {
      viol++;
      bad("totals: sections != column subtotal", { sub, sumSections });
    }
    // columnTotal === subtotal + adjustments
    const adj = columnAdjustments(e, colId);
    const expectAdj = e.adjustments.reduce((s, a) => s + adjustmentAmount(sub, a), 0);
    if (!approx(adj, expectAdj) || !approx(columnTotal(e, colId), sub + adj)) {
      viol++;
      bad("totals: columnTotal invariant broken", { sub, adj, total: columnTotal(e, colId) });
    }
  }
  if (!viol) ok();
  console.log(`totals invariants: 500 random estimates, ${viol} violations`);
}

// 4. MIGRATE ROBUSTNESS — garbage, partial, legacy, RTDB-mangled never throws.
{
  const samples: unknown[] = [
    {},
    null,
    { columns: "nope", sections: 5, cells: [], lineItems: 7 },
    { columns: [{}], sections: [{}], lineItems: { x: {} } },
    { defaultMarkupPct: 15, defaultContingencyPct: 10, columns: [{ id: "c", markupPct: 99 }] }, // legacy → adjustments
    { actuals: { li1: { committed: { value: 100 }, actual: { value: 50 } } } }, // legacy actuals → ledger
    { adjustments: [{ label: "X", type: "weird", value: "NaN" }, null, { type: "percent", value: 5 }] },
    { fields: [null, { label: 1, value: 2 }], deliverables: "x", team: [{}], ledger: undefined },
    JSON.parse(JSON.stringify(newEstimate("video"))),
  ];
  let threw = 0;
  for (const s of samples) {
    try {
      const m = s === null ? (() => { try { migrate(s); return null; } catch { return "expected-throw"; } })() : migrate(s);
      if (m && m !== "expected-throw") {
        const e = m as Estimate;
        // structural guarantees
        if (!Array.isArray(e.adjustments) || !Array.isArray(e.fields) || !Array.isArray(e.deliverables) || !Array.isArray(e.team) || !Array.isArray(e.ledger) || !Array.isArray(e.columns) || !Array.isArray(e.sections)) {
          bad("migrate: missing array field", e);
        }
        // totals must be finite on anything migrate returns
        for (const c of e.columns) {
          if (!Number.isFinite(columnTotal(e, c.id))) bad("migrate: non-finite total", c);
        }
        // legacy conversions
        if ((s as { defaultMarkupPct?: number }).defaultMarkupPct === 15 && !e.adjustments.some((a) => a.value === 15)) {
          bad("migrate: legacy markup not converted", e.adjustments);
        }
        if ((s as { actuals?: unknown }).actuals && !e.ledger.some((x) => x.kind === "po" && x.amount === 100)) {
          bad("migrate: legacy actuals not folded", e.ledger);
        }
      }
    } catch (e) {
      threw++;
      bad("migrate: threw on input", { s, e: String(e) });
    }
  }
  if (!threw) ok();
  console.log(`migrate robustness: ${samples.length} adversarial inputs, ${threw} throws`);
}

// 5. PERSISTENCE + DUPLICATE round-trip on random estimates.
{
  let viol = 0;
  for (let i = 0; i < 100; i++) {
    const e = newEstimate(pick(["video", "event", "blank"]));
    e.id = `stress-${i}`;
    const colId = e.columns[0].id;
    for (const li of Object.keys(e.lineItems)) {
      if (rnd() < 0.5) e.cells[cellKey(li, colId)] = { expr: "1000", value: 1000 };
    }
    saveEstimate(e);
    const loaded = loadEstimate(e.id);
    if (!loaded) {
      viol++;
      bad("persist: lost estimate", e.id);
      continue;
    }
    if (loaded.adjustments.length !== e.adjustments.length || loaded.fields.length !== e.fields.length) {
      viol++;
      bad("persist: field/adjustment count drift", { id: e.id });
    }
    if (!approx(columnTotal(loaded, colId), columnTotal(e, colId))) {
      viol++;
      bad("persist: total drift", { id: e.id });
    }
    const copy = duplicateEstimate(e.id);
    if (copy) {
      copy.cells[Object.keys(copy.cells)[0] ?? "z:z"] = { expr: "999999", value: 999999 };
      copy.adjustments.push({ id: "x", label: "x", type: "flat", value: 1 });
      const orig = loadEstimate(e.id);
      if (orig && orig.adjustments.length !== e.adjustments.length) {
        viol++;
        bad("duplicate: mutated original", { id: e.id });
      }
    }
  }
  if (!viol) ok();
  console.log(`persistence + duplicate: 100 estimates, ${viol} violations`);
}

console.log(
  failures === 0
    ? `\n✅ Battle test passed — ${checks} suites, no failures.`
    : `\n❌ ${failures} battle-test failure(s).`
);
process.exit(failures === 0 ? 0 : 1);
