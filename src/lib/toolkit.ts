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
 * Decide which app the current hash selects. Workback is the default landing
 * (empty/unknown hash). The launcher ("home") lives behind `#app=home` and is
 * password-gated (see the lock helpers below). Any legacy Workback token wins,
 * so existing shared/deep links never break.
 */
export function parseAppFromHash(hash: string): ActiveApp {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (h.startsWith("p=") || h.startsWith("wb=")) return "workback";
  if (h.startsWith("e=")) return "estimator";
  if (h === "app=home") return "home";
  if (h === "app=estimator") return "estimator";
  if (h === "app=workback") return "workback";
  return "workback";
}

/** Navigate to an app (or the launcher) by setting the hash. */
export function setApp(app: ActiveApp): void {
  if (app === "workback") {
    // Clear the hash without leaving a "#" that re-triggers routing.
    history.replaceState(null, "", location.pathname + location.search);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  location.hash = `app=${app}`;
}

// --- Toolkit lock ---
// The launcher is hidden behind a "Locked: Toolkit" button + password. This is
// intentional obscurity (not real security — shared estimate links carry their
// own unguessable IDs); it just keeps the toolkit out of sight for casual
// viewers of the Workback calendar.

const UNLOCK_KEY = "toolkit:unlocked";
const TOOLKIT_PASSWORD = "stolen";

export function isToolkitUnlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

/** Returns true and persists the unlock when the password matches. */
export function tryUnlockToolkit(password: string): boolean {
  if (password.trim().toLowerCase() !== TOOLKIT_PASSWORD) return false;
  try {
    localStorage.setItem(UNLOCK_KEY, "1");
  } catch {}
  return true;
}

export function lockToolkit(): void {
  try {
    localStorage.removeItem(UNLOCK_KEY);
  } catch {}
}
