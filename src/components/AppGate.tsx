"use client";

import { useAuth } from "@/state/auth";
import { hasEntitlement } from "@/lib/entitlements";
import { appInfo, setApp, type AppId } from "@/lib/toolkit";

/**
 * Wraps each app so access can be gated centrally. Today every app is free, so
 * this renders its children unchanged — the only branch that can fail is the
 * entitlement check, which the future paywall flips on. Keeping the gate in the
 * tree now means adding billing later touches only this file + hasEntitlement.
 */
export default function AppGate({ appId, children }: { appId: AppId; children: React.ReactNode }) {
  const { user } = useAuth();
  const info = appInfo(appId);

  if (!hasEntitlement(user, appId)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="font-display text-[20px] font-semibold">{info.name} is a Pro app</h2>
        <p className="mt-2 max-w-sm text-[13px] text-ink-soft">
          This tool is part of the Pro toolkit. Upgrade your account to unlock it.
        </p>
        <button
          className="mt-5 rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink"
          onClick={() => setApp("home")}
        >
          ← Back to toolkit
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
