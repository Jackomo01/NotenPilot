import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Polyline,
  Rect,
  Stop,
  Text as SvgText,
  Line as SvgLine,
} from "react-native-svg";
import { StatusBar } from "expo-status-bar";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";

WebBrowser.maybeCompleteAuthSession();

const C = {
  bg0: "#040407",
  bg1: "#07070c",
  bg2: "#0b0b12",
  bg3: "#0f0f18",
  bg4: "#13131e",
  bg5: "#181826",
  line: "#1c1c2e",
  lineH: "#262640",
  acc: "#5b6ef0",
  accH: "#7585f4",
  accGlow: "rgba(91,110,240,0.16)",
  t0: "#ededf8",
  t1: "#b0b0cf",
  t2: "#727294",
  t3: "#1e1e30",
  g1: "#26d49a",
  g2: "#4ed468",
  g3: "#f0c83a",
  g4: "#e87830",
  g5: "#d84040",
  ok: "#26d49a",
  err: "#d84040",
  wrn: "#f0c83a",
};

const R = { s: 8, m: 12, l: 16, xl: 20, f: 9999 };

const ARTEN = ["Schulaufgabe", "Ausfrage", "Kurztest", "Stegreifaufgabe", "Kurzarbeit", "Hausaufgabe", "Mitarbeit", "Jahrgangsstufentest", "Sonstige"];
const SEED_GRADES = [
  { id: "g1", subject: "Mathematik", grade: 2.0, weight: 2, date: "2025-01-15", type: "Schulaufgabe" },
  { id: "g2", subject: "Mathematik", grade: 1.5, weight: 1, date: "2025-01-28", type: "Ausfrage" },
  { id: "g3", subject: "Deutsch", grade: 3.0, weight: 2, date: "2025-01-20", type: "Schulaufgabe" },
  { id: "g4", subject: "Englisch", grade: 2.0, weight: 1, date: "2025-02-03", type: "Kurztest" },
  { id: "g5", subject: "Physik", grade: 1.0, weight: 2, date: "2025-02-10", type: "Schulaufgabe" },
  { id: "g6", subject: "Geschichte", grade: 3.5, weight: 1, date: "2025-02-14", type: "Ausfrage" },
  { id: "g7", subject: "Mathematik", grade: 1.0, weight: 2, date: "2025-02-20", type: "Kurzarbeit" },
  { id: "g8", subject: "Deutsch", grade: 2.5, weight: 1, date: "2025-03-01", type: "Ausfrage" },
];
const SEED_SUBJECTS = ["Mathematik", "Deutsch", "Englisch", "Physik", "Geschichte"];
const DAILY_AI_PILOT_QUESTIONS = 3;

const uid = () => Math.random().toString(36).slice(2, 9);
const toStr = () => new Date().toISOString().slice(0, 10);
const fDE = (d) => {
  try {
    return new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return d;
  }
};
const wAvg = (gs) => {
  if (!gs?.length) return null;
  const tw = gs.reduce((s, g) => s + (g.weight ?? 1), 0);
  const ts = gs.reduce((s, g) => s + Number(g.grade) * (g.weight ?? 1), 0);
  return tw ? +(ts / tw).toFixed(2) : null;
};
const gc = (g) => {
  if (g == null) return C.t2;
  if (g <= 1.3) return C.g1;
  if (g <= 2.3) return C.g2;
  if (g <= 3.3) return C.g3;
  if (g <= 4.3) return C.g4;
  return C.g5;
};
const gl = (g) => {
  if (g == null) return "";
  if (g <= 1.5) return "Sehr gut";
  if (g <= 2.5) return "Gut";
  if (g <= 3.5) return "Befriedigend";
  if (g <= 4.5) return "Ausreichend";
  return "Mangelhaft";
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getMsUntilNextBerlinMidnight = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const currentBerlinTime = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), Number(map.hour), Number(map.minute), Number(map.second));
  const nextBerlinMidnight = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day) + 1, 0, 0, 0);
  return Math.max(60_000, nextBerlinMidnight - currentBerlinTime + 1_000);
};

const normalizeDate = (raw) => {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

const buildAIContext = (grades = [], subjects = []) => {
  const sorted = [...grades].sort((a, b) => new Date(a.date) - new Date(b.date));
  const average = wAvg(grades);
  const subjectStats = subjects
    .map((subject) => {
      const sg = grades.filter((g) => g.subject === subject);
      return { subject, avg: wAvg(sg), count: sg.length };
    })
    .filter((item) => item.avg != null)
    .sort((a, b) => a.avg - b.avg);
  const recent = [...grades].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  let slope = 0;
  if (sorted.length >= 3) {
    const n = sorted.length;
    const xs = sorted.map((_, i) => i);
    const ys = sorted.map((g) => g.grade);
    const xMean = xs.reduce((s, x) => s + x, 0) / n;
    const yMean = ys.reduce((s, y) => s + y, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
    const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
    slope = den === 0 ? 0 : num / den;
  }
  return {
    grades,
    subjects,
    average,
    subjectStats,
    bestSubject: subjectStats[0] || null,
    worstSubject: subjectStats.length > 1 ? subjectStats[subjectStats.length - 1] : subjectStats[0] || null,
    recent,
    trendSlope: slope,
  };
};

const getSuggestions = (ctx) => {
  const sampleSubject = ctx?.worstSubject?.subject || ctx?.bestSubject?.subject || ctx?.subjects?.[0] || "einem Fach";
  return [
    "Welche Note habe ich zuletzt in Mathe geschrieben?",
    "Welche Fächer laufen bei mir am besten?",
    `Was passiert mit meinem ${sampleSubject}-Schnitt, wenn ich die nächste Arbeit mit 1 schreibe?`,
  ];
};

const buildDashboardInsight = (ctx) => {
  if (!ctx?.grades?.length) return "Noch keine Noten vorhanden. Trag die ersten Einträge ein, dann zeigt dir das Dashboard sofort Trends.";
  const avg = ctx.average != null ? `${ctx.average.toFixed(2)}` : "–";
  const best = ctx.bestSubject ? `${ctx.bestSubject.subject} (${ctx.bestSubject.avg.toFixed(2)})` : "kein Fach";
  const worst = ctx.worstSubject ? `${ctx.worstSubject.subject} (${ctx.worstSubject.avg.toFixed(2)})` : "kein Fach";
  const trend = ctx.trendSlope < -0.08 ? "verbessert sich" : ctx.trendSlope > 0.08 ? "verschlechtert sich" : "relativ stabil bleibt";
  return `Dein Schnitt liegt bei ${avg}. Stark ist aktuell ${best}; am meisten Luft nach oben hat ${worst}. Der Verlauf ${trend}.`;
};

const AI_ENDPOINT = (process.env.EXPO_PUBLIC_AI_ENDPOINT || process.env.EXPO_PUBLIC_APPWRITE_AI_ENDPOINT || "").trim();
const AI_API_KEY = (process.env.EXPO_PUBLIC_AI_API_KEY || process.env.EXPO_PUBLIC_APPWRITE_AI_API_KEY || "").trim();
const AI_PROVIDER = (process.env.EXPO_PUBLIC_AI_PROVIDER || "").trim().toLowerCase() || (AI_ENDPOINT ? "backend" : "none");
const AI_TIMEOUT_MS = Math.max(15000, Number(process.env.EXPO_PUBLIC_AI_TIMEOUT_MS || "60000"));

const backendUnavailableText = (err) => {
  const detail = String(err?.message || "").replace(/^Backend AI HTTP \d+:\s*/i, "").trim();
  return detail ? `Backend AI nicht verfügbar: ${detail}` : "Backend AI nicht verfügbar. Bitte Endpoint prüfen.";
};

const buildBackendPayload = (prompt, ctx, history = [], mode = "chat") => ({
  mode,
  prompt,
  context: {
    average: ctx.average,
    bestSubject: ctx.bestSubject,
    worstSubject: ctx.worstSubject,
    subjectStats: ctx.subjectStats,
    recent: ctx.recent,
    grades: ctx.grades,
    subjects: ctx.subjects,
    firestoreSnapshot: {
      grades: ctx.grades,
      subjects: ctx.subjects,
      fetchedAt: new Date().toISOString(),
    },
  },
  history: history.slice(-8).filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, text: m.text || "" })),
});

