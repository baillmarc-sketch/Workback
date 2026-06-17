/**
 * The Producer's Toolkit registry and hash-based routing between apps. Routing
 * lives in the URL hash because the existing Workback access model already does
 * (`#p=`, `#wb=`), so the whole platform stays a single static-exported page
 * with one Firebase init. Workback is the default; access to the private apps
 * is decided by entitlements.ts (account-based).
 *
 * Adding a future app = one entry in APPS plus a branch in Toolkit.tsx.
 */

export type AppId = "workback" | "estimator" | "bid-specs" | "admin";

export type Entitlement = "free" | "pro";

export interface AppInfo {
  id: AppId;
  name: string;
  /** Short label for the menu bar tab. */
  tab: string;
  blurb: string;
  /** Gating tier read by entitlements.ts. */
  entitlement: Entitlement;
}

export const APPS: AppInfo[] = [
  {
    id: "workback",
    name: "Workback Maker",
    tab: "Workback",
    blurb: "Plan a project backwards from delivery — milestones, review rounds, and a shareable calendar.",
    entitlement: "free",
  },
  {
    id: "estimator",
    name: "Estimator",
    tab: "Estimator",
    blurb: "Build and compare production budgets across versions and vendor bids, level bids, and track actuals.",
    entitlement: "pro",
  },
  {
    id: "bid-specs",
    name: "Bid Specs",
    tab: "Bid Specs",
    blurb: "Write and share AICP-aligned bid specs — the job, deliverables, usage, and terms vendors bid against.",
    entitlement: "pro",
  },
];

export function appInfo(id: AppId): AppInfo {
  return APPS.find((a) => a.id === id) ?? APPS[0];
}

/**
 * Decide which app the current hash selects. Workback is the default; any legacy
 * Workback token wins, so existing shared/deep links never break.
 */
export function parseAppFromHash(hash: string): AppId {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (h.startsWith("p=") || h.startsWith("wb=")) return "workback";
  if (h.startsWith("e=")) return "estimator";
  if (h === "app=estimator") return "estimator";
  if (h.startsWith("bs=")) return "bid-specs";
  if (h === "app=bid-specs") return "bid-specs";
  if (h === "app=admin") return "admin";
  return "workback";
}

/** Navigate to an app by setting the hash. */
export function setApp(app: AppId): void {
  if (app === "workback") {
    // Clear the hash without leaving a "#" that re-triggers routing.
    history.replaceState(null, "", location.pathname + location.search);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  location.hash = `app=${app}`;
}
