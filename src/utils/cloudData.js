import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
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
  const rootSnap = await getDoc(userDocRef(uid));
  if (rootSnap.exists()) {
    const rootData = rootSnap.data() || {};
    const text = String(rootData.dashboardInsightText || "").trim();
    if (text) {
      return {
        text,
        count: Number.isFinite(Number(rootData.dashboardInsightCount)) ? Number(rootData.dashboardInsightCount) : -1,
        signature: String(rootData.dashboardInsightSignature || "").trim(),
      };
    }
  }

  const legacySnap = await getDoc(userDashboardInsightRef(uid));
  if (!legacySnap.exists()) return null;
  const data = legacySnap.data() || {};
  const text = String(data.text || "").trim();
  if (!text) return null;
  return {
    text,
    count: Number.isFinite(Number(data.count)) ? Number(data.count) : -1,
    signature: String(data.signature || "").trim(),
  };
};

export const saveDashboardInsight = async (uid, payload) => {
  if (!uid) return;
  await setDoc(
    userDocRef(uid),
    {
      dashboardInsightText: String(payload?.text || "").trim(),
      dashboardInsightCount: Number.isFinite(Number(payload?.count)) ? Number(payload.count) : -1,
      dashboardInsightSignature: String(payload?.signature || "").trim(),
      dashboardInsightUpdatedAt: serverTimestamp(),
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
const quotaStorageKey = (uid) => `np6_ai_quota_${uid}`;
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

const readQuotaState = (uid) => {
  if (!uid) return null;
  try {
    const raw = window.localStorage.getItem(quotaStorageKey(uid));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeQuotaState = (uid, state) => {
  if (!uid) return;
  try {
    window.localStorage.setItem(quotaStorageKey(uid), JSON.stringify(state));
  } catch {
    // Ignore localStorage write failures.
  }
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
    const existing = readQuotaState(uid);
    const normalized = normalizeQuotaDoc(existing || {}, limit, dayKey);

    if (!existing || normalized.lastReset !== dayKey || Number(existing?.remaining) !== normalized.remaining) {
      writeQuotaState(uid, {
        used: normalized.used,
        remaining: normalized.remaining,
        limit,
        lastReset: dayKey,
      });
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
    const existing = readQuotaState(uid) || {};
    const normalized = normalizeQuotaDoc(existing, limit, dayKey);

    if (normalized.remaining <= 0) {
      writeQuotaState(uid, {
        used: normalized.used,
        remaining: 0,
        limit,
        lastReset: dayKey,
      });
      return { allowed: false, remaining: 0 };
    }

    const nextUsed = normalized.used + 1;
    const nextRemaining = Math.max(0, limit - nextUsed);
    writeQuotaState(uid, {
      used: nextUsed,
      remaining: nextRemaining,
      limit,
      lastReset: dayKey,
    });

    return { allowed: true, remaining: nextRemaining };
  } catch (err) {
    console.error("consumeUserQuestionQuota failed:", err);
    return { allowed: true, remaining: limit - 1, degraded: true };
  }
};