const requestBackendAI = async (payload) => {
  if (!AI_ENDPOINT) return null;
  const headers = { "Content-Type": "application/json" };
  if (AI_API_KEY) headers["x-api-key"] = AI_API_KEY;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(AI_ENDPOINT, { method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Backend AI HTTP ${res.status}: ${txt.slice(0, 400)}`);
    }
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      const answer = String(data?.answer || data?.text || data?.response || "").trim();
      if (!answer) throw new Error("Backend AI lieferte leere Antwort.");
      return { answer, provider: String(data?.provider || "backend"), model: String(data?.model || "unknown") };
    }
    const txt = String(await res.text()).trim();
    if (!txt) throw new Error("Backend AI lieferte leere Textantwort.");
    return { answer: txt, provider: "backend", model: "unknown" };
  } finally {
    clearTimeout(timeoutId);
  }
};

async function* streamChatAnswer(prompt, ctx, history = []) {
  const resolvedPrompt = String(prompt || "").trim();
  const streamWords = async function* (text, delay) {
    const words = String(text || "").split(" ");
    let acc = "";
    for (const word of words) {
      acc = acc ? `${acc} ${word}` : word;
      yield acc;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  };

  try {
    const backend = await requestBackendAI(buildBackendPayload(resolvedPrompt, ctx, history, "chat"));
    if (backend?.answer) {
      for await (const chunk of streamWords(backend.answer, 10)) yield chunk;
      return;
    }
    for await (const chunk of streamWords("AI-Backend nicht konfiguriert. Bitte Endpoint prüfen.", 10)) yield chunk;
  } catch (err) {
    console.error("streamChatAnswer failed:", err);
    for await (const chunk of streamWords(backendUnavailableText(err), 10)) yield chunk;
  }
}

const dashboardInsightDetailed = async (ctx) => {
  try {
    const backend = await requestBackendAI(buildBackendPayload("[TASK:dashboard_insight] Erstelle einen prägnanten Dashboard-Insight.", ctx, [], "chat"));
    if (backend?.answer) return backend;
    return { answer: buildDashboardInsight(ctx), provider: "local", model: "rule-based" };
  } catch (err) {
    console.error("dashboardInsightDetailed failed:", err);
    return { answer: backendUnavailableText(err), provider: "error", model: "error" };
  }
};

const normalizeQuotaDoc = (data, limit, dayKey) => {
  const lastReset = String(data?.lastReset || "");
  const usedRaw = Number(data?.used || 0);
  const used = Number.isFinite(usedRaw) ? Math.max(0, usedRaw) : 0;
  if (lastReset !== dayKey) return { dayKey, used: 0, remaining: limit, lastReset: dayKey };
  const boundedUsed = Math.min(limit, used);
  return { dayKey, used: boundedUsed, remaining: Math.max(0, limit - boundedUsed), lastReset };
};

const buildDayKey = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const useStoredState = (key, initialValue) => {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!mounted || raw == null) return;
        try {
          setValue(JSON.parse(raw));
        } catch {
          setValue(initialValue);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [initialValue, key]);
  const update = useCallback((next) => {
    setValue((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      AsyncStorage.setItem(key, JSON.stringify(resolved)).catch(() => {});
      return resolved;
    });
  }, [key]);
  return [value, update];
};

const useToastState = () => {
  const [items, setItems] = useState([]);
  const push = useCallback((message, kind = "ok") => {
    const id = uid();
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== id)), 2800);
  }, []);
  return [items, push, setItems];
};

const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

const ToastContext = createContext(null);
const useToast = () => useContext(ToastContext);

const hasFirebaseConfig = Boolean(process.env.EXPO_PUBLIC_FIREBASE_API_KEY && process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
};

let firebaseApp = null;
let auth = null;
let firestore = null;

if (hasFirebaseConfig) {
  firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  firestore = getFirestore(firebaseApp);
  auth = getAuth(firebaseApp);
}

const userDocRef = (uidValue) => doc(firestore, "users", uidValue);
const userDashboardInsightRef = (uidValue) => doc(firestore, "users", uidValue, "insights", "dashboard");
const userQuotaDocRef = (uidValue) => doc(firestore, "users", uidValue, "quota", "daily");

const loadUserCloudData = async (uidValue) => {
  if (!firestore) return null;
  const snap = await getDoc(userDocRef(uidValue));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    grades: Array.isArray(data.grades) ? data.grades : [],
    subjects: Array.isArray(data.subjects) ? data.subjects : [],
  };
};

const saveUserCloudData = async (uidValue, payload) => {
  if (!firestore) return;
  await setDoc(
    userDocRef(uidValue),
    {
      grades: Array.isArray(payload.grades) ? payload.grades : [],
      subjects: Array.isArray(payload.subjects) ? payload.subjects : [],
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

const loadDashboardInsight = async (uidValue) => {
  if (!firestore || !uidValue) return null;
  const snap = await getDoc(userDashboardInsightRef(uidValue));
  if (!snap.exists()) return null;
  const text = String(snap.data()?.text || "").trim();
  return text ? { text } : null;
};

const saveDashboardInsight = async (uidValue, payload) => {
  if (!firestore || !uidValue) return;
  await setDoc(userDashboardInsightRef(uidValue), { text: String(payload?.text || "").trim() }, { merge: true });
};

const subscribeUserCloudData = (uidValue, onData, onError) => {
  if (!firestore) return () => {};
  return onSnapshot(
    userDocRef(uidValue),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const data = snap.data() || {};
      onData({ grades: Array.isArray(data.grades) ? data.grades : [], subjects: Array.isArray(data.subjects) ? data.subjects : [] });
    },
    onError
  );
};

const getUserQuestionQuota = async (uidValue, limit = 3) => {
  if (!firestore || !uidValue) return { allowed: false, remaining: 0, used: 0, reset: null };
  try {
    const dayKey = buildDayKey();
    const quotaRef = userQuotaDocRef(uidValue);
    const snap = await getDoc(quotaRef);
    if (!snap.exists()) {
      await setDoc(quotaRef, { used: 0, remaining: limit, limit, lastReset: dayKey, updatedAt: serverTimestamp() });
      return { allowed: true, remaining: limit, used: 0, reset: dayKey };
    }
    const normalized = normalizeQuotaDoc(snap.data(), limit, dayKey);
    if (normalized.lastReset !== dayKey || Number(snap.data()?.remaining) !== normalized.remaining) {
      await setDoc(
        quotaRef,
        { used: normalized.used, remaining: normalized.remaining, limit, lastReset: dayKey, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
    return { allowed: normalized.remaining > 0, remaining: normalized.remaining, used: normalized.used, reset: dayKey };
  } catch (err) {
    console.error("getUserQuestionQuota failed:", err);
    return { allowed: true, remaining: limit, used: 0, reset: null, degraded: true };
  }
};

const consumeUserQuestionQuota = async (uidValue, limit = 3) => {
  if (!firestore || !uidValue) return { allowed: false, remaining: 0 };
  try {
    const dayKey = buildDayKey();
    return await runTransaction(firestore, async (transaction) => {
      const quotaRef = userQuotaDocRef(uidValue);
      const snap = await transaction.get(quotaRef);
      const normalized = normalizeQuotaDoc(snap.exists() ? snap.data() : {}, limit, dayKey);
      if (normalized.remaining <= 0) {
        transaction.set(quotaRef, { used: normalized.used, remaining: 0, limit, lastReset: dayKey, updatedAt: serverTimestamp() }, { merge: true });
        return { allowed: false, remaining: 0 };
      }
      const nextUsed = normalized.used + 1;
      const nextRemaining = Math.max(0, limit - nextUsed);
      transaction.set(quotaRef, { used: nextUsed, remaining: nextRemaining, limit, lastReset: dayKey, updatedAt: serverTimestamp() }, { merge: true });
      return { allowed: true, remaining: nextRemaining };
    });
  } catch (err) {
    console.error("consumeUserQuestionQuota failed:", err);
    return { allowed: true, remaining: limit - 1, degraded: true };
  }
};

const AppCard = ({ children, style }) => <View style={[styles.card, style]}>{children}</View>;

const AppButton = ({ title, onPress, variant = "primary", small = false, full = false, disabled = false }) => {
  const palette = {
    primary: { bg: C.acc, fg: C.t0, border: C.acc },
    ghost: { bg: C.bg3, fg: C.t0, border: C.lineH },
    subtle: { bg: C.bg4, fg: C.t0, border: C.line },
    danger: { bg: C.g5, fg: C.t0, border: C.g5 },
  }[variant] || { bg: C.acc, fg: C.t0, border: C.acc };
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [
      styles.button,
      {
        backgroundColor: disabled ? C.bg4 : palette.bg,
        borderColor: palette.border,
        opacity: disabled ? 0.6 : pressed ? 0.9 : 1,
        paddingVertical: small ? 8 : 12,
        paddingHorizontal: small ? 12 : 16,
        alignSelf: full ? "stretch" : "flex-start",
      },
    ]}>
      <Text style={[styles.buttonText, { color: palette.fg, fontSize: small ? 12 : 13 }]}>{title}</Text>
    </Pressable>
  );
};

const AppPill = ({ children, tone = C.acc }) => (
  <View style={[styles.pill, { borderColor: `${tone}55`, backgroundColor: `${tone}15` }]}>
    <Text style={[styles.pillText, { color: tone }]}>{children}</Text>
  </View>
);

const AppField = ({ label, ...props }) => (
  <View style={{ gap: 6 }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput {...props} placeholderTextColor={C.t2} style={[styles.input, props.style]} />
  </View>
);

const Segmented = ({ value, options, onChange }) => (
  <View style={styles.segmentWrap}>
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <Pressable key={opt.value} onPress={() => onChange(opt.value)} style={[styles.segment, active && styles.segmentActive]}>
          <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

const Sparkline = ({ grades = [], color = C.acc, width = 120, height = 36 }) => {
  const sorted = [...grades].filter((g) => Number.isFinite(Number(g.grade))).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-10);
  if (sorted.length < 2) return <View style={{ width, height }} />;
  const minX = 2;
  const maxX = width - 2;
  const minY = 2;
  const maxY = height - 2;
  const step = (maxX - minX) / (sorted.length - 1);
  const points = sorted.map((g, i) => {
    const grade = clamp(Number(g.grade), 1, 6);
    const y = minY + ((grade - 1) / 5) * (maxY - minY);
    const x = minX + step * i;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

const BarChart = ({ data = [], height = 200, colorForValue = gc }) => {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(260, width - 48);
  const rowH = data.length ? Math.max(24, Math.floor((height - 16) / data.length)) : 24;
  return (
    <View style={{ width: chartWidth, height: Math.max(height, rowH * Math.max(1, data.length) + 16) }}>
      {data.map((item, index) => {
        const pct = clamp(((item.value - 1) / 5) * 100, 0, 100);
        const color = colorForValue(item.value);
        return (
          <View key={item.label} style={{ height: rowH, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Text style={{ width: 92, color: C.t1, fontSize: 12 }} numberOfLines={1}>{item.label}</Text>
            <View style={{ flex: 1, height: 12, borderRadius: 999, backgroundColor: C.bg4, overflow: "hidden" }}>
              <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 999 }} />
            </View>
            <Text style={{ width: 44, textAlign: "right", color, fontWeight: "800" }}>{item.value.toFixed(2)}</Text>
          </View>
        );
      })}
    </View>
  );
};

const LineChart = ({ data = [], color = C.acc, height = 220, labelKey = "datum", valueKey = "value" }) => {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(280, width - 48);
  if (data.length < 2) {
    return <View style={{ height, alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.t2 }}>Nicht genug Daten</Text></View>;
  }
  const pad = 18;
  const maxX = chartWidth - pad;
  const maxY = height - pad;
  const minX = pad;
  const minY = pad;
  const points = data.map((item, index) => {
    const x = minX + (index / (data.length - 1)) * (maxX - minX);
    const value = clamp(Number(item[valueKey]), 1, 6);
    const y = minY + ((value - 1) / 5) * (maxY - minY);
    return { x, y, item };
  });
  const path = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath = `${minX},${maxY} ${path} ${maxX},${maxY}`;
  return (
    <Svg width={chartWidth} height={height}>
      <Defs>
        <LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={chartWidth} height={height} fill={C.bg3} rx={16} />
      {[1, 2, 3, 4, 5, 6].map((tick) => {
        const y = minY + ((tick - 1) / 5) * (maxY - minY);
        return <SvgLine key={tick} x1={minX} x2={maxX} y1={y} y2={y} stroke={C.line} strokeDasharray="4 4" />;
      })}
      <Path d={`M ${areaPath} Z`} fill="url(#lineGrad)" />
      <Polyline points={path} fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} />)}
      {points.map((p, i) => (
        <SvgText key={`${i}-label`} x={p.x} y={height - 4} fill={C.t2} fontSize={10} textAnchor="middle">
          {String(p.item[labelKey] || "")}
        </SvgText>
      ))}
    </Svg>
  );
};

const ToastHost = () => {
  const { toasts, dismissToast } = useContext(ToastContext);
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.toastLayer, { top: insets.top + 10 }]}>
      {toasts.map((toast) => (
        <Pressable key={toast.id} onPress={() => dismissToast(toast.id)} style={[styles.toast, toast.kind === "err" && styles.toastErr]}>
          <View style={[styles.toastDot, { backgroundColor: toast.kind === "err" ? C.err : C.ok }]} />
          <Text style={styles.toastText}>{toast.message}</Text>
        </Pressable>
      ))}
    </View>
  );
};

const GradeFormModal = ({ visible, onClose, editItem, onSave }) => {
  const [subject, setSubject] = useState(editItem?.subject || "");
  const [grade, setGrade] = useState(editItem?.grade != null ? String(editItem.grade) : "");
  const [weight, setWeight] = useState(editItem?.weight ?? 1);
  const [date, setDate] = useState(editItem?.date || toStr());
  const [type, setType] = useState(editItem?.type || "");
  const [errors, setErrors] = useState({});
  const { subjects: subjectList } = useApp();

  useEffect(() => {
    setSubject(editItem?.subject || "");
    setGrade(editItem?.grade != null ? String(editItem.grade) : "");
    setWeight(editItem?.weight ?? 1);
    setDate(editItem?.date || toStr());
    setType(editItem?.type || "");
    setErrors({});
  }, [editItem, visible]);

  const validate = () => {
    const next = {};
    if (!subject.trim()) next.subject = "Pflichtfeld";
    const g = parseFloat(String(grade).replace(",", "."));
    if (!grade || Number.isNaN(g) || g < 1 || g > 6) next.grade = "Note 1.0 - 6.0";
    if (!type) next.type = "Pflichtfeld";
    if (!date) next.date = "Pflichtfeld";
    setErrors(next);
    return !Object.keys(next).length;
  };

  const submit = () => {
    if (!validate()) return;
    const normalizedSubject = subject.trim();
    const payload = { subject: normalizedSubject, grade: parseFloat(String(grade).replace(",", ".")), weight, date, type };
    onSave(payload);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{editItem ? "Note bearbeiten" : "Neue Note"}</Text>
            <View style={{ gap: 14 }}>
              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Fach</Text>
                <TextInput value={subject} onChangeText={setSubject} placeholder="Fach eingeben" placeholderTextColor={C.t2} style={styles.input} />
                {!!subjectList.length && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 2 }}>
                    {subjectList.map((s) => <AppPill key={s} tone={C.acc} children={s} />)}
                  </ScrollView>
                )}
                {errors.subject ? <Text style={styles.error}>{errors.subject}</Text> : null}
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.label}>Note</Text>
                  <TextInput value={grade} onChangeText={(t) => (/^[0-9]*[.,]?[0-9]*$/.test(t) || t === "") && setGrade(t.replace(",", "."))} keyboardType="decimal-pad" placeholder="z.B. 2.5" placeholderTextColor={C.t2} style={styles.input} />
                  {errors.grade ? <Text style={styles.error}>{errors.grade}</Text> : null}
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.label}>Art</Text>
                  <View style={styles.selectBox}>
                    {ARTEN.slice(0, 4).map((item) => (
                      <Pressable key={item} onPress={() => { setType(item); setWeight(item === "Schulaufgabe" ? 2 : 1); }} style={[styles.selectChip, type === item && styles.selectChipActive]}>
                        <Text style={[styles.selectChipText, type === item && styles.selectChipTextActive]}>{item}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {errors.type ? <Text style={styles.error}>{errors.type}</Text> : null}
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Gewichtung</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((w) => (
                    <Pressable key={w} onPress={() => setWeight(w)} style={[styles.weightChip, weight === w && styles.weightChipActive]}>
                      <Text style={[styles.weightText, weight === w && styles.weightTextActive]}>×{w}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Datum (YYYY-MM-DD)</Text>
                <TextInput value={date} onChangeText={setDate} placeholder="2026-04-09" placeholderTextColor={C.t2} style={styles.input} />
                <Pressable onPress={() => setDate(toStr())} style={{ alignSelf: "flex-start" }}><Text style={{ color: C.accH, fontSize: 12 }}>Heute setzen</Text></Pressable>
                {errors.date ? <Text style={styles.error}>{errors.date}</Text> : null}
              </View>

              <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
                <AppButton variant="ghost" title="Abbrechen" onPress={onClose} />
                <AppButton title={editItem ? "Speichern" : "Note speichern"} onPress={submit} />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const SearchBox = ({ onSelect }) => {
  const { grades } = useApp();
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    if (!q.trim()) return [];
    const query = q.toLowerCase();
    return grades.filter((g) => [g.subject, g.type, String(g.grade), fDE(g.date)].join(" ").toLowerCase().includes(query)).slice(0, 6);
  }, [q, grades]);
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={C.t2} />
        <TextInput value={q} onChangeText={setQ} placeholder="Suche nach Fach, Art, Note..." placeholderTextColor={C.t2} style={{ flex: 1, color: C.t0, fontSize: 13 }} />
        {!!q && <Pressable onPress={() => setQ("")}><Ionicons name="close" size={16} color={C.t2} /></Pressable>}
      </View>
      {!!q.trim() && (
        <View style={styles.searchResults}>
          {hits.length === 0 ? <Text style={{ color: C.t2, fontSize: 12 }}>Keine Treffer</Text> : hits.map((g) => (
            <Pressable key={g.id} onPress={() => { setQ(""); onSelect?.(g.id); }} style={styles.searchResultRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.t0, fontWeight: "700" }}>{g.subject}</Text>
                <Text style={{ color: C.t2, fontSize: 11 }}>{g.type} · {fDE(g.date)}</Text>
              </View>
              <Text style={{ color: gc(g.grade), fontWeight: "900" }}>{Number(g.grade).toFixed(1)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

const LandingScreen = ({ onLogin, onRegister }) => {
  const features = [
    ["Übersicht", "Alle Fächer und Noten an einem Ort mit gewichtetem Schnitt."],
    ["Trends", "Entwicklungen, letzte Einträge und Fach-Statistiken auf einen Blick."],
    ["AI Pilot", "Fragen zu Szenarien, Risiken und nächsten Schritten."],
    ["Mobil", "Native App für iOS und Android mit Offline-Cache und Sync."],
  ];
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        <View style={styles.hero}>
          <View style={styles.heroBadge}><Text style={{ color: C.t0, fontWeight: "800" }}>NotenPilot</Text></View>
          <Text style={styles.heroTitle}>Deine Noten. Dein Verlauf. Deine KI.</Text>
          <Text style={styles.heroSubtitle}>Eine native Expo-App mit Dashboard, Notenverwaltung, Statistiken, KI-Chat, Google-Login und Firebase-Sync.</Text>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <AppButton title="Anmelden" onPress={onLogin} />
            <AppButton variant="ghost" title="Konto erstellen" onPress={onRegister} />
          </View>
        </View>
        <View style={{ gap: 12 }}>
          {features.map(([title, body]) => (
            <AppCard key={title}>
              <Text style={{ color: C.t0, fontSize: 16, fontWeight: "800", marginBottom: 6 }}>{title}</Text>
              <Text style={{ color: C.t1, lineHeight: 20 }}>{body}</Text>
            </AppCard>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const AuthScreen = ({ onAuthenticated, initialMode = "login", onBack }) => {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { pushToast } = useApp();

  const googleConfig = {
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || undefined,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  };
  const [request, response, promptAsync] = Google.useAuthRequest(googleConfig);

  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (!response || response.type !== "success" || !auth) return;
      const token = response.authentication?.idToken || response.params?.id_token;
      const accessToken = response.authentication?.accessToken || response.params?.access_token;
      if (!token) {
        setError("Google-Login benötigt eine gültige Client-ID.");
        return;
      }
      try {
        setLoading(true);
        setError("");
        const credential = GoogleAuthProvider.credential(token, accessToken);
        const result = await signInWithCredential(auth, credential);
        const userData = {
          email: result.user.email,
          name: result.user.displayName || result.user.email?.split("@")[0] || "Nutzer",
          uid: result.user.uid,
          photoUrl: result.user.photoURL || null,
          google: true,
          isNew: false,
        };
        pushToast("Mit Google angemeldet.");
        onAuthenticated(userData);
      } catch (err) {
        setError(err?.message || "Google-Anmeldung fehlgeschlagen.");
      } finally {
        setLoading(false);
      }
    };
    handleGoogleResponse();
  }, [response, onAuthenticated, pushToast]);

  const submit = async () => {
    if (!auth) {
      setError("Firebase ist noch nicht konfiguriert.");
      return;
    }
    if (!email.includes("@")) return setError("Bitte eine gültige E-Mail eingeben.");
    if (password.length < 6) return setError("Passwort mind. 6 Zeichen.");
    if (mode === "register" && !name.trim()) return setError("Bitte einen Namen eingeben.");
    try {
      setLoading(true);
      setError("");
      const result = mode === "login"
        ? await signInWithEmailAndPassword(auth, email, password)
        : await createUserWithEmailAndPassword(auth, email, password);
      if (mode === "register" && name.trim()) await updateProfile(result.user, { displayName: name.trim() });
      const userData = {
        email: result.user.email,
        name: result.user.displayName || result.user.email?.split("@")[0] || "Nutzer",
        uid: result.user.uid,
        photoUrl: result.user.photoURL || null,
        google: false,
        isNew: mode === "register",
      };
      pushToast(mode === "login" ? "Willkommen zurück." : "Konto erstellt.");
      onAuthenticated(userData);
    } catch (err) {
      setError(err?.message || "Anmeldung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  const googleEnabled = Boolean(request && (googleConfig.expoClientId || googleConfig.webClientId || googleConfig.iosClientId || googleConfig.androidClientId));

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 18 }}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{mode === "login" ? "Willkommen zurück" : "Konto erstellen"}</Text>
            <Text style={styles.heroSubtitle}>{mode === "login" ? "Melde dich an, um fortzufahren." : "Starte kostenlos durch."}</Text>
          </View>

          <AppCard>
            <AppButton title={loading ? "Bitte warten..." : "Mit Google anmelden"} onPress={() => promptAsync()} disabled={!googleEnabled || loading} variant="ghost" full />
            {!googleEnabled ? <Text style={styles.helpText}>Google-Login aktivierst du über die Expo Client IDs.</Text> : null}
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={{ color: C.t2, fontSize: 11, letterSpacing: 1 }}>ODER</Text>
              <View style={styles.divider} />
            </View>
            {mode === "register" && <AppField label="Name" value={name} onChangeText={setName} placeholder="Dein Name" />}
            <View style={{ height: 12 }} />
            <AppField label="E-Mail" value={email} onChangeText={setEmail} placeholder="name@schule.de" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
            <View style={{ height: 12 }} />
            <AppField label="Passwort" value={password} onChangeText={setPassword} placeholder={mode === "register" ? "Mind. 6 Zeichen" : "Passwort"} secureTextEntry />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <View style={{ height: 14 }} />
            <AppButton title={loading ? "Bitte warten..." : mode === "login" ? "Anmelden" : "Konto erstellen"} onPress={submit} disabled={loading} full />
            <View style={{ height: 14 }} />
            <Pressable onPress={() => { setError(""); setMode(mode === "login" ? "register" : "login"); }}>
              <Text style={{ color: C.accH, textAlign: "center", fontWeight: "700" }}>{mode === "login" ? "Noch kein Konto? Registrieren" : "Schon registriert? Anmelden"}</Text>
            </Pressable>
            {onBack ? <Pressable onPress={onBack} style={{ marginTop: 14 }}><Text style={{ color: C.t2, textAlign: "center" }}>Zurück</Text></Pressable> : null}
          </AppCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const GradesScreen = ({ navigation, highlightId, onOpenEdit, onSearchSelect }) => {
  const { grades, subjects, setGrades, setSubjects, pushToast } = useApp();
  const [subjectFilter, setSubjectFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return [...grades]
      .filter((g) => (!subjectFilter || g.subject === subjectFilter) && (!typeFilter || g.type === typeFilter))
      .filter((g) => !q.trim() || [g.subject, g.type, String(g.grade), fDE(g.date)].join(" ").toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [grades, q, subjectFilter, typeFilter]);

  useEffect(() => {
    if (!highlightId) return;
    const found = grades.find((g) => g.id === highlightId);
    if (found) {
      if (subjectFilter && found.subject !== subjectFilter) setSubjectFilter("");
      if (typeFilter && found.type !== typeFilter) setTypeFilter("");
      pushToast(`Treffer: ${found.subject} ${Number(found.grade).toFixed(1)}`);
    }
  }, [highlightId]);

  const deleteGrade = (id) => {
    Alert.alert("Note löschen", "Diesen Eintrag wirklich löschen?", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: () => { setGrades((prev) => prev.filter((g) => g.id !== id)); pushToast("Note gelöscht."); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ gap: 12 }}>
          <Text style={styles.screenTitle}>Alle Noten</Text>
          <SearchBox onSelect={(id) => onSearchSelect?.(id)} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fach</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <Pressable onPress={() => setSubjectFilter("")} style={[styles.filterChip, !subjectFilter && styles.filterChipActive]}><Text style={[styles.filterChipText, !subjectFilter && styles.filterChipTextActive]}>Alle</Text></Pressable>
                {subjects.map((s) => <Pressable key={s} onPress={() => setSubjectFilter(s)} style={[styles.filterChip, subjectFilter === s && styles.filterChipActive]}><Text style={[styles.filterChipText, subjectFilter === s && styles.filterChipTextActive]}>{s}</Text></Pressable>)}
              </ScrollView>
            </View>
          </View>
          <View>
            <Text style={styles.label}>Art</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pressable onPress={() => setTypeFilter("")} style={[styles.filterChip, !typeFilter && styles.filterChipActive]}><Text style={[styles.filterChipText, !typeFilter && styles.filterChipTextActive]}>Alle</Text></Pressable>
              {ARTEN.map((t) => <Pressable key={t} onPress={() => setTypeFilter(t)} style={[styles.filterChip, typeFilter === t && styles.filterChipActive]}><Text style={[styles.filterChipText, typeFilter === t && styles.filterChipTextActive]}>{t}</Text></Pressable>)}
            </ScrollView>
          </View>
        </View>

        <Text style={{ color: C.t2, fontSize: 12 }}>{rows.length} Einträge{subjectFilter || typeFilter ? " (gefiltert)" : ""}</Text>

        <AppCard style={{ padding: 0, overflow: "hidden" }}>
          {rows.length === 0 ? (
            <View style={{ padding: 18 }}><Text style={{ color: C.t2, textAlign: "center" }}>Noch keine Noten vorhanden.</Text></View>
          ) : rows.map((g, index) => (
            <Pressable key={g.id} onPress={() => onOpenEdit(g)} style={[styles.gradeRow, index === rows.length - 1 && { borderBottomWidth: 0 }, highlightId === g.id && styles.gradeRowHighlight]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.t0, fontWeight: "700" }}>{g.subject}</Text>
                <Text style={{ color: C.t2, fontSize: 11 }}>{g.type} · {fDE(g.date)} · ×{g.weight}</Text>
              </View>
              <Text style={{ color: gc(g.grade), fontSize: 24, fontWeight: "900" }}>{Number(g.grade).toFixed(1)}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <AppButton title="Bearbeiten" onPress={() => onOpenEdit(g)} variant="ghost" small />
                <AppButton title="Löschen" onPress={() => deleteGrade(g.id)} variant="danger" small />
              </View>
            </Pressable>
          ))}
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
};

const DashboardScreen = ({ navigation, highlightId, onOpenAdd, onOpenEdit, onSearchSelect }) => {
  const { grades, subjects, user, pushToast } = useApp();
  const [insight, setInsight] = useState("AI Insight wird geladen...");
  const [loadingInsight, setLoadingInsight] = useState(true);
  const insightCountRef = useRef(-1);
  const avg = wAvg(grades);
  const avgColor = avg ? gc(avg) : C.t2;
  const sStats = useMemo(() => subjects.map((s) => {
    const sg = grades.filter((g) => g.subject === s);
    return { label: s, value: wAvg(sg), count: sg.length };
  }).filter((item) => item.value != null).sort((a, b) => a.value - b.value), [grades, subjects]);
  const trend = useMemo(() => [...grades].sort((a, b) => new Date(a.date) - new Date(b.date)).map((g, index, arr) => ({ datum: g.date.slice(5), value: g.grade, avg: wAvg(arr.slice(0, index + 1)) })), [grades]);
  const recent = useMemo(() => [...grades].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6), [grades]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.uid) {
        setInsight(buildDashboardInsight(buildAIContext(grades, subjects)));
        setLoadingInsight(false);
        return;
      }
      try {
        const persisted = await loadDashboardInsight(user.uid);
        if (!cancelled && persisted?.text) setInsight(persisted.text);
      } catch {}
      try {
        const count = grades.length;
        const shouldRefresh = insightCountRef.current < 0 || Math.max(0, count - insightCountRef.current) >= 2;
        if (!shouldRefresh) return;
        const result = await dashboardInsightDetailed(buildAIContext(grades, subjects));
        if (cancelled) return;
        const next = String(result?.answer || "").trim() || buildDashboardInsight(buildAIContext(grades, subjects));
        setInsight(next);
        insightCountRef.current = count;
        if (user?.uid) saveDashboardInsight(user.uid, { text: next }).catch(() => {});
      } catch {
        if (!cancelled) setInsight(buildDashboardInsight(buildAIContext(grades, subjects)));
      } finally {
        if (!cancelled) setLoadingInsight(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [grades.length, user?.uid]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={styles.heroCompact}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>Guten Tag{user?.name ? `, ${user.name}` : ""}</Text>
            <Text style={{ color: C.t2, marginTop: 4 }}>Dein Leistungsüberblick.</Text>
          </View>
          <SearchBox onSelect={(id) => onSearchSelect?.(id)} />
        </View>

        <AppCard style={{ backgroundColor: C.bg4 }}>
          <Text style={styles.kicker}>AI PILOT</Text>
          <Text style={{ color: C.t0, lineHeight: 22 }}>{loadingInsight ? "AI Insight wird geladen..." : insight}</Text>
        </AppCard>

        <View style={styles.kpiGrid}>
          <AppCard style={styles.kpiCard}><Text style={styles.kpiLabel}>Gesamtschnitt</Text><Text style={[styles.kpiValue, { color: avg ? avgColor : C.t2 }]}>{avg ? avg.toFixed(2) : "–"}</Text><Text style={{ color: C.t2 }}>{avg ? gl(avg) : "Keine Noten"}</Text></AppCard>
          <AppCard style={styles.kpiCard}><Text style={styles.kpiLabel}>Noten gesamt</Text><Text style={styles.kpiValue}>{grades.length}</Text><Text style={{ color: C.t2 }}>{subjects.length} Fächer</Text></AppCard>
          <AppCard style={styles.kpiCard}><Text style={styles.kpiLabel}>Bestes Fach</Text><Text style={styles.kpiSmallValue}>{sStats[0]?.label || "–"}</Text><Text style={{ color: sStats[0] ? gc(sStats[0].value) : C.t2 }}>{sStats[0] ? sStats[0].value.toFixed(2) : ""}</Text></AppCard>
          <AppCard style={styles.kpiCard}><Text style={styles.kpiLabel}>Schwächstes Fach</Text><Text style={styles.kpiSmallValue}>{sStats.at(-1)?.label || "–"}</Text><Text style={{ color: sStats.at(-1) ? gc(sStats.at(-1).value) : C.t2 }}>{sStats.at(-1) ? sStats.at(-1).value.toFixed(2) : ""}</Text></AppCard>
        </View>

        <AppCard>
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionTitle}>Notenverlauf</Text>
            <AppButton title="+ Note" onPress={onOpenAdd} small />
          </View>
          <LineChart data={trend} color={avgColor} labelKey="datum" valueKey="value" height={220} />
        </AppCard>

        <AppCard>
          <Text style={styles.sectionTitle}>Zuletzt eingetragen</Text>
          {recent.length === 0 ? <Text style={{ color: C.t2 }}>Noch keine Noten.</Text> : recent.map((g) => (
            <View key={g.id} style={styles.recentRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.t0, fontWeight: "700" }}>{g.subject}</Text>
                <Text style={{ color: C.t2, fontSize: 11 }}>{g.type} · {fDE(g.date)}</Text>
              </View>
              <Text style={{ color: gc(g.grade), fontWeight: "900", fontSize: 20 }}>{Number(g.grade).toFixed(1)}</Text>
              <Pressable onPress={() => onOpenEdit(g)}><Ionicons name="create-outline" size={18} color={C.accH} /></Pressable>
            </View>
          ))}
        </AppCard>

        {sStats.length > 0 && (
          <AppCard>
            <Text style={styles.sectionTitle}>Schnitt nach Fach</Text>
            <BarChart data={sStats.map((item) => ({ label: item.label, value: item.value }))} />
          </AppCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const StatsScreen = ({ onOpenEdit }) => {
  const { grades, subjects } = useApp();
  const [period, setPeriod] = useState("all");
  const filtered = useMemo(() => {
    const days = { "7d": 7, "30d": 30, all: Infinity }[period];
    return grades.filter((g) => (Date.now() - new Date(g.date)) / 86400000 <= days);
  }, [grades, period]);
  const sStats = useMemo(() => subjects.map((s) => ({ label: s, value: wAvg(filtered.filter((g) => g.subject === s)), count: filtered.filter((g) => g.subject === s).length })).filter((item) => item.value != null).sort((a, b) => a.value - b.value), [filtered, subjects]);
  const avg = wAvg(filtered);
  const trend = useMemo(() => {
    if (filtered.length < 3) return null;
    const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
    const n = sorted.length;
    const xs = sorted.map((_, i) => i);
    const ys = sorted.map((g) => g.grade);
    const xMean = xs.reduce((s, x) => s + x, 0) / n;
    const yMean = ys.reduce((s, y) => s + y, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
    const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
    const slope = den === 0 ? 0 : num / den;
    if (slope < -0.08) return { label: "Verbessert", icon: "↑", color: C.g1 };
    if (slope > 0.08) return { label: "Verschlechtert", icon: "↓", color: C.g5 };
    return { label: "Stabil", icon: "→", color: C.g3 };
  }, [filtered]);
  const typeData = useMemo(() => Object.entries(filtered.reduce((acc, g) => ({ ...acc, [g.type]: (acc[g.type] || 0) + 1 }), {})).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count), [filtered]);
  const frequent = useMemo(() => {
    if (!filtered.length) return null;
    const map = {};
    filtered.forEach((g) => {
      const rounded = Math.round(g.grade * 2) / 2;
      map[rounded] = (map[rounded] || 0) + 1;
    });
    const best = Object.entries(map).sort((a, b) => b[1] - a[1])[0];
    return best ? parseFloat(best[0]) : null;
  }, [filtered]);
  const lastImprovement = useMemo(() => {
    if (filtered.length < 2) return null;
    const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date) || (a.id < b.id ? -1 : 1));
    for (let i = sorted.length - 1; i >= 1; i -= 1) {
      const curr = sorted[i];
      const prev = [...sorted].slice(0, i).reverse().find((g) => g.subject === curr.subject);
      if (prev && curr.grade < prev.grade) return { subject: curr.subject, from: prev.grade, to: curr.grade };
    }
    return null;
  }, [filtered]);
  const trendData = useMemo(() => filtered.sort((a, b) => new Date(a.date) - new Date(b.date)).map((g) => ({ datum: g.date.slice(5), value: g.grade })), [filtered]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={styles.sectionHeadRow}>
          <Text style={styles.screenTitle}>Statistiken</Text>
          <Segmented value={period} onChange={setPeriod} options={[{ value: "7d", label: "7 Tage" }, { value: "30d", label: "30 Tage" }, { value: "all", label: "Gesamt" }]} />
        </View>

        <View style={styles.kpiGrid}>
          <AppCard style={styles.kpiCard}><Text style={styles.kpiLabel}>Durchschnitt</Text><Text style={[styles.kpiValue, { color: avg ? gc(avg) : C.t2 }]}>{avg ? avg.toFixed(2) : "–"}</Text></AppCard>
          <AppCard style={styles.kpiCard}><Text style={styles.kpiLabel}>Anzahl Noten</Text><Text style={styles.kpiValue}>{filtered.length}</Text></AppCard>
          <AppCard style={styles.kpiCard}><Text style={styles.kpiLabel}>Häufigste Note</Text><Text style={[styles.kpiValue, { color: frequent != null ? gc(frequent) : C.t2 }]}>{frequent != null ? frequent.toFixed(1).replace(".", ",") : "–"}</Text></AppCard>
          <AppCard style={styles.kpiCard}><Text style={styles.kpiLabel}>Letzte Verbesserung</Text><Text style={{ color: C.t0, fontWeight: "800" }}>{lastImprovement ? `${lastImprovement.subject}: ${lastImprovement.from.toFixed(1)} → ${lastImprovement.to.toFixed(1)}` : "Keine"}</Text></AppCard>
        </View>

        <AppCard>
          <Text style={styles.sectionTitle}>Notenverlauf</Text>
          {trendData.length >= 2 ? <LineChart data={trendData} color={avg ? gc(avg) : C.acc} labelKey="datum" valueKey="value" /> : <Text style={{ color: C.t2 }}>Nicht genug Daten</Text>}
        </AppCard>

        <AppCard>
          <Text style={styles.sectionTitle}>Leistungsarten</Text>
          {typeData.length === 0 ? <Text style={{ color: C.t2 }}>Keine Daten</Text> : typeData.map((t) => (
            <View key={t.label} style={styles.typeRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: C.acc }} />
                <Text style={{ color: C.t1 }}>{t.label}</Text>
              </View>
              <Text style={{ color: C.t0, fontWeight: "800" }}>{t.count}</Text>
            </View>
          ))}
        </AppCard>

        {sStats.length > 0 && (
          <AppCard>
            <Text style={styles.sectionTitle}>Fachdetails</Text>
            <BarChart data={sStats.map((item) => ({ label: item.label, value: item.value }))} />
          </AppCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const AIScreen = () => {
  const { grades, subjects, user, cloudSynced, askedQuestions, setAskedQuestions, questionsRemaining, setQuestionsRemaining, messages, setMessages } = useApp();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [engineText, setEngineText] = useState("");
  const ctx = useMemo(() => buildAIContext(grades, subjects), [grades, subjects]);
  const listRef = useRef(null);

  useEffect(() => { listRef.current?.scrollToEnd?.({ animated: true }); }, [messages]);

  const send = useCallback(async (forcedPrompt) => {
    const prompt = String(forcedPrompt ?? input).trim();
    if (!prompt || sending) return;
    if (user?.uid && !cloudSynced) {
      setMessages((prev) => [...prev, { id: `ai_${Date.now()}`, role: "assistant", text: "Bitte kurz warten: Deine Daten werden noch mit der Cloud synchronisiert.", streaming: false, followUps: [] }]);
      return;
    }
    if (user?.uid) {
      const quota = await consumeUserQuestionQuota(user.uid, DAILY_AI_PILOT_QUESTIONS);
      setQuestionsRemaining(quota.remaining);
      if (!quota.allowed) {
        setMessages((prev) => [...prev, { id: `ai_limit_${Date.now()}`, role: "assistant", text: "Limit erreicht. Du hast heute keine Fragen mehr übrig.", streaming: false, followUps: [] }]);
        return;
      }
    }
    setSending(true);
    setInput("");
    const userMsg = { id: `u_${Date.now()}`, role: "user", text: prompt };
    const assistantId = `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", text: "", streaming: true, followUps: [] }]);
    const history = messages.filter((m) => m.role === "user" || m.role === "assistant");
    setEngineText(AI_ENDPOINT ? "Verbinde mit AI-Backend..." : "Regelbasierte Antwort...");
    let partial = "";
    for await (const chunk of streamChatAnswer(prompt, ctx, history)) {
      partial = chunk;
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, text: partial, streaming: true } : m));
    }
    setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, streaming: false, followUps: getSuggestions(ctx) } : m));
    setEngineText("");
    setSending(false);
  }, [cloudSynced, ctx, input, messages, sending, setMessages, setQuestionsRemaining, user?.uid]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          <AppCard>
            <View style={styles.sectionHeadRow}>
              <View>
                <Text style={styles.screenTitle}>AI Pilot</Text>
                {!!engineText && <Text style={styles.helpText}>{engineText}</Text>}
                <Text style={styles.helpText}>Noch {questionsRemaining} Frage{questionsRemaining === 1 ? "" : "n"} übrig</Text>
              </View>
              <AppPill tone={questionsRemaining > 0 ? C.g1 : C.err}>{questionsRemaining > 0 ? "bereit" : "Limit"}</AppPill>
            </View>
          </AppCard>

          <AppCard style={{ flex: 1, padding: 0, overflow: "hidden" }}>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 14, gap: 10 }}
              renderItem={({ item }) => (
                <View style={[styles.chatRow, item.role === "user" ? styles.chatRowRight : styles.chatRowLeft]}>
                  <View style={[styles.chatBubble, item.role === "user" ? styles.chatBubbleUser : styles.chatBubbleAi]}>
                    <Text style={{ color: item.role === "user" ? C.t0 : C.t1, lineHeight: 20 }}>{item.text || (item.streaming ? "…" : "")}{item.streaming ? " ▍" : ""}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={{ color: C.t2 }}>Starte mit einer Frage zu Trends, Fächern oder Szenarien.</Text>}
            />
            {!!messages.length && messages.at(-1)?.role === "assistant" && !messages.at(-1)?.streaming && !!messages.at(-1)?.followUps?.length && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.line }}>
                {messages.at(-1).followUps.map((f) => <AppButton key={f} title={f} onPress={() => send(f)} variant="ghost" small />)}
              </ScrollView>
            )}
          </AppCard>

          <View style={styles.chatComposer}>
            <TextInput value={input} onChangeText={setInput} placeholder="Frag nach Trends, Daten oder Szenarien..." placeholderTextColor={C.t2} style={[styles.input, { flex: 1 }]} />
            <AppButton title={sending ? "..." : "Senden"} onPress={() => send()} disabled={!input.trim() || sending || questionsRemaining === 0} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const SettingsScreen = ({ onLogout }) => {
  const { grades, setGrades, subjects, setSubjects, user, pushToast } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const exportData = async () => {
    await Share.share({ message: JSON.stringify({ grades, subjects }, null, 2), title: `notenpilot-${toStr()}.json` });
    pushToast("Export bereit.");
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={styles.screenTitle}>Einstellungen</Text>
        {!!user && <Text style={{ color: C.t2 }}>Angemeldet als {user.email}</Text>}

        <AppCard>
          <Text style={styles.sectionTitle}>Fächer verwalten</Text>
          <View style={{ gap: 8 }}>
            {subjects.length === 0 ? <Text style={{ color: C.t2 }}>Keine Fächer.</Text> : subjects.map((subject) => (
              <View key={subject} style={styles.settingsRow}>
                <Text style={{ color: C.t0 }}>{subject}</Text>
                <AppButton title="Löschen" variant="danger" small onPress={() => { setSubjects((prev) => prev.filter((item) => item !== subject)); pushToast(`„${subject}" gelöscht.`); }} />
              </View>
            ))}
          </View>
        </AppCard>

        <AppCard>
          <Text style={styles.sectionTitle}>Konto</Text>
          <Text style={{ color: C.t1, marginBottom: 12 }}>Du bist angemeldet als <Text style={{ color: C.t0, fontWeight: "700" }}>{user?.email || "unbekannt"}</Text>.</Text>
          <AppButton title="Abmelden" variant="ghost" onPress={onLogout} />
        </AppCard>

        <AppCard>
          <Text style={styles.sectionTitle}>Daten exportieren</Text>
          <Text style={{ color: C.t1, marginBottom: 12 }}>Alle Noten als JSON teilen.</Text>
          <AppButton title="Exportieren" variant="subtle" onPress={exportData} />
        </AppCard>

        <AppCard style={{ borderColor: `${C.err}55` }}>
          <Text style={[styles.sectionTitle, { color: C.err }]}>Gefahrenzone</Text>
          <Text style={{ color: C.t1, marginBottom: 12 }}>Alle Noten unwiderruflich löschen.</Text>
          {!confirmDelete ? (
            <AppButton title="Alle Daten löschen" variant="danger" onPress={() => setConfirmDelete(true)} />
          ) : (
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <AppButton title="Ja, löschen" variant="danger" onPress={() => { setGrades([]); setSubjects([]); setConfirmDelete(false); pushToast("Alle Daten gelöscht."); }} />
              <AppButton title="Abbrechen" variant="ghost" onPress={() => setConfirmDelete(false)} />
            </View>
          )}
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = ({ onOpenAdd, onOpenEdit, highlightId, setHighlightId, onLogout }) => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: { backgroundColor: C.bg3, borderTopColor: C.line, height: 64, paddingBottom: 8, paddingTop: 6 },
      tabBarActiveTintColor: C.accH,
      tabBarInactiveTintColor: C.t2,
      tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      tabBarIcon: ({ color, size }) => {
        const icons = {
          Dashboard: "grid-outline",
          Noten: "list-outline",
          AI: "chatbubbles-outline",
          Einstellungen: "settings-outline",
        };
        return <Ionicons name={icons[route.name]} color={color} size={size} />;
      },
    })}
  >
    <Tab.Screen name="Dashboard">{(props) => <DashboardScreen {...props} highlightId={highlightId} onOpenAdd={onOpenAdd} onOpenEdit={onOpenEdit} onSearchSelect={(id) => { setHighlightId(id); props.navigation.navigate("Noten"); }} />}</Tab.Screen>
    <Tab.Screen name="Noten">{(props) => <GradesScreen {...props} highlightId={highlightId} onOpenEdit={onOpenEdit} onSearchSelect={(id) => setHighlightId(id)} />}</Tab.Screen>
    <Tab.Screen name="AI" component={AIScreen} />
    <Tab.Screen name="Einstellungen">{() => <SettingsScreen onLogout={onLogout} />}</Tab.Screen>
  </Tab.Navigator>
);

