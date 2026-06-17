import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * The Workback Firebase project. These web config values are public by
 * design — security comes from the database rules (database.rules.json)
 * and Firebase Auth, not from hiding the config.
 */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBHVSs7P12MgDfzfTBUTQMQ_0xmOcrmHCM",
  authDomain: "workback-firebase.firebaseapp.com",
  databaseURL: "https://workback-firebase-default-rtdb.firebaseio.com",
  projectId: "workback-firebase",
  storageBucket: "workback-firebase.firebasestorage.app",
  messagingSenderId: "307569737527",
  appId: "1:307569737527:web:19de8f9b260641af6f64b2",
};

export const DB_URL = FIREBASE_CONFIG.databaseURL;

/**
 * Optional Firebase App Check (off by default — leave this empty to disable).
 * To enable: register the site for reCAPTCHA v3, add the Web app under Firebase
 * App Check, paste the reCAPTCHA site key here, then turn on enforcement for the
 * Realtime Database in the console. App Check binds DB access to your real app,
 * mitigating scripted abuse of the open `/shared` + `/sharedEstimates` and the
 * `/accessRequests` endpoints. See docs/ADMIN_RUNBOOK.md.
 */
const APP_CHECK_SITE_KEY = "";

let app: FirebaseApp | null = null;
let appCheckStarted = false;

/** Start App Check once, only when configured and in the browser. Dynamically
    imported so it adds zero bundle weight until a site key is set; failures are
    swallowed since App Check is a hardening layer, not a hard dependency. */
function maybeStartAppCheck(instance: FirebaseApp): void {
  if (appCheckStarted || !APP_CHECK_SITE_KEY || typeof window === "undefined") return;
  appCheckStarted = true;
  import("firebase/app-check")
    .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
      initializeAppCheck(instance, {
        provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    })
    .catch(() => {});
}

function getApp(): FirebaseApp {
  if (!app) {
    app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
    maybeStartAppCheck(app);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getApp());
}
