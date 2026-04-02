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

// Quota management for AI questions
const userQuotaDocRef = (uid) => doc(firestore, "users", uid, "quota", "daily");

export const getUserQuestionQuota = async (uid) => {
  if (!uid) return { allowed: false, remaining: 0, used: 0, reset: null };
  try {
    const snap = await getDoc(userQuotaDocRef(uid));
    if (!snap.exists()) return { allowed: true, remaining: 3, used: 0, reset: null };
    
    const data = snap.data();
    const today = new Date().toISOString().split("T")[0];
    const lastReset = data?.lastReset || "";
    
    if (lastReset !== today) {
      // New day, reset quota
      await setDoc(userQuotaDocRef(uid), {
        used: 0,
        remaining: 3,
        lastReset: today,
        updatedAt: serverTimestamp(),
      });
      return { allowed: true, remaining: 3, used: 0, reset: today };
    }
    
    const used = Number(data?.used || 0);
    const remaining = Math.max(0, 3 - used);
    return { allowed: remaining > 0, remaining, used, reset: today };
  } catch (err) {
    console.error("getUserQuestionQuota failed:", err);
    return { allowed: false, remaining: 0, used: 0, reset: null };
  }
};

export const consumeUserQuestionQuota = async (uid, limit = 3) => {
  if (!uid) return { allowed: false, remaining: 0 };
  try {
    const quota = await getUserQuestionQuota(uid);
    if (!quota.allowed) return { allowed: false, remaining: 0 };
    
    const newUsed = (quota.used || 0) + 1;
    const newRemaining = Math.max(0, limit - newUsed);
    
    await setDoc(
      userQuotaDocRef(uid),
      {
        used: newUsed,
        remaining: newRemaining,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    
    return { allowed: true, remaining: newRemaining };
  } catch (err) {
    console.error("consumeUserQuestionQuota failed:", err);
    return { allowed: false, remaining: 0 };
  }
};
