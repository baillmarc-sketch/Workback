"use client";

import { useEffect, useState } from "react";
import { isToolkitUnlocked, parseAppFromHash, type ActiveApp } from "@/lib/toolkit";
import { ProjectProvider } from "@/state/store";
import { EstimateProvider } from "@/state/estimateStore";
import AppGate from "./AppGate";
import App from "./App";
import ToolkitHome from "./ToolkitHome";
import ToolkitLockButton from "./ToolkitLockButton";
import EstimatorApp from "./estimator/EstimatorApp";

/**
 * Platform shell. Workback is the default landing; the app launcher ("home")
 * and the Estimator sit behind a password lock (the "Locked: Toolkit" button on
 * the Workback view). A shared estimate link (`#e=`) always opens — it carries
 * its own unguessable share ID, so it bypasses the lock for recipients.
 *
 * Only the active app's provider mounts; auth lives above this in page.tsx and
 * is shared by every app.
 */
export default function Toolkit() {
  // Track the raw hash so we can tell a shared "#e=" link from "#app=estimator".
  const [hash, setHash] = useState("");
  // Bumped after a successful unlock so the shell re-reads the unlock flag.
  const [, setTick] = useState(0);

  useEffect(() => {
    const sync = () => {
      setHash(window.location.hash);
      setTick((n) => n + 1);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const requested: ActiveApp = parseAppFromHash(hash);
  const unlocked = isToolkitUnlocked();
  const isSharedEstimate = hash.startsWith("#e=");

  // Resolve the locked routes down to Workback unless the toolkit is unlocked.
  let active: ActiveApp = requested;
  if (requested === "home" && !unlocked) active = "workback";
  if (requested === "estimator" && !unlocked && !isSharedEstimate) active = "workback";

  if (active === "estimator") {
    return (
      <AppGate appId="estimator">
        <EstimateProvider>
          <EstimatorApp />
        </EstimateProvider>
      </AppGate>
    );
  }

  if (active === "home") {
    return <ToolkitHome />;
  }

  return (
    <AppGate appId="workback">
      <ProjectProvider>
        <App />
      </ProjectProvider>
      <ToolkitLockButton />
    </AppGate>
  );
}
