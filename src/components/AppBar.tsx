"use client";

import { useAccess } from "@/state/access";
import { APPS, setApp, type AppId } from "@/lib/toolkit";

/**
 * Top menu bar for switching between toolkit apps. Only the apps the signed-in
 * account can access appear; if that's just Workback (and not an admin), the bar
 * hides itself entirely so the private apps stay out of sight. Admins also get
 * an Admin tab. Account sign-in/out stays in each app's header.
 */
export default function AppBar({ active }: { active: AppId }) {
  const { can, isAdmin } = useAccess();
  const apps = APPS.filter((a) => can(a.id));

  const tabClass = (selected: boolean) =>
    `rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
      selected ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
    }`;

  // Nothing to toggle between and not an admin → no menu bar (regular visitors).
  if (apps.length < 2 && !isAdmin) return null;

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
              className={tabClass(active === a.id)}
              onClick={() => setApp(a.id)}
            >
              {a.tab}
            </button>
          ))}
          {isAdmin && (
            <>
              <span className="mx-1 h-4 w-px bg-hairline-strong" />
              <button
                role="tab"
                aria-selected={active === "admin"}
                className={tabClass(active === "admin")}
                onClick={() => setApp("admin")}
              >
                Admin
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
