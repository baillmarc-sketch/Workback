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

let app: FirebaseApp | null = null;

export function getFirebaseAuth(): Auth {
  if (!app) {
    app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
  }
  return getAuth(app);
}
