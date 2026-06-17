"use client";

import { useMemo } from "react";
import type { Project } from "@/lib/types";
import type { Estimate } from "@/lib/estimator/types";
import { StoreContext as ProjectStoreContext } from "@/state/store";
import { StoreContext as EstimateStoreContext } from "@/state/estimateStore";
import Calendar from "../Calendar";
import EstimateGrid from "../estimator/EstimateGrid";
import ProjectDetailsPanel from "../estimator/ProjectDetailsPanel";

/**
 * Read-only viewers for the admin "view as" feature. They mount the existing
 * render components under a no-op StoreContext instead of the real
 * ProjectProvider/EstimateProvider, so nothing autosaves to localStorage or
 * pushes to anyone's account — the data is purely display. `commit`/`patch` are
 * no-ops, which also neutralizes any stray edit handler.
 */

const noop = () => {};

const baseStore = {
  canUndo: false,
  canRedo: false,
  syncState: "idle" as const,
  workspace: { kind: "personal" } as const,
  open: noop,
  openInWorkspace: noop,
  close: noop,
  commit: noop,
  patch: noop,
  undo: noop,
  redo: noop,
};

export function ReadOnlyProjectView({ project }: { project: Project }) {
  const store = useMemo(() => ({ ...baseStore, project }), [project]);
  return (
    <ProjectStoreContext.Provider value={store}>
      <Calendar
        project={project}
        selectedId={null}
        downstreamMode={false}
        readOnly
        onSelectEvent={noop}
        onDayClick={noop}
        onMoreClick={noop}
      />
    </ProjectStoreContext.Provider>
  );
}

export function ReadOnlyEstimateView({ estimate }: { estimate: Estimate }) {
  const store = useMemo(() => ({ ...baseStore, estimate }), [estimate]);
  return (
    <EstimateStoreContext.Provider value={store}>
      <ProjectDetailsPanel key={estimate.id} />
      <EstimateGrid mode="all" />
    </EstimateStoreContext.Provider>
  );
}
