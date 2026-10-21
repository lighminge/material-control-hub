import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";

// Firebase web config (public identifiers, not secrets). Access is protected by
// Firestore security rules + Firebase Authentication + App Check.
export const firebaseConfig = {
  apiKey: "AIzaSyAP70NxjHZJ4jC8_8JZ5xEYMwYUDbZi31w",
  authDomain: "material-control-hub.firebaseapp.com",
  projectId: "material-control-hub",
  storageBucket: "material-control-hub.firebasestorage.app",
  messagingSenderId: "986617283687",
  appId: "1:986617283687:web:7be8f307a7ce013d4a00c2",
  measurementId: "G-FVMQEH16EM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase App Check with reCAPTCHA Enterprise.
// The reCAPTCHA Enterprise *site key* is public; it is injected at build time through
// VITE_RECAPTCHA_ENTERPRISE_SITE_KEY (see .env.example). If it is not set, App Check
// is skipped so the app keeps working while App Check is not yet enforced.
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY as string | undefined;
let appCheck: AppCheck | undefined;
if (recaptchaSiteKey) {
  // For local development, a debug token is used (register it in Firebase Console > App Check > Manage debug tokens).
  if (import.meta.env.DEV) {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
} else {
  console.warn("App Check is disabled: VITE_RECAPTCHA_ENTERPRISE_SITE_KEY is not set.");
}

const db = getFirestore(app);
const auth = getAuth(app);
// The sign-in state only lives for the current browser tab/session.
setPersistence(auth, browserSessionPersistence).catch(() => { /* ignore */ });

export { db, auth, appCheck };
