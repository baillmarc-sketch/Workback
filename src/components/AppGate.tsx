"use client";

import { useAuth } from "@/state/auth";
import { useAccess } from "@/state/access";
import { appInfo, setApp, type AppId } from "@/lib/toolkit";
import AccountButton from "./AccountButton";

/**
 * Gates a private app behind a granted account. Workback is public and always
 * passes; the Estimator requires an account that has been granted access (owner,
 * admin, explicit grant, or invite — resolved in entitlements.ts). Access is
 * data-driven via useAccess, so we wait for its snapshot before declaring an app
 * private, to avoid a flash of "private" for an entitled non-owner.
 */
export default function AppGate({ appId, children }: { appId: AppId; children: React.ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const { can, ready: accessReady } = useAccess();
  const info = appInfo(appId);
  const ready = authReady && accessReady;

  if (can(appId)) return <>{children}</>;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <h2 className="font-display text-[20px] font-semibold">{info.name} is private</h2>
      <p className="mt-2 max-w-sm text-[13px] text-ink-soft">
        {!ready
          ? "Checking your account…"
          : user
            ? "This app is private. Your account hasn't been granted access — ask the owner to enable it for you."
            : "Sign in to open this app. Access is granted per account."}
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