const AppShell = () => {
  const [grades, setGrades] = useStoredState("np_mobile_grades", SEED_GRADES);
  const [subjects, setSubjects] = useStoredState("np_mobile_subjects", SEED_SUBJECTS);
  const [messages, setMessages] = useStoredState("np_mobile_messages", []);
  const [askedQuestions, setAskedQuestions] = useStoredState("np_mobile_asked_questions", []);
  const [questionsRemaining, setQuestionsRemaining] = useState(DAILY_AI_PILOT_QUESTIONS);
  const [user, setUser] = useState(null);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [view, setView] = useState("landing");
  const [gradeFormVisible, setGradeFormVisible] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [toasts, pushToast, setToasts] = useToastState();
  const cloudReadyRef = useRef(false);
  const lastCloudSigRef = useRef("");

  const refreshQuestionQuota = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const quota = await getUserQuestionQuota(user.uid, DAILY_AI_PILOT_QUESTIONS);
      if (Number.isFinite(quota?.remaining)) setQuestionsRemaining(quota.remaining);
    } catch (err) {
      console.error("Quota refresh failed:", err);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setCloudSynced(false);
        cloudReadyRef.current = false;
        lastCloudSigRef.current = "";
        return;
      }
      const nextUser = {
        email: firebaseUser.email,
        name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Nutzer",
        uid: firebaseUser.uid,
        photoUrl: firebaseUser.photoURL || null,
        google: !!firebaseUser.providerData?.some((provider) => provider.providerId === "google.com"),
        isNew: false,
      };
      setUser(nextUser);
      setView("app");
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.uid || !firestore) return;
    setCloudSynced(false);
    cloudReadyRef.current = false;
    const unsub = subscribeUserCloudData(
      user.uid,
      async (remoteData) => {
        if (!remoteData) {
          const initialPayload = { grades, subjects };
          await saveUserCloudData(user.uid, initialPayload).catch(() => {});
          lastCloudSigRef.current = JSON.stringify(initialPayload);
          cloudReadyRef.current = true;
          setCloudSynced(true);
          return;
        }
        setGrades(remoteData.grades);
        setSubjects(remoteData.subjects);
        lastCloudSigRef.current = JSON.stringify(remoteData);
        cloudReadyRef.current = true;
        setCloudSynced(true);
      },
      (err) => {
        console.error("Cloud sync subscribe failed:", err);
        cloudReadyRef.current = false;
        setCloudSynced(false);
      }
    );
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !cloudReadyRef.current || !firestore) return;
    const localPayload = { grades, subjects };
    const sig = JSON.stringify(localPayload);
    if (sig === lastCloudSigRef.current) return;
    saveUserCloudData(user.uid, localPayload)
      .then(() => { lastCloudSigRef.current = sig; })
      .catch((err) => console.error("Cloud save failed:", err));
  }, [user?.uid, grades, subjects]);

  useEffect(() => {
    if (!user?.uid) {
      setQuestionsRemaining(DAILY_AI_PILOT_QUESTIONS);
      return undefined;
    }
    refreshQuestionQuota();
    const appStateSub = AppState.addEventListener("change", (state) => { if (state === "active") refreshQuestionQuota(); });
    const timeoutId = setTimeout(refreshQuestionQuota, getMsUntilNextBerlinMidnight());
    return () => {
      clearTimeout(timeoutId);
      appStateSub.remove();
    };
  }, [user?.uid, refreshQuestionQuota]);

  const handleAuthenticated = (nextUser) => {
    setUser(nextUser);
    setView("app");
  };

  const handleLogout = async () => {
    try {
      if (auth) await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
    setUser(null);
    setCloudSynced(false);
    setView("landing");
    pushToast("Abgemeldet.");
  };

  const openAdd = () => { setEditingGrade(null); setGradeFormVisible(true); };
  const openEdit = (gradeItem) => { setEditingGrade(gradeItem); setGradeFormVisible(true); };
  const saveGrade = (payload) => {
    if (!payload.subject.trim()) return;
    setSubjects((prev) => prev.includes(payload.subject.trim()) ? prev : [...prev, payload.subject.trim()]);
    if (editingGrade) {
      setGrades((prev) => prev.map((gradeItem) => gradeItem.id === editingGrade.id ? { ...payload, id: editingGrade.id } : gradeItem));
      pushToast("Note aktualisiert.");
    } else {
      setGrades((prev) => [...prev, { ...payload, id: `g${uid()}` }]);
      pushToast("Note gespeichert.");
    }
  };

  const appValue = useMemo(() => ({
    grades,
    setGrades,
    subjects,
    setSubjects,
    user,
    cloudSynced,
    messages,
    setMessages,
    askedQuestions,
    setAskedQuestions,
    questionsRemaining,
    setQuestionsRemaining,
    pushToast,
  }), [grades, setGrades, subjects, setSubjects, user, cloudSynced, messages, setMessages, askedQuestions, setAskedQuestions, questionsRemaining, setQuestionsRemaining, pushToast]);

  return (
    <AppContext.Provider value={appValue}>
      <ToastContext.Provider value={{ toasts, pushToast, dismissToast: (id) => setToasts((prev) => prev.filter((item) => item.id !== id)) }}>
        <View style={{ flex: 1, backgroundColor: C.bg0 }}>
          {view === "landing" && <LandingScreen onLogin={() => setView("auth")} onRegister={() => setView("auth")} />}
          {view === "auth" && <AuthScreen onAuthenticated={handleAuthenticated} onBack={() => setView("landing")} />}
          {view === "app" && <NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg0, card: C.bg3, border: C.line, text: C.t0, primary: C.acc } }}>
            <MainTabs onOpenAdd={openAdd} onOpenEdit={openEdit} highlightId={highlightId} setHighlightId={setHighlightId} onLogout={handleLogout} />
          </NavigationContainer>}

          {view === "app" && (
            <Pressable onPress={openAdd} style={styles.fab}>
              <Ionicons name="add" size={28} color={C.t0} />
            </Pressable>
          )}

          <GradeFormModal visible={gradeFormVisible} onClose={() => setGradeFormVisible(false)} editItem={editingGrade} onSave={saveGrade} />
          <ToastHost />
        </View>
      </ToastContext.Provider>
    </AppContext.Provider>
  );
};

