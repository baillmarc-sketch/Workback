/* Headless render crash-smoke for Bid Specs: renders the heavy components with a
   mock store (auth/firebase bypassed) to catch render-time crashes across the
   sample, a blank spec, and a sparse migrated doc.
   Run: npx tsx --tsconfig scripts/tsconfig.smoke.json scripts/smoke-bidspecs.tsx */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StoreContext } from "../src/state/bidSpecsStore.tsx";
import { sampleBidSpec, newBidSpec, migrate } from "../src/lib/bidSpecs/storage.ts";
import SpecEditor from "../src/components/bidSpecs/SpecEditor.tsx";
import BidSpecsToolbar from "../src/components/bidSpecs/BidSpecsToolbar.tsx";
import BidSpecsPrintView from "../src/components/bidSpecs/BidSpecsPrintView.tsx";
import type { BidSpec } from "../src/lib/bidSpecs/types.ts";

let failures = 0;
const noop = () => {};

function mockStore(spec: BidSpec | null) {
  return {
    spec,
    canUndo: false,
    canRedo: false,
    syncState: "idle" as const,
    open: noop,
    close: noop,
    commit: noop,
    patch: noop,
    undo: noop,
    redo: noop,
  };
}

function render(name: string, spec: BidSpec | null, node: React.ReactNode) {
  try {
    const html = renderToStaticMarkup(
      React.createElement(StoreContext.Provider, { value: mockStore(spec) }, node)
    );
    if (typeof html !== "string") throw new Error("no markup");
    console.log(`✓ ${name} (${html.length} chars)`);
  } catch (e) {
    failures++;
    console.error(`✗ ${name}`, (e as Error)?.stack ?? String(e));
  }
}

const sample = sampleBidSpec();
const blank = newBidSpec();
const sparse = migrate({ id: "s1", updatedAt: 1 });

for (const [label, spec] of [
  ["sample", sample],
  ["blank", blank],
  ["sparse", sparse],
] as const) {
  render(`SpecEditor · ${label}`, spec, React.createElement(SpecEditor, null));
  render(`BidSpecsPrintView · ${label}`, spec, React.createElement(BidSpecsPrintView, null));
}
render(
  "BidSpecsToolbar · sample",
  sample,
  React.createElement(BidSpecsToolbar, { onShare: noop, onExport: noop, onPrint: noop, onHelp: noop })
);

// N/A print: an unmarked checklist item prints "N/A" in the provider cells.
{
  const na = sampleBidSpec();
  na.checklist = na.checklist.map((c, i) => (i === 0 ? { ...c, provider: "NA" } : c));
  try {
    const html = renderToStaticMarkup(
      React.createElement(StoreContext.Provider, { value: mockStore(na) }, React.createElement(BidSpecsPrintView, null))
    );
    if (html.includes("N/A")) console.log("✓ print shows N/A for unchecked rows");
    else {
      failures++;
      console.error("✗ print missing N/A for unchecked rows");
    }
  } catch (e) {
    failures++;
    console.error("✗ N/A print render", (e as Error)?.stack ?? String(e));
  }
}

console.log(failures === 0 ? "\n✅ Bid Specs crash-smoke passed." : `\n❌ ${failures} render crash(es).`);
process.exit(failures === 0 ? 0 : 1);
