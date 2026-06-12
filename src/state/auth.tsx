"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

export interface AccountUser {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
}

interface AuthCtx {
  user: AccountUser | null;
  /** False until the first onAuthStateChanged fires (session restore) */
  ready: boolean;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  /** Fresh ID token for authenticated REST calls, or null when signed out */
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    // Completes a signInWithRedirect round-trip when the popup path fell back
    getRedirectResult(auth).catch(() => {});
    return onAuthStateChanged(auth, (u) => {
      setUser(
        u ? { uid: u.uid, email: u.email, name: u.displayName, photoURL: u.photoURL } : null
      );
      setReady(true);
    });
  }, []);

  const signIn = useCallback(async () => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      const code = (e as { code?: string }).code;
      // Popups can be blocked (in-app browsers, strict settings) — fall back
      // to the redirect flow. A user closing the popup is not an error.
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(auth, provider);
        return;
      }
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      throw e;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(getFirebaseAuth());
  }, []);

  const getToken = useCallback(async () => {
    const u = getFirebaseAuth().currentUser;
    return u ? u.getIdToken() : null;
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ user, ready, signIn, signOutUser, getToken }),
    [user, ready, signIn, signOutUser, getToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
