"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth";
import { hasEntitlement } from "@/lib/entitlements";
import type { AppId } from "@/lib/toolkit";
import { EMPTY_ACCESS, loadAccess, type AccessSnapshot, type Role } from "@/lib/admin/access";
import { writeRegistry } from "@/lib/admin/registry";

interface AccessCtx {
  /** False while the snapshot is loading; true once resolved (or signed out). */
  ready: boolean;
  isAdmin: boolean;
  role: Role | null;
  /** The raw snapshot, for admin UI that needs the individual flags. */
  snapshot: AccessSnapshot;
  /** Synchronous access check — safe to call during render. */
  can: (appId: AppId) => boolean;
  /** Re-read the snapshot after a self-affecting change (e.g. claiming owner). */
  refresh: () => void;
}

const AccessContext = createContext<AccessCtx | null>(null);

/**
 * Loads and caches the signed-in user's access (admin / role / entitlement /
 * invite) once, so gating decisions stay synchronous. Lives directly under
 * AuthProvider. The registry write is chained BEFORE the access load because the
 * invite self-read rule authorizes against the /registry/{uid}/emailKey mirror.
 */
export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { user, ready: authReady, getToken } = useAuth();
  const [snapshot, setSnapshot] = useState<AccessSnapshot>(EMPTY_ACCESS);
  const [ready, setReady] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!authReady) {
      setReady(false);
      return;
    }
    if (!user) {
      setSnapshot(EMPTY_ACCESS);
      setReady(true);
      return;
    }
    setReady(false);
    (async () => {
      const token = await getToken();
      if (cancelled) return;
      if (!token) {
        setSnapshot(EMPTY_ACCESS);
        setReady(true);
        return;
      }
      // Registry write MUST precede the access load: the invite self-read rule
      // matches /invites/{emailKey} against /registry/{uid}/emailKey, so the
      // mirror has to exist before loadAccess reads the invite.
      await writeRegistry(user.uid, token, user).catch(() => {});
      const snap = await loadAccess(user.uid, token, user.email).catch(() => EMPTY_ACCESS);
      if (cancelled) return;
      setSnapshot(snap);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authReady, getToken, nonce]);

  // Silent re-check on focus / tab-visible so a revoked grant (or a newly
  // granted one) takes effect without a full reload. Deliberately does NOT
  // toggle `ready` — only the snapshot updates, which flips can()/isAdmin if
  // access actually changed, with no gate flash for an unaffected user.
  useEffect(() => {
    if (!authReady || !user) return;
    let inFlight = false;
    const revalidate = async () => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const token = await getToken();
        if (!token) return;
        setSnapshot(await loadAccess(user.uid, token, user.email));
      } catch {
        // keep the last good snapshot on a transient failure
      } finally {
        inFlight = false;
      }
    };
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [authReady, user, getToken]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const can = useCallback(
    (appId: AppId): boolean => hasEntitlement(user, appId, snapshot),
    [user, snapshot]
  );

  const value = useMemo<AccessCtx>(
    () => ({
      ready,
      isAdmin: hasEntitlement(user, "admin", snapshot),
      role: snapshot.role,
      snapshot,
      can,
      refresh,
    }),
    [ready, user, snapshot, can, refresh]
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessCtx {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccess must be used inside AccessProvider");
  return ctx;
}
