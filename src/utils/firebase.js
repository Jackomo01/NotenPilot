import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { firebaseConfig } from "../config/firebase.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Google Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("profile");
googleProvider.addScope("email");

// Google Sign-In
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    return {
      email: user.email,
      name: user.displayName || user.email.split("@")[0],
      uid: user.uid,
      photoUrl: user.photoURL,
      isNew: false,
      google: true,
    };
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
