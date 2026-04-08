import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "./firebase.js";

export const DAILY_AI_PILOT_QUESTIONS = 3;

const userDocRef = (uid) => doc(firestore, "users", uid);
const userDashboardInsightRef = (uid) => doc(firestore, "users", uid, "insights", "dashboard");

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

export const loadDashboardInsight = async (uid) => {
  if (!uid) return null;
  const snap = await getDoc(userDashboardInsightRef(uid));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  const text = String(data.text || "").trim();
  if (!text) return null;
  return { text };
};

export const saveDashboardInsight = async (uid, payload) => {
  if (!uid) return;
  await setDoc(
    userDashboardInsightRef(uid),
    {
      text: String(payload?.text || "").trim(),
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
const buildDayKey = () => {
  // Daily AI quota resets at 00:00 in European local time (Europe/Berlin).
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const normalizeQuotaDoc = (data, limit, dayKey) => {
  const lastReset = String(data?.lastReset || "");
  const usedRaw = Number(data?.used || 0);
  const used = Number.isFinite(usedRaw) ? Math.max(0, usedRaw) : 0;

  if (lastReset !== dayKey) {
    return {
      dayKey,
      used: 0,
      remaining: limit,
      lastReset: dayKey,
    };
  }

  const boundedUsed = Math.min(limit, used);
  return {
    dayKey,
    used: boundedUsed,
    remaining: Math.max(0, limit - boundedUsed),
    lastReset,
  };
};

export const getUserQuestionQuota = async (uid, limit = 3) => {
  if (!uid) return { allowed: false, remaining: 0, used: 0, reset: null };
  try {
    const dayKey = buildDayKey();
    const quotaRef = userQuotaDocRef(uid);
    const snap = await getDoc(quotaRef);

    if (!snap.exists()) {
      await setDoc(quotaRef, {
        used: 0,
        remaining: limit,
        limit,
        lastReset: dayKey,
        updatedAt: serverTimestamp(),
      });
      return { allowed: true, remaining: limit, used: 0, reset: dayKey };
    }

    const normalized = normalizeQuotaDoc(snap.data(), limit, dayKey);

    if (normalized.lastReset !== dayKey || Number(snap.data()?.remaining) !== normalized.remaining) {
      await setDoc(
        quotaRef,
        {
          used: normalized.used,
          remaining: normalized.remaining,
          limit,
          lastReset: dayKey,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return {
      allowed: normalized.remaining > 0,
      remaining: normalized.remaining,
      used: normalized.used,
      reset: dayKey,
    };
  } catch (err) {
    console.error("getUserQuestionQuota failed:", err);
    return { allowed: true, remaining: limit, used: 0, reset: null, degraded: true };
  }
};

export const consumeUserQuestionQuota = async (uid, limit = 3) => {
  if (!uid) return { allowed: false, remaining: 0 };
  try {
    const dayKey = buildDayKey();
    const result = await runTransaction(firestore, async (transaction) => {
      const quotaRef = userQuotaDocRef(uid);
      const snap = await transaction.get(quotaRef);

      const normalized = normalizeQuotaDoc(snap.exists() ? snap.data() : {}, limit, dayKey);
      if (normalized.remaining <= 0) {
        transaction.set(
          quotaRef,
          {
            used: normalized.used,
            remaining: 0,
            limit,
            lastReset: dayKey,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        return { allowed: false, remaining: 0 };
      }

      const nextUsed = normalized.used + 1;
      const nextRemaining = Math.max(0, limit - nextUsed);

      transaction.set(
        quotaRef,
        {
          used: nextUsed,
          remaining: nextRemaining,
          limit,
          lastReset: dayKey,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      return { allowed: true, remaining: nextRemaining };
    });

    return result;
  } catch (err) {
    console.error("consumeUserQuestionQuota failed:", err);
    // Fail-open: assume quota available on transient errors to avoid permanently blocking user
    return { allowed: true, remaining: limit - 1, degraded: true };
  }
};
