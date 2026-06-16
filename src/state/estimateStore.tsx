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
import { useAuth } from "./auth";

export type SyncState = "idle" | "syncing" | "synced" | "offline";

const HISTORY_LIMIT = 20;

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
  open: (estimate: Estimate) => void;
  close: () => void;
  /** Undoable mutation — pushes onto the history stack */
  commit: (up: (e: Estimate) => Estimate) => void;
  /** Non-undoable mutation (view settings, baseline, etc.) */
  patch: (up: (e: Estimate) => Estimate) => void;
  undo: () => void;
  redo: () => void;
}

const StoreContext = createContext<Store | null>(null);

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

  const open = useCallback((estimate: Estimate) => dispatch({ type: "open", estimate }), []);
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

  // Flush the latest state to localStorage the instant the tab is hidden or
  // closed, so the autosave debounce can't drop the last edit.
  useEffect(() => {
    const flush = () => {
      const e = stateRef.current.estimate;
      if (e) saveEstimate(e, { setLastOpen: false });
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
  }, []);

  // Auto-save: debounce writes to localStorage on every change, and push
  // shared estimates to the cloud copy and signed-in users' estimates to
  // their account (skipping states we already pushed, so syncs don't echo)
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const lastPushedRef = useRef<string>("");
  const lastAccountPushedRef = useRef<string>("");
  useEffect(() => {
    if (!state.estimate) return;
    const e = state.estimate;
    const t = setTimeout(() => saveEstimate(e), 250);
    let t2: ReturnType<typeof setTimeout> | undefined;
    let t3: ReturnType<typeof setTimeout> | undefined;
    const stamp = `${e.id}:${e.updatedAt}`;
    if (e.shareId && lastPushedRef.current !== stamp) {
      t2 = setTimeout(() => {
        setSyncState("syncing");
        publishEstimate(e)
          .then(() => {
            lastPushedRef.current = stamp;
            setSyncState("synced");
          })
          .catch(() => setSyncState("offline"));
      }, 1200);
    }
    if (user && lastAccountPushedRef.current !== stamp) {
      const uid = user.uid;
      t3 = setTimeout(() => {
        getToken()
          .then((token) => (token ? pushEstimate(uid, token, e) : undefined))
          .then(() => {
            lastAccountPushedRef.current = stamp;
          })
          .catch(() => {}); // next edit or focus sync retries
      }, 1200);
    }
    return () => {
      clearTimeout(t);
      if (t2) clearTimeout(t2);
      if (t3) clearTimeout(t3);
    };
  }, [state.estimate, user, getToken]);

  const value = useMemo<Store>(
    () => ({
      estimate: state.estimate,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      syncState,
      open,
      close,
      commit,
      patch,
      undo,
      redo,
    }),
    [state.estimate, state.past.length, state.future.length, syncState, open, close, commit, patch, undo, redo]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useEstimate(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useEstimate must be used inside EstimateProvider");
  return ctx;
}
