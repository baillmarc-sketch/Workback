"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { Estimate } from "@/lib/estimator/types";
import { saveEstimate } from "@/lib/estimator/storage";
import { newShareId, publishEstimate } from "@/lib/estimator/cloud";
import { pushEstimate } from "@/lib/estimator/account";
import { saveTeamDoc } from "@/lib/teamWorkspace";
import { useAuth } from "./auth";
import type { Workspace } from "./store";

export type SyncState = "idle" | "syncing" | "synced" | "offline";

const HISTORY_LIMIT = 20;
/** Re-attempt a failed cloud push after this long if nothing else triggers it. */
const CLOUD_RETRY_MS = 8000;

interface State {
  estimate: Estimate | null;
  past: Estimate[];
  future: Estimate[];
}

type Action =
  | { type: "open"; estimate: Estimate }
  | { type: "close" }
  | { type: "commit"; estimate: Estimate } // undoable change
  | { type: "patch"; estimate: Estimate } // view-only change, no history entry
  | { type: "undo" }
  | { type: "redo" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "open":
      return { estimate: action.estimate, past: [], future: [] };
    case "close":
      return { estimate: null, past: [], future: [] };
    case "commit": {
      if (!state.estimate) return state;
      const past = [...state.past, state.estimate].slice(-HISTORY_LIMIT);
      return { estimate: action.estimate, past, future: [] };
    }
    case "patch":
      return { ...state, estimate: action.estimate };
    case "undo": {
      if (!state.estimate || state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        estimate: prev,
        past: state.past.slice(0, -1),
        future: [state.estimate, ...state.future],
      };
    }
    case "redo": {
      if (!state.estimate || state.future.length === 0) return state;
      const next = state.future[0];
      return {
        estimate: next,
        past: [...state.past, state.estimate].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }
  }
}

interface Store {
  estimate: Estimate | null;
  canUndo: boolean;
  canRedo: boolean;
  /** Cloud sync status for estimates with a shareId */
  syncState: SyncState;
  /** Which workspace the open estimate belongs to (drives where saves go). */
  workspace: Workspace;
  open: (estimate: Estimate) => void;
  /** Open an estimate that lives in a team's shared workspace. */
  openInWorkspace: (estimate: Estimate, workspace: Workspace) => void;
  close: () => void;
  /** Undoable mutation — pushes onto the history stack */
  commit: (up: (e: Estimate) => Estimate) => void;
  /** Non-undoable mutation (view settings, baseline, etc.) */
  patch: (up: (e: Estimate) => Estimate) => void;
  undo: () => void;
  redo: () => void;
}

// Exported so headless render smoke-tests can supply a mock store without the
// full provider/auth/firebase stack.
export const StoreContext = createContext<Store | null>(null);

function hasAnyCell(e: Estimate): boolean {
  return Object.keys(e.cells).length > 0;
}

