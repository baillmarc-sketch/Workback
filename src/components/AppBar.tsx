"use client";

import { useAuth } from "@/state/auth";
import { hasEntitlement } from "@/lib/entitlements";
import { APPS, setApp, type AppId } from "@/lib/toolkit";

/**
 * Top menu bar for switching between toolkit apps. Only the apps the signed-in
 * account can access appear; if that's just Workback (i.e. not the owner), the
 * bar hides itself entirely so the private apps stay out of sight. Account
 * sign-in/out stays in each app's header.
 */
export default function AppBar({ active }: { active: AppId }) {
  const { user } = useAuth();
  const apps = APPS.filter((a) => hasEntitlement(user, a.id));

  // Nothing to toggle between → no menu bar (regular Workback visitors).
  if (apps.length < 2) return null;

  return (
    <nav className="no-print w-full border-b border-hairline bg-surface">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-4 py-2">
        <span className="font-display text-[13px] font-semibold tracking-tight">Producer&apos;s Toolkit</span>
        <span className="mx-1 h-4 w-px bg-hairline-strong" />
        <div className="flex items-center gap-1" role="tablist" aria-label="Apps">
          {apps.map((a) => (
            <button
              key={a.id}
              role="tab"
              aria-selected={active === a.id}
              className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                active === a.id ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
              onClick={() => setApp(a.id)}
            >
              {a.tab}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
