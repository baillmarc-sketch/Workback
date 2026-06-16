"use client";

import { useAuth } from "@/state/auth";
import { hasEntitlement } from "@/lib/entitlements";
import { appInfo, setApp, type AppId } from "@/lib/toolkit";
import AccountButton from "./AccountButton";

/**
 * Gates a private app behind the owner's account. Workback is public and always
 * passes; the Estimator requires the authorized Google account. The future
 * paywall changes only entitlements.ts and this fallback — call sites don't.
 */
export default function AppGate({ appId, children }: { appId: AppId; children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const info = appInfo(appId);

  if (hasEntitlement(user, appId)) return <>{children}</>;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <h2 className="font-display text-[20px] font-semibold">{info.name} is private</h2>
      <p className="mt-2 max-w-sm text-[13px] text-ink-soft">
        {!ready
          ? "Checking your account…"
          : user
            ? "This app is restricted to the owner's account. You're signed in with a different account."
            : "Sign in with the authorized Google account to open this app."}
      </p>
      <div className="mt-5 flex items-center gap-2">
        <button
          className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink"
          onClick={() => setApp("workback")}
        >
          ← Workback
        </button>
        <AccountButton />
      </div>
    </div>
  );
}
