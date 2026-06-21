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
import type { Bid } from "@/lib/aicp/types";
import { saveBid } from "@/lib/aicp/storage";
import { newShareId, publishBid } from "@/lib/aicp/cloud";
import { pushBid } from "@/lib/aicp/account";
import { useAuth } from "./auth";

export type SyncState = "idle" | "syncing" | "synced" | "offline";

const HISTORY_LIMIT = 20;
const CLOUD_RETRY_MS = 8000;

interface State {
  bid: Bid | null;
  past: Bid[];
  future: Bid[];
}

type Action =
  | { type: "open"; bid: Bid }
  | { type: "close" }
  | { type: "commit"; bid: Bid }
  | { type: "patch"; bid: Bid }
  | { type: "undo" }
  | { type: "redo" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "open":
      return { bid: action.bid, past: [], future: [] };
    case "close":
      return { bid: null, past: [], future: [] };
    case "commit": {
      if (!state.bid) return state;
      const past = [...state.past, state.bid].slice(-HISTORY_LIMIT);
      return { bid: action.bid, past, future: [] };
    }
    case "patch":
      return { ...state, bid: action.bid };
    case "undo": {
      if (!state.bid || state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return { bid: prev, past: state.past.slice(0, -1), future: [state.bid, ...state.future] };
    }
    case "redo": {
      if (!state.bid || state.future.length === 0) return state;
      const next = state.future[0];
      return { bid: next, past: [...state.past, state.bid].slice(-HISTORY_LIMIT), future: state.future.slice(1) };
    }
  }
}

interface Store {
  bid: Bid | null;
  canUndo: boolean;
  canRedo: boolean;
  syncState: SyncState;
  open: (bid: Bid) => void;
  close: () => void;
  /** Undoable mutation — pushes onto the history stack. */
  commit: (up: (b: Bid) => Bid) => void;
  /** Non-undoable mutation (view settings, etc.). */
  patch: (up: (b: Bid) => Bid) => void;
  undo: () => void;
  redo: () => void;
}

export const AicpStoreContext = createContext<Store | null>(null);

function hasAnyContent(b: Bid): boolean {
  return Object.keys(b.cells).length > 0;
}

export function AicpProvider({ children }: { children: React.ReactNode }) {
  const { user, getToken } = useAuth();
  const [state, dispatch] = useReducer(reducer, { bid: null, past: [], future: [] });

  const stateRef = useRef(state);
  stateRef.current = state;

  const open = useCallback((bid: Bid) => dispatch({ type: "open", bid }), []);
  const close = useCallback(() => dispatch({ type: "close" }), []);

  const commit = useCallback((up: (b: Bid) => Bid) => {
    const cur = stateRef.current.bid;
    if (!cur) return;
    let next = { ...up(cur), updatedAt: Date.now() };
    // Auto-provision an online backup + ready share link the first time a bid
    // has real content, so work survives a crash and a link exists before Share.
    if (!next.shareId && hasAnyContent(next)) next = { ...next, shareId: newShareId() };
    dispatch({ type: "commit", bid: next });
  }, []);

  const patch = useCallback((up: (b: Bid) => Bid) => {
    const cur = stateRef.current.bid;
    if (!cur) return;
    dispatch({ type: "patch", bid: { ...up(cur), updatedAt: Date.now() } });
  }, []);

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  const [syncState, setSyncState] = useState<SyncState>("idle");
  const lastPushedRef = useRef<string>("");
  const lastAccountPushedRef = useRef<string>("");
  const cloudInFlight = useRef(false);
  const accountInFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Flush the latest state to localStorage on tab hide/close so the autosave
  // debounce can't drop the last edit.
  useEffect(() => {
    const flush = () => {
      const b = stateRef.current.bid;
      if (b) saveBid(b, { setLastOpen: false });
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

  const flushCloud = useCallback(() => {
    const run = () => {
      const b = stateRef.current.bid;
      if (!b?.shareId) return;
      const stamp = `${b.id}:${b.updatedAt}`;
      if (lastPushedRef.current === stamp) {
        setSyncState("synced");
        return;
      }
      if (cloudInFlight.current) return;
      cloudInFlight.current = true;
      setSyncState("syncing");
      publishBid(b)
        .then(() => {
          lastPushedRef.current = stamp;
          cloudInFlight.current = false;
          const cur = stateRef.current.bid;
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
    const b = stateRef.current.bid;
    if (!user || !b) return;
    const stamp = `${b.id}:${b.updatedAt}`;
    if (lastAccountPushedRef.current === stamp || accountInFlight.current) return;
    accountInFlight.current = true;
    const uid = user.uid;
    getToken()
      .then((token) => (token ? pushBid(uid, token, b) : undefined))
      .then(() => {
        lastAccountPushedRef.current = stamp;
        accountInFlight.current = false;
      })
      .catch(() => {
        accountInFlight.current = false;
      });
  }, [user, getToken]);

  useEffect(() => {
    if (!state.bid) return;
    const b = state.bid;
    const tLocal = setTimeout(() => saveBid(b), 250);
    const tCloud = setTimeout(flushCloud, 1200);
    const tAccount = setTimeout(flushAccount, 1200);
    return () => {
      clearTimeout(tLocal);
      clearTimeout(tCloud);
      clearTimeout(tAccount);
    };
  }, [state.bid, flushCloud, flushAccount]);

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
      bid: state.bid,
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
    [state.bid, state.past.length, state.future.length, syncState, open, close, commit, patch, undo, redo]
  );

  return <AicpStoreContext.Provider value={value}>{children}</AicpStoreContext.Provider>;
}

export function useBid(): Store {
  const ctx = useContext(AicpStoreContext);
  if (!ctx) throw new Error("useBid must be used inside AicpProvider");
  return ctx;
}
