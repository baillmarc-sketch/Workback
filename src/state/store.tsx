"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type { Project } from "@/lib/types";
import { saveProject } from "@/lib/storage";

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
    dispatch({ type: "commit", project: { ...up(cur), updatedAt: Date.now() } });
  }, []);

  const patch = useCallback((up: (p: Project) => Project) => {
    const cur = stateRef.current.project;
    if (!cur) return;
    dispatch({ type: "patch", project: { ...up(cur), updatedAt: Date.now() } });
  }, []);

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  // Auto-save: debounce writes to localStorage on every change
  useEffect(() => {
    if (!state.project) return;
    const p = state.project;
    const t = setTimeout(() => saveProject(p), 250);
    return () => clearTimeout(t);
  }, [state.project]);

  const value = useMemo<Store>(
    () => ({
      project: state.project,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      open,
      close,
      commit,
      patch,
      undo,
      redo,
    }),
    [state.project, state.past.length, state.future.length, open, close, commit, patch, undo, redo]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside ProjectProvider");
  return ctx;
}
