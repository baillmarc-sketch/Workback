"use client";

import { useEffect, useState } from "react";
import { parseAppFromHash, type ActiveApp } from "@/lib/toolkit";
import { ProjectProvider } from "@/state/store";
import { EstimateProvider } from "@/state/estimateStore";
import AppGate from "./AppGate";
import App from "./App";
import ToolkitHome from "./ToolkitHome";
import EstimatorApp from "./estimator/EstimatorApp";

/**
 * Platform shell: reads the URL hash, picks the active app, and mounts ONLY
 * that app's provider so the two stores never coexist. Auth lives above this in
 * page.tsx and is shared by every app. Legacy Workback deep links (`#p=`,
 * `#wb=`) resolve to Workback via parseAppFromHash, so nothing breaks.
 */
export default function Toolkit() {
  // Start at "home" for a deterministic server/first render; the effect syncs
  // to the real hash on mount (and on every hashchange) to avoid hydration drift.
  const [active, setActive] = useState<ActiveApp>("home");

  useEffect(() => {
    const sync = () => setActive(parseAppFromHash(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  if (active === "workback") {
    return (
      <AppGate appId="workback">
        <ProjectProvider>
          <App />
        </ProjectProvider>
      </AppGate>
    );
  }

  if (active === "estimator") {
    return (
      <AppGate appId="estimator">
        <EstimateProvider>
          <EstimatorApp />
        </EstimateProvider>
      </AppGate>
    );
  }

  return <ToolkitHome />;
}
