import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

// TODO: Replace with your actual Firebase config
// You will need to create a project in Firebase Console and provide these values.
const firebaseConfig = {
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
if (recaptchaSiteKey) {
  // For local development, a debug token is used (register it in Firebase Console > App Check > Manage debug tokens).
  if (import.meta.env.DEV) {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
} else {
  console.warn("App Check is disabled: VITE_RECAPTCHA_ENTERPRISE_SITE_KEY is not set.");
}
const db = getFirestore(app);
const auth = getAuth(app);

// Function to sign in anonymously
export const loginAnonymously = async () => {
  try {
    const userCredential = await signInAnonymously(auth);
    console.log("Signed in anonymously:", userCredential.user.uid);
    return userCredential.user;
  } catch (error) {
    console.error("Error signing in anonymously:", error);
    throw error;
  }
};

export { db, auth };
