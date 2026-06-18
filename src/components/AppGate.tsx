"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/state/auth";
import { useAccess } from "@/state/access";
import { appInfo, setApp, type AppId } from "@/lib/toolkit";
import { myAccessRequest, requestAccess } from "@/lib/admin/requests";
import AccountButton from "./AccountButton";
import FeedbackButton from "./feedback/FeedbackButton";

/**
 * Gates a private app behind a granted account. Workback is public and always
 * passes; the Estimator requires an account that has been granted access (owner,
 * admin, explicit grant, or invite — resolved in entitlements.ts). Access is
 * data-driven via useAccess, so we wait for its snapshot before declaring an app
 * private, to avoid a flash of "private" for an entitled non-owner.
 *
 * A signed-in user without access can request it from here: the request lands in
 * the Admin page's queue, where the owner approves (grants access) or dismisses.
 */
export default function AppGate({ appId, children }: { appId: AppId; children: React.ReactNode }) {
  const { user, ready: authReady, getToken } = useAuth();
  const { can, ready: accessReady } = useAccess();
  const info = appInfo(appId);
  const ready = authReady && accessReady;
  const allowed = can(appId);

  // none → not yet requested · pending → a request already exists · sending →
  // submit in flight. Loaded from the DB so a reload doesn't re-offer the button.
  const [reqState, setReqState] = useState<"loading" | "none" | "pending" | "sending">("loading");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (allowed || !ready || !user) {
      setReqState("none");
      return;
    }
    (async () => {
      const token = await getToken();
      if (cancelled) return;
      if (!token) return setReqState("none");
      const existing = await myAccessRequest(user.uid, token);
      if (!cancelled) setReqState(existing ? "pending" : "none");
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, ready, user, getToken]);

  const submit = useCallback(async () => {
    if (!user) return;
    setReqState("sending");
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await requestAccess(user.uid, token, user, message);
      setReqState("pending");
    } catch (e) {
      setError((e as Error).message || "Could not send your request — try again.");
      setReqState("none");
    }
  }, [user, getToken, message]);

  if (allowed) return <>{children}</>;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <h2 className="font-display text-[20px] font-semibold">{info.name} is private</h2>
      <p className="mt-2 max-w-sm text-[13px] text-ink-soft">
        {!ready
          ? "Checking your account…"
          : user
            ? reqState === "pending"
              ? "Your request is in — the owner will review it. You'll get access here once it's approved."
              : "This app is private. Request access below and the owner can grant it to your account."
            : "Sign in to open this app, then request access. Access is granted per account."}
      </p>

      {ready && user && (appId === "estimator" || appId === "bid-specs") && reqState !== "pending" && (
        <div className="mt-5 flex w-full max-w-sm flex-col items-stretch gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional: a note for the owner (who you are, what for)"
            rows={2}
            className="resize-none rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12.5px] outline-none placeholder:text-ink-faint"
          />
          <button
            className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85 disabled:opacity-50"
            disabled={reqState === "sending" || reqState === "loading"}
            onClick={submit}
          >
            {reqState === "sending" ? "Sending…" : "Request access"}
          </button>
          {error && <span className="text-[11.5px] text-danger">{error}</span>}
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        <button
          className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink"
          onClick={() => setApp("workback")}
        >
          ← Workback
        </button>
        <FeedbackButton variant="inline" />
        <AccountButton />
      </div>
    </div>
  );
}
