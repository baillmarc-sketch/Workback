/* Headless render crash-smoke for the AICP Bid app: renders the heavy
   components with a mock store (auth/firebase bypassed) to catch render-time
   crashes across the seeded sample, a filled bid, and a sparse migrated doc.
   Run: npx tsx --tsconfig scripts/tsconfig.smoke.json scripts/smoke-aicp.tsx */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AicpStoreContext } from "../src/state/aicpStore.tsx";
import { createBid } from "../src/lib/aicp/builder.ts";
import { studioShootSample } from "../src/lib/aicp/sample.ts";
import { migrate } from "../src/lib/aicp/storage.ts";
import {
  addBreakoutCategory,
  addLine,
  setEstimateField,
  setRate,
} from "../src/lib/aicp/mutations.ts";
import { estimateColumn } from "../src/lib/aicp/totals.ts";
import { categoryLineIds } from "../src/lib/aicp/types.ts";
import AicpGrid from "../src/components/aicp/AicpGrid.tsx";
import AicpSummary from "../src/components/aicp/AicpSummary.tsx";
import AicpRatesBar from "../src/components/aicp/AicpRatesBar.tsx";
import AicpDetailsPanel from "../src/components/aicp/AicpDetailsPanel.tsx";
import AicpPrintView, { defaultPrintConfig } from "../src/components/aicp/AicpPrintView.tsx";
import type { Bid } from "../src/lib/aicp/types.ts";

let failures = 0;
const noop = () => {};

function mockStore(bid: Bid | null) {
  return {
    bid,
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

function render(name: string, bid: Bid | null, node: React.ReactNode) {
  try {
    const html = renderToStaticMarkup(
      React.createElement(AicpStoreContext.Provider, { value: mockStore(bid) }, node)
    );
    if (typeof html !== "string") throw new Error("no markup");
    console.log(`✓ ${name} (${html.length} chars)`);
  } catch (e) {
    failures++;
    console.error(`✗ ${name}`, (e as Error)?.stack ?? String(e));
  }
}

// A realistic filled bid: values across labor + a breakout, with rates set.
function filledBid(): Bid {
  let bid = createBid("Acme Spot");
  const est = estimateColumn(bid)!;
  bid = setRate(bid, "fringePct", 22);
  bid = setRate(bid, "productionFeePct", 20);
  bid = setRate(bid, "insuranceProdPct", 2);
  bid = setRate(bid, "postMarkupPct", 10);
  for (const letter of ["A", "B", "I", "Q"]) {
    const cat = bid.categories.find((c) => c.letter === letter)!;
    const line = categoryLineIds(cat)[0];
    bid = setEstimateField(bid, line, est, "units", "3");
    bid = setEstimateField(bid, line, est, "rate", "1500");
    bid = setEstimateField(bid, line, est, "qty", "2");
  }
  bid = addBreakoutCategory(bid, "Overtime");
  const P = bid.categories.find((c) => c.breakout)!;
  bid = addLine(bid, P.id, { subSectionId: P.subSections![0].id, label: "OT pool" });
  return bid;
}

const blank = createBid("Untitled AICP Bid");
const sample = studioShootSample();
const filled = filledBid();
const sparse = migrate({ id: "b1", updatedAt: 1 });

for (const [label, bid] of [
  ["blank", blank],
  ["sample", sample],
  ["filled", filled],
  ["sparse", sparse],
] as const) {
  render(`AicpGrid · ${label}`, bid, React.createElement(AicpGrid, null));
  render(`AicpSummary · ${label}`, bid, React.createElement(AicpSummary, null));
  render(`AicpRatesBar · ${label}`, bid, React.createElement(AicpRatesBar, null));
  render(`AicpDetailsPanel · ${label}`, bid, React.createElement(AicpDetailsPanel, null));
  render(
    `AicpPrintView · ${label}`,
    bid,
    React.createElement(AicpPrintView, { config: defaultPrintConfig(bid) })
  );
}

// The classic vs modern print themes both render.
render(
  "AicpPrintView · modern theme",
  filled,
  React.createElement(AicpPrintView, { config: { ...defaultPrintConfig(filled), theme: "modern", showActual: true } })
);

// Grand total appears in the printed summary for a filled bid.
{
  try {
    const html = renderToStaticMarkup(
      React.createElement(
        AicpStoreContext.Provider,
        { value: mockStore(filled) },
        React.createElement(AicpPrintView, { config: defaultPrintConfig(filled) })
      )
    );
    if (html.includes("Grand Total")) console.log("✓ print shows Grand Total");
    else {
      failures++;
      console.error("✗ print missing Grand Total");
    }
  } catch (e) {
    failures++;
    console.error("✗ Grand Total print render", (e as Error)?.stack ?? String(e));
  }
}

console.log(failures === 0 ? "\n✅ AICP crash-smoke passed." : `\n❌ ${failures} render crash(es).`);
process.exit(failures === 0 ? 0 : 1);
