import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "../config/firebase.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);

// Initialize Google Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("profile");
googleProvider.addScope("email");

const formatUser = (user, extra = {}) => ({
  email: user.email,
  name: user.displayName || user.email?.split("@")[0] || "Nutzer",
  uid: user.uid,
  photoUrl: user.photoURL || null,
  isNew: false,
  ...extra,
});

const mapAuthError = (error) => {
  switch (error.code) {
    case "auth/invalid-email":
      return "Ungültige E-Mail-Adresse.";
    case "auth/user-disabled":
      return "Dieses Konto wurde deaktiviert.";
    case "auth/user-not-found":
    case "auth/invalid-credential":
      return "E-Mail oder Passwort ist falsch.";
    case "auth/wrong-password":
      return "E-Mail oder Passwort ist falsch.";
    case "auth/email-already-in-use":
      return "Diese E-Mail wird bereits verwendet.";
    case "auth/weak-password":
      return "Passwort ist zu schwach (mind. 6 Zeichen).";
    case "auth/too-many-requests":
      return "Zu viele Versuche. Bitte warte kurz und versuche es erneut.";
    case "auth/network-request-failed":
      return "Netzwerkfehler. Überpruefe deine Internetverbindung.";
    default:
      return error.message || "Authentifizierung fehlgeschlagen.";
  }
};

// Google Sign-In
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    return formatUser(user, { google: true, isNew: false });
  } catch (error) {
    // Handle specific error cases
    if (error.code === "auth/popup-blocked") {
      throw new Error("Pop-up wurde blockiert. Bitte erlaube Pop-ups für diese Website.");
    } else if (error.code === "auth/popup-closed-by-user") {
      throw new Error("Anmeldung abgebrochen.");
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Netzwerkfehler. Überprüfe deine Internetverbindung.");
    }
    
    console.error("Google Sign-In Error:", error);
    throw new Error(`Google Sign-In failed: ${error.message}`);
  }
};

export const signInWithEmailPassword = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return formatUser(result.user, { google: false, isNew: false });
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
};

export const registerWithEmailPassword = async (email, password, displayName) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName && displayName.trim()) {
      await updateProfile(result.user, { displayName: displayName.trim() });
    }

    return formatUser(result.user, { google: false, isNew: true, name: displayName?.trim() || undefined });
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign out error:", error);
    throw error;
  }
};

// Get current user
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Listen to auth state changes
export const onAuthStateChanged = (callback) => {
  return auth.onAuthStateChanged(callback);
};

// Initialize Google Auth (placeholder for future native implementation)
export const initializeGoogleAuth = async () => {
  // For web, initialization happens automatically
  // For native (Android/iOS), this would be called to set up native auth
  try {
    // Currently using web-based Google Auth
    // Native implementation would go here
  } catch (error) {
    console.error("Error initializing Google Auth:", error);
  }
};
