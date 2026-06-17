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
/** How long to wait before re-attempting a failed cloud push when nothing else
 *  (a new edit, regained focus, or the `online` event) has triggered a retry. */
const CLOUD_RETRY_MS = 8000;

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

const StoreContext = createContext<Store | null>(null);

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

  // Auto-save: debounce writes to localStorage on every change, and push shared
  // projects to the cloud copy and signed-in users' projects to their account.
  // The push helpers read the latest project from the ref and de-dupe on a
  // per-state stamp, so a retry (new edit, regained focus, or `online`) always
  // syncs whatever is current — a failed push never stays silently stale.
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const lastPushedRef = useRef<string>("");
  const lastAccountPushedRef = useRef<string>("");
  const cloudInFlight = useRef(false);
  const accountInFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flushCloud = useCallback(() => {
    const run = () => {
      const p = stateRef.current.project;
      if (!p?.shareId) return;
      const stamp = `${p.id}:${p.updatedAt}`;
      if (lastPushedRef.current === stamp) {
        setSyncState("synced"); // already up to date (e.g. a focus-triggered retry)
        return;
      }
      if (cloudInFlight.current) return; // a push is running; it re-checks on finish
      cloudInFlight.current = true;
      setSyncState("syncing");
      publishProject(p)
        .then(() => {
          lastPushedRef.current = stamp;
          cloudInFlight.current = false;
          const cur = stateRef.current.project;
          // More edits landed while pushing? Keep going. Otherwise we're synced.
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
    const p = stateRef.current.project;
    if (!user || !p) return;
    const stamp = `${p.id}:${p.updatedAt}`;
    if (lastAccountPushedRef.current === stamp || accountInFlight.current) return;
    accountInFlight.current = true;
    const uid = user.uid;
    getToken()
      .then((token) => (token ? pushProject(uid, token, p) : undefined))
      .then(() => {
        lastAccountPushedRef.current = stamp;
        accountInFlight.current = false;
      })
      .catch(() => {
        accountInFlight.current = false; // retried on reconnect/focus/next edit
      });
  }, [user, getToken]);

  useEffect(() => {
    if (!state.project) return;
    const p = state.project;
    const tLocal = setTimeout(() => saveProject(p), 250);
    const tCloud = setTimeout(flushCloud, 1200);
    const tAccount = setTimeout(flushAccount, 1200);
    return () => {
      clearTimeout(tLocal);
      clearTimeout(tCloud);
      clearTimeout(tAccount);
    };
  }, [state.project, flushCloud, flushAccount]);

  // Retry pending pushes the moment connectivity or focus returns — not only on
  // the next edit. This is what keeps "saved" honest after a transient failure.
  useEffect(() => {
    const retry = () => {
      flushCloud();
      flushAccount();
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
  }, [flushCloud, flushAccount]);

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
