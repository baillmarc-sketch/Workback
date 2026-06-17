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
import type { Project } from "@/lib/types";
import { saveProject } from "@/lib/storage";
import { describeChange, pushHistory } from "@/lib/history";
import { newShareId, publishProject } from "@/lib/cloud";
import { pushProject } from "@/lib/account";
import { useAuth } from "./auth";

export type SyncState = "idle" | "syncing" | "synced" | "offline";

const HISTORY_LIMIT = 20;

interface State {
  project: Project | null;
  past: Project[];
  future: Project[];
}

type Action =
  | { type: "open"; project: Project }
  | { type: "close" }
  | { type: "commit"; project: Project } // undoable change
  | { type: "patch"; project: Project } // view-only change, no history entry
  | { type: "undo" }
  | { type: "redo" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "open":
      return { project: action.project, past: [], future: [] };
    case "close":
      return { project: null, past: [], future: [] };
    case "commit": {
      if (!state.project) return state;
      const past = [...state.past, state.project].slice(-HISTORY_LIMIT);
      return { project: action.project, past, future: [] };
    }
    case "patch":
      return { ...state, project: action.project };
    case "undo": {
      if (!state.project || state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        project: prev,
        past: state.past.slice(0, -1),
        future: [state.project, ...state.future],
      };
    }
    case "redo": {
      if (!state.project || state.future.length === 0) return state;
      const next = state.future[0];
      return {
        project: next,
        past: [...state.past, state.project].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }
  }
}

interface Store {
  project: Project | null;
  canUndo: boolean;
  canRedo: boolean;
  /** Cloud sync status for projects with a shareId */
  syncState: SyncState;
  open: (project: Project) => void;
  close: () => void;
  /** Undoable mutation — pushes onto the history stack */
  commit: (up: (p: Project) => Project) => void;
  /** Non-undoable mutation (view settings, anchor month, etc.) */
  patch: (up: (p: Project) => Project) => void;
  undo: () => void;
  redo: () => void;
}

// Exported so a read-only viewer (e.g. the admin "view as" page) can supply a
// no-op store and render the calendar without the autosaving provider.
export const StoreContext = createContext<Store | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user, getToken } = useAuth();
  const [state, dispatch] = useReducer(reducer, {
    project: null,
    past: [],
    future: [],
  });

  // useRef so commit/patch callbacks stay stable while reading fresh state
  const stateRef = useRef(state);
  stateRef.current = state;

  const open = useCallback((project: Project) => dispatch({ type: "open", project }), []);
  const close = useCallback(() => dispatch({ type: "close" }), []);

  const commit = useCallback((up: (p: Project) => Project) => {
    const cur = stateRef.current.project;
    if (!cur) return;
    let next = { ...up(cur), updatedAt: Date.now() };
    // Auto-provision an online backup + ready link the first time a project
    // has real content, so work survives a crash/power loss and a share link
    // already exists before you click Share. The unguessable ID is the access
    // control; "Reset link" can revoke it.
    if (!next.shareId && next.events.length > 0) {
      next = { ...next, shareId: newShareId() };
    }
    dispatch({ type: "commit", project: next });
    // Persistent, browsable history (survives reload) — best-effort
    try {
      pushHistory(next.id, describeChange(cur, next), next);
    } catch {}
  }, []);

  const patch = useCallback((up: (p: Project) => Project) => {
    const cur = stateRef.current.project;
    if (!cur) return;
    dispatch({ type: "patch", project: { ...up(cur), updatedAt: Date.now() } });
  }, []);

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  // Flush the latest state to localStorage the instant the tab is hidden or
  // closed, so the 250ms autosave debounce can't drop the last edit.
  useEffect(() => {
    const flush = () => {
      const p = stateRef.current.project;
      if (p) saveProject(p, { setLastOpen: false });
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
  // shared projects to the cloud copy and signed-in users' projects to
  // their account (skipping states we already pushed or just pulled, so
  // syncs don't echo)
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const lastPushedRef = useRef<string>("");
  const lastAccountPushedRef = useRef<string>("");
  useEffect(() => {
    if (!state.project) return;
    const p = state.project;
    const t = setTimeout(() => saveProject(p), 250);
    let t2: ReturnType<typeof setTimeout> | undefined;
    let t3: ReturnType<typeof setTimeout> | undefined;
    const stamp = `${p.id}:${p.updatedAt}`;
    if (p.shareId && lastPushedRef.current !== stamp) {
      t2 = setTimeout(() => {
        setSyncState("syncing");
        publishProject(p)
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
          .then((token) => (token ? pushProject(uid, token, p) : undefined))
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
  }, [state.project, user, getToken]);

  const value = useMemo<Store>(
    () => ({
      project: state.project,
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
    [state.project, state.past.length, state.future.length, syncState, open, close, commit, patch, undo, redo]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside ProjectProvider");
  return ctx;
}