export function EstimateProvider({ children }: { children: React.ReactNode }) {
  const { user, getToken } = useAuth();
  const [state, dispatch] = useReducer(reducer, {
    estimate: null,
    past: [],
    future: [],
  });

  // useRef so commit/patch callbacks stay stable while reading fresh state
  const stateRef = useRef(state);
  stateRef.current = state;

  const [workspace, setWorkspace] = useState<Workspace>({ kind: "personal" });
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  const open = useCallback((estimate: Estimate) => {
    workspaceRef.current = { kind: "personal" };
    setWorkspace({ kind: "personal" });
    dispatch({ type: "open", estimate });
  }, []);
  const openInWorkspace = useCallback((estimate: Estimate, ws: Workspace) => {
    workspaceRef.current = ws;
    setWorkspace(ws);
    dispatch({ type: "open", estimate });
  }, []);
  const close = useCallback(() => dispatch({ type: "close" }), []);

  const commit = useCallback((up: (e: Estimate) => Estimate) => {
    const cur = stateRef.current.estimate;
    if (!cur) return;
    let next = { ...up(cur), updatedAt: Date.now() };
    // Auto-provision an online backup + ready link the first time an estimate
    // has real content, so work survives a crash and a share link exists
    // before you click Share. The unguessable ID is the access control.
    if (!next.shareId && hasAnyCell(next)) {
      next = { ...next, shareId: newShareId() };
    }
    dispatch({ type: "commit", estimate: next });
  }, []);

  const patch = useCallback((up: (e: Estimate) => Estimate) => {
    const cur = stateRef.current.estimate;
    if (!cur) return;
    dispatch({ type: "patch", estimate: { ...up(cur), updatedAt: Date.now() } });
  }, []);

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  const [syncState, setSyncState] = useState<SyncState>("idle");
  const lastPushedRef = useRef<string>("");
  const lastAccountPushedRef = useRef<string>("");
  const cloudInFlight = useRef(false);
  const accountInFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Team-workspace save (routes to /teamWorkspaces instead of local+account).
  const teamStampRef = useRef<string>("");
  const teamInFlight = useRef(false);
  const flushTeam = useCallback(() => {
    const e = stateRef.current.estimate;
    const ws = workspaceRef.current;
    if (!e || ws.kind !== "team") return;
    const stamp = `${e.id}:${e.updatedAt}`;
    if (teamStampRef.current === stamp) {
      setSyncState("synced");
      return;
    }
    if (teamInFlight.current) return;
    const teamId = ws.teamId;
    teamInFlight.current = true;
    setSyncState("syncing");
    getToken()
      .then((token) => (token ? saveTeamDoc(teamId, "estimator", e, token) : Promise.reject(new Error("no token"))))
      .then(() => {
        teamStampRef.current = stamp;
        teamInFlight.current = false;
        const cur = stateRef.current.estimate;
        if (cur && `${cur.id}:${cur.updatedAt}` !== stamp) flushTeam();
        else setSyncState("synced");
      })
      .catch(() => {
        teamInFlight.current = false;
        setSyncState("offline");
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(flushTeam, CLOUD_RETRY_MS);
      });
  }, [getToken]);

  // Flush the latest state on tab hide/close so the autosave debounce can't drop
  // the last edit — to the team path for team docs, else localStorage.
  useEffect(() => {
    const flush = () => {
      const e = stateRef.current.estimate;
      if (!e) return;
      if (workspaceRef.current.kind === "team") flushTeam();
      else saveEstimate(e, { setLastOpen: false });
    };
    const onVisible = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flushTeam]);

  // Auto-save: debounce localStorage writes; push shared estimates to the cloud
  // and signed-in users' estimates to their account. Pushes read the latest
  // estimate from the ref and de-dupe on a stamp, so a retry (new edit, focus,
  // or `online`) always syncs what's current — a failed push never stays stale.
  const flushCloud = useCallback(() => {
    const run = () => {
      const e = stateRef.current.estimate;
      if (!e?.shareId) return;
      const stamp = `${e.id}:${e.updatedAt}`;
      if (lastPushedRef.current === stamp) {
        setSyncState("synced");
        return;
      }
      if (cloudInFlight.current) return;
      cloudInFlight.current = true;
      setSyncState("syncing");
      publishEstimate(e)
        .then(() => {
          lastPushedRef.current = stamp;
          cloudInFlight.current = false;
          const cur = stateRef.current.estimate;
          if (cur?.shareId && `${cur.id}:${cur.updatedAt}` !== stamp) run();
          else setSyncState("synced");
        })
        .catch(() => {
          cloudInFlight.current = false;
          setSyncState("offline");
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(run, CLOUD_RETRY_MS);
        });
    };
    run();
  }, []);

  const flushAccount = useCallback(() => {
    const e = stateRef.current.estimate;
    if (!user || !e) return;
    const stamp = `${e.id}:${e.updatedAt}`;
    if (lastAccountPushedRef.current === stamp || accountInFlight.current) return;
    accountInFlight.current = true;
    const uid = user.uid;
    getToken()
      .then((token) => (token ? pushEstimate(uid, token, e) : undefined))
      .then(() => {
        lastAccountPushedRef.current = stamp;
        accountInFlight.current = false;
      })
      .catch(() => {
        accountInFlight.current = false;
      });
  }, [user, getToken]);

  useEffect(() => {
    if (!state.estimate) return;
    const e = state.estimate;
    // Team estimates save only to the shared team path — never the personal
    // index or the user's account.
    if (workspace.kind === "team") {
      const tTeam = setTimeout(flushTeam, 600);
      return () => clearTimeout(tTeam);
    }
    const tLocal = setTimeout(() => saveEstimate(e), 250);
    const tCloud = setTimeout(flushCloud, 1200);
    const tAccount = setTimeout(flushAccount, 1200);
    return () => {
      clearTimeout(tLocal);
      clearTimeout(tCloud);
      clearTimeout(tAccount);
    };
  }, [state.estimate, workspace.kind, flushCloud, flushAccount, flushTeam]);

  useEffect(() => {
    const retry = () => {
      flushCloud();
      flushAccount();
      flushTeam();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flushCloud, flushAccount, flushTeam]);

  const value = useMemo<Store>(
    () => ({
      estimate: state.estimate,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      syncState,
      workspace,
      open,
      openInWorkspace,
      close,
      commit,
      patch,
      undo,
      redo,
    }),
    [state.estimate, state.past.length, state.future.length, syncState, workspace, open, openInWorkspace, close, commit, patch, undo, redo]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useEstimate(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useEstimate must be used inside EstimateProvider");
  return ctx;
}
