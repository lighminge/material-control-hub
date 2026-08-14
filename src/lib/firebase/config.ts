import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

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