export default function MobileApp() {
  return <AppShell />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg0 },
  hero: {
    backgroundColor: C.bg3,
    borderColor: C.lineH,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 12,
    overflow: "hidden",
  },
  heroCompact: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  heroBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: `${C.acc}25`,
    borderWidth: 1,
    borderColor: `${C.acc}55`,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroTitle: { color: C.t0, fontSize: 30, fontWeight: "900", letterSpacing: -0.8, lineHeight: 34 },
  heroSubtitle: { color: C.t1, fontSize: 14, lineHeight: 22 },
  screenTitle: { color: C.t0, fontSize: 24, fontWeight: "900", letterSpacing: -0.6 },
  sectionTitle: { color: C.t0, fontSize: 16, fontWeight: "800", marginBottom: 10 },
  kicker: { color: C.t2, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 8 },
  card: {
    backgroundColor: C.bg3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    gap: 10,
  },
  button: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontWeight: "800" },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  label: { color: C.t2, fontSize: 12, fontWeight: "700" },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.lineH,
    backgroundColor: C.bg4,
    color: C.t0,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  error: { color: C.err, fontSize: 12, marginTop: 4 },
  helpText: { color: C.t2, fontSize: 12, lineHeight: 18 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 10 },
  divider: { flex: 1, height: 1, backgroundColor: C.line },
  segmentWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segment: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: C.bg4, borderWidth: 1, borderColor: C.line },
  segmentActive: { backgroundColor: `${C.acc}22`, borderColor: `${C.acc}66` },
  segmentText: { color: C.t1, fontSize: 12, fontWeight: "700" },
  segmentTextActive: { color: C.accH },
  selectBox: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selectChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: C.bg4, borderWidth: 1, borderColor: C.line },
  selectChipActive: { backgroundColor: `${C.acc}1f`, borderColor: `${C.acc}66` },
  selectChipText: { color: C.t1, fontSize: 11, fontWeight: "700" },
  selectChipTextActive: { color: C.accH },
  weightChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: C.bg4, borderWidth: 1, borderColor: C.line },
  weightChipActive: { backgroundColor: `${C.acc}1f`, borderColor: `${C.acc}66` },
  weightText: { color: C.t1, fontWeight: "700" },
  weightTextActive: { color: C.accH },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.bg3, borderColor: C.lineH, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, minHeight: 48 },
  searchResults: { backgroundColor: C.bg3, borderColor: C.lineH, borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  searchResultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line },
  gradeRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: C.line, borderLeftWidth: 3, borderLeftColor: "transparent" },
  gradeRowHighlight: { borderLeftColor: C.acc, backgroundColor: `${C.acc}12` },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  typeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  kpiCard: { flexBasis: "48%", minHeight: 132 },
  kpiLabel: { color: C.t2, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  kpiValue: { color: C.t0, fontSize: 34, fontWeight: "900", letterSpacing: -1 },
  kpiSmallValue: { color: C.t0, fontSize: 20, fontWeight: "900", marginTop: 4 },
  sectionHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  chatRow: { width: "100%", flexDirection: "row" },
  chatRowLeft: { justifyContent: "flex-start" },
  chatRowRight: { justifyContent: "flex-end" },
  chatBubble: { maxWidth: "90%", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  chatBubbleUser: { backgroundColor: `${C.acc}22`, borderColor: `${C.acc}55` },
  chatBubbleAi: { backgroundColor: C.bg4, borderColor: C.line },
  chatComposer: { flexDirection: "row", alignItems: "center", gap: 10 },
  settingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 86,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.acc,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${C.accH}66`,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  toastLayer: { position: "absolute", left: 16, right: 16, gap: 8, zIndex: 999 },
  toast: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: C.bg3, borderWidth: 1, borderColor: `${C.acc}44` },
  toastErr: { borderColor: `${C.err}55` },
  toastDot: { width: 8, height: 8, borderRadius: 999 },
  toastText: { color: C.t0, flex: 1 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.46)" },
  sheet: { backgroundColor: C.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: C.lineH, padding: 18, gap: 14 },
  sheetHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 999, backgroundColor: C.lineH },
  sheetTitle: { color: C.t0, fontSize: 20, fontWeight: "900" },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg4 },
  filterChipActive: { backgroundColor: `${C.acc}1f`, borderColor: `${C.acc}66` },
  filterChipText: { color: C.t1, fontWeight: "700", fontSize: 12 },
  filterChipTextActive: { color: C.accH },
  helpCard: { backgroundColor: C.bg4, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 14 },
  chatChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg4 },
});