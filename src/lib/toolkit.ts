/**
 * The Producer's Toolkit shell: a small registry of apps and the hash-based
 * routing that selects the active one. Routing lives in the URL hash because
 * the existing Workback access model already does (`#p=`, `#wb=`), so the whole
 * platform stays a single static-exported page with one Firebase init.
 *
 * Adding a future app = one entry in APPS plus a branch in Toolkit.tsx.
 */

export type AppId = "workback" | "estimator";

/** "home" means the launcher; otherwise an app is active. */
export type ActiveApp = AppId | "home";

export type Entitlement = "free" | "pro";

export interface AppInfo {
  id: AppId;
  name: string;
  blurb: string;
  /** Gating tier — today everything is "free"; the paywall reads this later. */
  entitlement: Entitlement;
  /** Whether the app requires a signed-in account (unused for now). */
  requiresAuth?: boolean;
}

export const APPS: AppInfo[] = [
  {
    id: "workback",
    name: "Workback Maker",
    blurb: "Plan a project backwards from delivery — milestones, review rounds, and a shareable calendar.",
    entitlement: "free",
  },
  {
    id: "estimator",
    name: "Estimator",
    blurb: "Build and compare production budgets across versions and vendor bids, with a triple-bid view.",
    entitlement: "free",
  },
];

export function appInfo(id: AppId): AppInfo {
  return APPS.find((a) => a.id === id) ?? APPS[0];
}

/**
 * Decide which app the current hash selects. Any legacy Workback token wins
 * regardless of `#app=`, so existing shared/deep links never break.
 */
export function parseAppFromHash(hash: string): ActiveApp {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (h.startsWith("p=") || h.startsWith("wb=")) return "workback";
  if (h.startsWith("e=")) return "estimator";
  if (h === "app=workback") return "workback";
  if (h === "app=estimator") return "estimator";
  return "home";
}

/** Navigate to an app (or the launcher) by setting the hash. */
export function setApp(app: ActiveApp): void {
  if (app === "home") {
    // Clear the hash without leaving a "#" that re-triggers routing.
    history.replaceState(null, "", location.pathname + location.search);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  location.hash = `app=${app}`;
}
