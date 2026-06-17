"use client";

import { useEffect, useState } from "react";
import { parseAppFromHash, type AppId } from "@/lib/toolkit";
import { ProjectProvider } from "@/state/store";
import { EstimateProvider } from "@/state/estimateStore";
import { BidSpecsProvider } from "@/state/bidSpecsStore";
import AppBar from "./AppBar";
import AppGate from "./AppGate";
import App from "./App";
import EstimatorApp from "./estimator/EstimatorApp";
import BidSpecsApp from "./bidSpecs/BidSpecsApp";

/**
 * Platform shell. Workback is the default landing and is public; the Estimator
 * is private to the owner's account (enforced by AppGate) and reached via the
 * menu bar, which only appears for accounts that can access more than one app.
 * Only the active app's provider mounts; auth lives above this in page.tsx.
 */
export default function Toolkit() {
  // Start at Workback for a deterministic first render; the effect syncs to the
  // real hash on mount and on every hashchange.
  const [active, setActive] = useState<AppId>("workback");

  useEffect(() => {
    const sync = () => setActive(parseAppFromHash(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <>
      <AppBar active={active} />
      {active === "estimator" ? (
        <AppGate appId="estimator">
          <EstimateProvider>
            <EstimatorApp />
          </EstimateProvider>
        </AppGate>
      ) : active === "bid-specs" ? (
        <AppGate appId="bid-specs">
          <BidSpecsProvider>
            <BidSpecsApp />
          </BidSpecsProvider>
        </AppGate>
      ) : (
        <ProjectProvider>
          <App />
        </ProjectProvider>
      )}
    </>
  );
}
