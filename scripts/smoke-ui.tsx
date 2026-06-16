/* Headless render crash-smoke: renders the estimator's heavy components with a
   mock store (the account gate / auth / firebase are bypassed) to catch
   render-time crashes — undefined access, bad maps, etc. — across every view
   and the sample data. Run: npx tsx scripts/smoke-ui.tsx
   (Event handlers and effects don't run under static render; this catches the
   bulk of "it crashes on render" breakage, complementing the engine stress
   test and the live UI pass.) */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StoreContext } from "../src/state/estimateStore.tsx";
import { sampleEstimate, newEstimate } from "../src/lib/estimator/storage.ts";
import EstimateGrid from "../src/components/estimator/EstimateGrid.tsx";
import ActualsGrid from "../src/components/estimator/ActualsGrid.tsx";
import ProjectDetailsPanel from "../src/components/estimator/ProjectDetailsPanel.tsx";
import EstimatorToolbar from "../src/components/estimator/EstimatorToolbar.tsx";
import AdjustmentsDialog from "../src/components/estimator/AdjustmentsDialog.tsx";
import type { Estimate } from "../src/lib/estimator/types.ts";
// Note: EstimatesDialog/EstimatorHeader use the Auth context and always render
// inside AuthProvider in the app, so they're out of scope for this store-only smoke.

let failures = 0;
const noop = () => {};

function mockStore(estimate: Estimate | null) {
  return {
    estimate,
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

function render(name: string, estimate: Estimate | null, node: React.ReactNode) {
  try {
    const html = renderToStaticMarkup(
      React.createElement(StoreContext.Provider, { value: mockStore(estimate) }, node)
    );
    if (typeof html !== "string") throw new Error("no markup");
    console.log(`✓ ${name} (${html.length} chars)`);
  } catch (e) {
    failures++;
    console.error(`✗ ${name}`, (e as Error)?.stack ?? String(e));
  }
}

// Exercise across each template's data + the rich sample.
for (const id of ["video", "event", "blank"] as const) {
  const est = newEstimate(id);
  render(`EstimateGrid[all] · ${id}`, est, React.createElement(EstimateGrid, { mode: "all" }));
}

const sample = sampleEstimate();
render("EstimateGrid[all] · sample", sample, React.createElement(EstimateGrid, { mode: "all" }));
render("EstimateGrid[versions] · sample", sample, React.createElement(EstimateGrid, { mode: "versions" }));
render("EstimateGrid[leveling] · sample", sample, React.createElement(EstimateGrid, { mode: "leveling" }));
render("ActualsGrid · sample", sample, React.createElement(ActualsGrid, null));
render("ProjectDetailsPanel · sample", sample, React.createElement(ProjectDetailsPanel, null));
render(
  "EstimatorToolbar · sample",
  sample,
  React.createElement(EstimatorToolbar, {
    mode: "all" as const,
    onModeChange: noop,
    onAdjustments: noop,
    onShare: noop,
    onExport: noop,
  })
);
// Modal-based dialogs return null without a document — should not throw.
render("AdjustmentsDialog · sample", sample, React.createElement(AdjustmentsDialog, { onClose: noop }));

// Empty/edge estimate (no columns? keep one; no cells, no sections content).
const empty = newEstimate("blank");
render("EstimateGrid[all] · empty", empty, React.createElement(EstimateGrid, { mode: "all" }));
render("ActualsGrid · empty", empty, React.createElement(ActualsGrid, null));

console.log(failures === 0 ? "\n✅ UI crash-smoke passed." : `\n❌ ${failures} render crash(es).`);
process.exit(failures === 0 ? 0 : 1);
