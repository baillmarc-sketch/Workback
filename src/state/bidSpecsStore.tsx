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
import type { BidSpec } from "@/lib/bidSpecs/types";
import { saveBidSpec } from "@/lib/bidSpecs/storage";
import { newShareId, publishBidSpec } from "@/lib/bidSpecs/cloud";
import { pushBidSpec } from "@/lib/bidSpecs/account";
import { useAuth } from "./auth";

export type SyncState = "idle" | "syncing" | "synced" | "offline";

const HISTORY_LIMIT = 20;
const CLOUD_RETRY_MS = 8000;

interface State {
  spec: BidSpec | null;
  past: BidSpec[];
  future: BidSpec[];
}

type Action =
  | { type: "open"; spec: BidSpec }
  | { type: "close" }
  | { type: "commit"; spec: BidSpec }
  | { type: "patch"; spec: BidSpec }
  | { type: "undo" }
  | { type: "redo" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "open":
      return { spec: action.spec, past: [], future: [] };
    case "close":
      return { spec: null, past: [], future: [] };
    case "commit": {
      if (!state.spec) return state;
      const past = [...state.past, state.spec].slice(-HISTORY_LIMIT);
      return { spec: action.spec, past, future: [] };
    }
    case "patch":
      return { ...state, spec: action.spec };
    case "undo": {
      if (!state.spec || state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return { spec: prev, past: state.past.slice(0, -1), future: [state.spec, ...state.future] };
    }
    case "redo": {
      if (!state.spec || state.future.length === 0) return state;
      const next = state.future[0];
      return {
        spec: next,
        past: [...state.past, state.spec].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }
  }
}

interface Store {
  spec: BidSpec | null;
  canUndo: boolean;
  canRedo: boolean;
  syncState: SyncState;
  open: (spec: BidSpec) => void;
  close: () => void;
  /** Undoable mutation — pushes onto the history stack. */
  commit: (up: (s: BidSpec) => BidSpec) => void;
  /** Non-undoable mutation (share link, view settings). */
  patch: (up: (s: BidSpec) => BidSpec) => void;
  undo: () => void;
  redo: () => void;
}

export const StoreContext = createContext<Store | null>(null);

/** A spec has "real content" once it has a title or any filled-in field. */
function hasContent(s: BidSpec): boolean {
  return (
    (s.title.trim() !== "" && s.title !== "Untitled Bid Specs") ||
    s.fields.some((f) => f.value.trim() !== "") ||
    s.specs.some((c) => c.title.trim() !== "")
  );
}

export function BidSpecsProvider({ children }: { children: React.ReactNode }) {
  const { user, getToken } = useAuth();
  const [state, dispatch] = useReducer(reducer, { spec: null, past: [], future: [] });

  const stateRef = useRef(state);
  stateRef.current = state;

  const open = useCallback((spec: BidSpec) => dispatch({ type: "open", spec }), []);
  const close = useCallback(() => dispatch({ type: "close" }), []);

  const commit = useCallback((up: (s: BidSpec) => BidSpec) => {
    const cur = stateRef.current.spec;
    if (!cur) return;
    let next = { ...up(cur), updatedAt: Date.now() };
    // Auto-provision an online backup + ready link the first time a spec has real
    // content, so work survives a crash and a share link exists before Share.
    if (!next.shareId && hasContent(next)) {
      next = { ...next, shareId: newShareId() };
    }
    dispatch({ type: "commit", spec: next });
  }, []);

  const patch = useCallback((up: (s: BidSpec) => BidSpec) => {
    const cur = stateRef.current.spec;
    if (!cur) return;
    dispatch({ type: "patch", spec: { ...up(cur), updatedAt: Date.now() } });
  }, []);

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  // Flush to localStorage the instant the tab hides/closes.
  useEffect(() => {
    const flush = () => {
      const s = stateRef.current.spec;
      if (s) saveBidSpec(s, { setLastOpen: false });
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

  const [syncState, setSyncState] = useState<SyncState>("idle");
  const lastPushedRef = useRef<string>("");
  const lastAccountPushedRef = useRef<string>("");
  const cloudInFlight = useRef(false);
  const accountInFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flushCloud = useCallback(() => {
    const run = () => {
      const s = stateRef.current.spec;
      if (!s?.shareId) return;
      const stamp = `${s.id}:${s.updatedAt}`;
      if (lastPushedRef.current === stamp) {
        setSyncState("synced");
        return;
      }
      if (cloudInFlight.current) return;
      cloudInFlight.current = true;
      setSyncState("syncing");
      publishBidSpec(s)
        .then(() => {
          lastPushedRef.current = stamp;
          cloudInFlight.current = false;
          const cur = stateRef.current.spec;
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
    const s = stateRef.current.spec;
    if (!user || !s) return;
    const stamp = `${s.id}:${s.updatedAt}`;
    if (lastAccountPushedRef.current === stamp || accountInFlight.current) return;
    accountInFlight.current = true;
    const uid = user.uid;
    getToken()
      .then((token) => (token ? pushBidSpec(uid, token, s) : undefined))
      .then(() => {
        lastAccountPushedRef.current = stamp;
        accountInFlight.current = false;
      })
      .catch(() => {
        accountInFlight.current = false;
      });
  }, [user, getToken]);

  useEffect(() => {
    if (!state.spec) return;
    const s = state.spec;
    const tLocal = setTimeout(() => saveBidSpec(s), 250);
    const tCloud = setTimeout(flushCloud, 1200);
    const tAccount = setTimeout(flushAccount, 1200);
    return () => {
      clearTimeout(tLocal);
      clearTimeout(tCloud);
      clearTimeout(tAccount);
    };
  }, [state.spec, flushCloud, flushAccount]);

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
      spec: state.spec,
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
    [state.spec, state.past.length, state.future.length, syncState, open, close, commit, patch, undo, redo]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useBidSpec(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useBidSpec must be used inside BidSpecsProvider");
  return ctx;
}
