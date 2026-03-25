import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "./firebase.js";

const userDocRef = (uid) => doc(firestore, "users", uid);

export const loadUserCloudData = async (uid) => {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return null;

  const data = snap.data() || {};
  return {
    grades: Array.isArray(data.grades) ? data.grades : [],
    subjects: Array.isArray(data.subjects) ? data.subjects : [],
  };
};

export const saveUserCloudData = async (uid, payload) => {
  await setDoc(
    userDocRef(uid),
    {
      grades: Array.isArray(payload.grades) ? payload.grades : [],
      subjects: Array.isArray(payload.subjects) ? payload.subjects : [],
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const subscribeUserCloudData = (uid, onData, onError) => {
  return onSnapshot(
    userDocRef(uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }

      const data = snap.data() || {};
      onData({
        grades: Array.isArray(data.grades) ? data.grades : [],
        subjects: Array.isArray(data.subjects) ? data.subjects : [],
      });
    },
    onError
  );
};
