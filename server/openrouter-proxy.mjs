import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const readEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
};

const rootDir = process.cwd();
const fileEnv = {
  ...readEnvFile(path.join(rootDir, ".env")),
  ...readEnvFile(path.join(rootDir, ".env.local")),
};

const env = (name, fallback = "") => {
  const fromProcess = process.env[name];
  if (fromProcess != null && String(fromProcess).trim() !== "") return String(fromProcess);
  const fromFile = fileEnv[name];
  if (fromFile != null && String(fromFile).trim() !== "") return String(fromFile);
  return fallback;
};

const PORT = Number(process.env.PORT || 8787);
const GEMINI_API_KEY = env("GEMINI_API_KEY").trim();
const GEMINI_BASE_URL = env("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
const GEMINI_MODEL = env("GEMINI_MODEL", "gemini-2.0-flash").trim();
const GEMINI_FALLBACK_MODELS_STR = env("GEMINI_FALLBACK_MODELS", "gemini-2.0-flash,gemini-1.5-flash").trim();
const GEMINI_429_COOLDOWN_MS = Number(env("GEMINI_429_COOLDOWN_MS", "300000"));
const GEMINI_TIMEOUT_MS = Number(env("GEMINI_TIMEOUT_MS", "7000"));
const GEMINI_FALLBACK_MODELS = GEMINI_FALLBACK_MODELS_STR.split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const OPENROUTER_API_KEY = env("OPENROUTER_API_KEY").trim();
const OPENROUTER_BASE_URL = env("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").replace(/\/$/, "");
const HF_BASE_URL = env("HF_BASE_URL", "https://router.huggingface.co/v1").replace(/\/$/, "");
const HF_TOKEN = env("HF_TOKEN", env("HF_API_KEY", "")).trim();
const HF_MODEL = env("HF_MODEL", "Qwen/Qwen2.5-7B-Instruct").trim();
const OPENROUTER_TIMEOUT_MS = Number(env("OPENROUTER_TIMEOUT_MS", "12000"));
const HF_TIMEOUT_MS = Number(env("HF_TIMEOUT_MS", "4000"));
const HF_WHEN_GEMINI_ENABLED = env("HF_WHEN_GEMINI_ENABLED", "false").trim().toLowerCase() === "true";
const isFreeModel = (model) => {
  const value = String(model || "").trim().toLowerCase();
  return value.endsWith(":free");
};
const OPENROUTER_MODEL = env("OPENROUTER_MODEL", "qwen/qwen3.6-plus:free").trim();
const OPENROUTER_FALLBACK_MODELS_STR = env("OPENROUTER_FALLBACK_MODELS", "mistralai/mistral-7b-instruct:free,mistralai/mistral-small-3.1-24b-instruct:free,meta-llama/llama-3-8b-instruct:free").trim();
const OPENROUTER_FALLBACK_MODELS = OPENROUTER_FALLBACK_MODELS_STR.split(",")
  .map((m) => m.trim())
  .filter(Boolean)
  .filter(isFreeModel);
const HF_FALLBACK_ENABLED = env("HF_FALLBACK_ENABLED", "true").trim().toLowerCase() !== "false";
const AI_SAFE_FALLBACK_ENABLED = env("AI_SAFE_FALLBACK_ENABLED", "false").trim().toLowerCase() === "true";
const AI_ONLY_MODE = env("AI_ONLY_MODE", "true").trim().toLowerCase() !== "false";
const AI_DETERMINISTIC_ENABLED = env("AI_DETERMINISTIC_ENABLED", "false").trim().toLowerCase() === "true";
const APP_TITLE = env("OPENROUTER_APP_TITLE", "NotenPilot").trim();
const HTTP_REFERER = env("OPENROUTER_HTTP_REFERER", "http://localhost:5173").trim();
let geminiBackoffUntilTs = 0;

if (!isFreeModel(OPENROUTER_MODEL)) {
  throw new Error(`Nur Free-Modelle sind erlaubt. Aktuell gesetzt: ${OPENROUTER_MODEL}`);
}

const writeJson = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,x-api-key",
  });
  res.end(JSON.stringify(body));
};

const parseJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const toHistoryMessages = (history = []) =>
  history
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-8)
    .map((m) => ({ role: m.role, content: String(m.text || "") }));

const lastUserPrompt = (history = []) => {
  const items = Array.isArray(history) ? history : [];
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const m = items[i];
    if (m?.role === "user" && String(m?.text || "").trim()) return String(m.text);
  }
  return "";
};

const toIsoDateOrEmpty = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

// ⚠️  WICHTIG: Diese Funktion nutzt EXAKT die Grades vom Frontend.
// Keine Neunormalisierung, keine zusätzliche Filterung —
// dadurch sind Dashboard und AI-JSON immer identisch.
const buildStructuredContextPayload = (context) => {
  const safe = context && typeof context === "object" ? context : {};
  const grades = Array.isArray(safe.grades) ? safe.grades : [];
  const subjects = Array.isArray(safe.subjects) ? safe.subjects.filter(Boolean) : [];

  // ✅ Nutze die Grades exakt wie vom Frontend gesendet
  // Das Frontend-Dashboard nutzt diese gleichen Daten
  // → keine Divergenz möglich
  const weightedSum = grades.reduce((sum, g) => sum + Number(g.grade ?? 0) * Number(g.weight ?? 1), 0);
  const weightSum = grades.reduce((sum, g) => sum + Number(g.weight ?? 1), 0);
  const overallWeightedAverage = weightSum > 0 ? Number((weightedSum / weightSum).toFixed(2)) : null;

  const bySubjectMap = new Map();
  for (const g of grades) {
    const subject = String(g?.subject || "");
    if (!subject) continue;
    if (!bySubjectMap.has(subject)) bySubjectMap.set(subject, []);
    bySubjectMap.get(subject).push(g);
  }

  const bySubject = [...bySubjectMap.entries()]
    .map(([subject, entries]) => {
      const subjectWeightedSum = entries.reduce((sum, x) => sum + Number(x.grade ?? 0) * Number(x.weight ?? 1), 0);
      const subjectWeightSum = entries.reduce((sum, x) => sum + Number(x.weight ?? 1), 0);
      const avg = subjectWeightSum > 0 ? Number((subjectWeightedSum / subjectWeightSum).toFixed(2)) : null;
      return {
        subject,
        count: entries.length,
        avg,
      };
    })
    .filter((s) => s.avg != null)
    .sort((a, b) => Number(a.avg ?? 99) - Number(b.avg ?? 99));

  const recent = [...grades]
    .sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")))
    .slice(0, 12);

  return {
    schemaVersion: "2.1",
    generatedAt: new Date().toISOString(),
    source: "frontend-dashboard",
    totals: {
      gradeCount: grades.length,
      average: overallWeightedAverage,
    },
    bySubject,
    recentGrades: recent,
    grades,
  };
};

const buildSystemPrompt = (context) => {
  const fullContext = context && typeof context === "object" ? context : {};
  const grades = Array.isArray(fullContext.grades) ? fullContext.grades : [];
  const subjects = Array.isArray(fullContext.subjects) ? fullContext.subjects.filter(Boolean) : [];
  const sortedByDate = [...grades].sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")));
  const newest = sortedByDate[0] || null;
  const best = [...grades]
    .filter((g) => Number.isFinite(Number(g?.grade)))
    .sort((a, b) => Number(a?.grade) - Number(b?.grade))[0] || null;

  const gradeLines = sortedByDate.slice(0, 20).map((g, idx) => {
    const s = String(g?.subject || "Unbekannt");
    const n = String(g?.grade ?? "?");
    const t = String(g?.type || "");
    const d = String(g?.date || "");
    return `${idx + 1}) ${s} ${n}${t ? ` (${t})` : ""}${d ? ` am ${d}` : ""}`;
  });

  const structuredJson = JSON.stringify(buildStructuredContextPayload(fullContext), null, 2);

  return [
    "You are an intelligent academic assistant integrated into the platform \"Notenpilot\".",
    "Your goal is to help students understand, analyse, and improve their grades based on their personal data.",
    "",
    "DATA:",
    "Du bekommst ein JSON mit Noten — EXAKT die Daten vom Dashboard.",
    "Jede Note hat:",
    "- grade: die Note (1-6)",
    "- weight: Gewicht der Note (default: 1)",
    "- subject: Fach",
    "- type: Art der Arbeit",
    "- date: Datum (YYYY-MM-DD)",
    "",
    "🔒 WICHTIG: Dieses JSON ist identisch mit dem Dashboard.",
    "   Die 'average' im JSON ist bereits gewichtet berechnet.",
    "   Vertrau den Calculations — sie sind vom Frontend validiert.",
    "- Base all calculations strictly on the provided JSON.",
    "- Never invent grades or assume missing data.",
    "",
    "GRADING SYSTEM:",
    "- German scale: 1=very good (best), 2=good, 3=satisfactory, 4=sufficient, 5=poor, 6=very poor (worst).",
    "- Lower numbers are always better.",
    "",
    "RULES:",
    "1. Always use weighted averages if weights are provided: weighted_average = sum(grade * weight) / sum(weight).",
    "2. For subject-specific analysis, only use that subject's grades with their weights.",
    "3. Identify best and weakest subjects based on weighted averages.",
    "4. Identify subjects with strongest variation (weighted range or weighted std logic).",
    "5. For improvement potential, focus on subjects with highest weighted average.",
    "6. For target-grade questions use: new_average = (current_weighted_sum + new_grade * new_weight) / (current_weight + new_weight).",
    "   If target is impossible, state exactly: 'Mit den aktuellen Noten ist das Ziel nicht erreichbar.'",
    "7. Keep responses short, clear, motivating, max 2-3 short sentences.",
    "8. Format numbers correctly (2.5, never '2. 5').",
    "",
    "OUTPUT FORMAT (when relevant):",
    "1) Current situation (weighted average per subject and overall)",
    "2) Insights (best subject, weakest subject, variation)",
    "3) Predictions/targets (best-case, worst-case, achievable targets)",
    "4) Advice/actionable tip (short and motivating)",
    "",
    "GENERAL TONE:",
    "- Friendly, motivating, short, clear.",
    "- Always provide actionable insight, not just numbers.",
    "- Antwort immer ausschließlich auf Deutsch.",
    "- No greetings, no filler, no markdown, no emojis.",
    "",
    "NEVER:",
    "- Invent data",
    "- Skip calculations",
    "- Give vague or misleading explanations",
    "- Confuse grading scale",
    "- Include app navigation instructions",
    "- Output any English words or English sentences",
    "",
    "USER'S CURRENT DATA:",
    `Available subjects: ${subjects.length ? subjects.join(", ") : "none"}`,
    `Newest grade: ${newest ? `${String(newest.subject || "Unknown")} ${String(newest.grade ?? "?")} on ${String(newest.date || "")}` : "none"}`,
    `Best grade: ${best ? `${String(best.subject || "Unknown")} ${String(best.grade ?? "?")}` : "none"}`,
    `Total grades recorded: ${grades.length}`,
    "All grades (latest on top):",
    ...gradeLines,
    "",
    "STRUCTURED_CONTEXT_JSON (server-normalized):",
    structuredJson,
  ].join("\n");
};

const buildRepairSystemPrompt = (context) =>
  [
    buildSystemPrompt(context),
    "",
    "REPAIR ATTEMPT:",
    "- Previous answer was invalid. Re-answer strictly from provided JSON data.",
    "- For calculations, show the required math correctly and concisely.",
    "- Keep it to 2-3 short sentences.",
    "- Keep decimal formatting correct (2.5, never 2. 5).",
    "- If data is missing, say: 'Dazu fehlen mir Daten.'",
  ].join("\n");

const previewAnswer = (text, maxLen = 140) => {
  const oneLine = String(text || "").replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen - 3)}...`;
};

const toSafeJsonLog = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return "{\"error\":\"payload_not_serializable\"}";
  }
};

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), Math.max(1, Number(ms) || 1))
    ),
  ]);

const normalizeIncomingGrades = (grades) => {
  if (!Array.isArray(grades)) return [];
  return grades
    .map((g) => ({
      grade: Number.isFinite(Number(g?.grade)) ? Number(g.grade) : null,
      weight: Number.isFinite(Number(g?.weight)) && Number(g.weight) > 0 ? Number(g.weight) : 1,
      subject: String(g?.subject || "").trim(),
      type: String(g?.type || "").trim(),
      date: toIsoDateOrEmpty(g?.date),
    }))
    .filter((g) => g.subject && Number.isFinite(g.grade) && g.grade >= 1 && g.grade <= 6);
};

const computeServerAnalysis = (grades, subjects) => {
  const overallAverage = weightedAverage(grades);
  const totalGrades = grades.length;

  const bySubject = new Map();
  for (const g of grades) {
    const subject = String(g?.subject || "").trim();
    if (!subject) continue;
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject).push(g);
  }

  const subjectStats = [...bySubject.entries()]
    .map(([subject, entries]) => ({
      subject,
      avg: weightedAverage(entries),
      count: entries.length,
    }))
    .filter((s) => s.avg != null)
    .sort((a, b) => a.avg - b.avg);

  const validGrades = grades
    .filter((g) => Number.isFinite(Number(g?.grade)))
    .map((g) => ({ ...g, grade: Number(g.grade) }));

  const bestGrade = validGrades.length ? [...validGrades].sort((a, b) => a.grade - b.grade)[0] : null;
  const worstGrade = validGrades.length ? [...validGrades].sort((a, b) => b.grade - a.grade)[0] : null;

  const recent = [...grades]
    .sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")))
    .slice(0, 8);

  return {
    grades,
    subjects,
    average: overallAverage,
    bestSubject: subjectStats[0] || null,
    worstSubject: subjectStats.length > 1 ? subjectStats[subjectStats.length - 1] : subjectStats[0] || null,
    subjectStats,
    recent,
    analysis: {
      overallAverage,
      totalGrades,
      bestGrade,
      worstGrade,
      bestSubject: subjectStats[0] || null,
      worstSubject: subjectStats.length > 1 ? subjectStats[subjectStats.length - 1] : subjectStats[0] || null,
      subjectStats,
    },
  };
};

const buildServerContext = (rawContext) => {
  const ctx = rawContext && typeof rawContext === "object" ? rawContext : {};
  const clientKeys = Object.keys(ctx);
  const allowedKeys = new Set(["grades", "subjects"]);
  const unexpected = clientKeys.filter((k) => !allowedKeys.has(k));
  if (unexpected.length) {
    console.warn(`[AI SECURITY] Client sent derived context fields -> ignored: ${unexpected.join(", ")}`);
  }

  const grades = normalizeIncomingGrades(ctx.grades);
  const subjectsFromClient = Array.isArray(ctx.subjects) ? ctx.subjects.map((s) => String(s || "").trim()).filter(Boolean) : [];
  const inferredSubjects = [...new Set(grades.map((g) => String(g.subject || "").trim()).filter(Boolean))];
  const subjects = [...new Set([...inferredSubjects, ...subjectsFromClient])].sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));

  const computed = computeServerAnalysis(grades, subjects);
  return ensureFirestoreSnapshot(computed);
};

const ensureFirestoreSnapshot = (context) => {
  const base = context && typeof context === "object" ? { ...context } : {};
  const grades = Array.isArray(base.grades) ? base.grades : [];
  const subjects = Array.isArray(base.subjects) ? base.subjects : [];
  base.firestoreSnapshot = {
    grades,
    subjects,
    fetchedAt: new Date().toISOString(),
  };

  return base;
};

const contentToText = (content) => {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        if (typeof part.text === "string") return part.text;
        if (typeof part.content === "string") return part.content;
        return "";
      })
      .join("\n")
      .trim();
    return text;
  }
  return "";
};

const stripMarkdown = (text) =>
  String(text || "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .replace(/^\s*#+\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "- ")
    .trim();

const splitSentences = (text) => {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  // Protect decimal numbers (e.g. 2.5) before sentence splitting.
  const protectedText = normalized.replace(/(\d)\.(\d)/g, "$1§$2");
  const chunks = protectedText.match(/[^.!?\n]+[.!?]?/g) || [];
  return chunks
    .map((s) => s.replace(/§/g, ".").trim())
    .filter(Boolean);
};

const inferGradeFromPrompt = (prompt) => {
  const m = String(prompt || "").match(/(\d+[\.,]?\d*)/);
  if (!m) return null;
  const n = Number(String(m[1]).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(6, n));
};

const parseDateSafe = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const fmtDateDE = (value) => {
  const d = parseDateSafe(value);
  if (!d) return null;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

const inLastDays = (value, days) => {
  const d = parseDateSafe(value);
  if (!d) return false;
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return d >= start && d <= end;
};

const MONTHS = [
  { idx: 1, label: "Januar", aliases: ["januar", "jan"] },
  { idx: 2, label: "Februar", aliases: ["februar", "feb"] },
  { idx: 3, label: "März", aliases: ["maerz", "marz", "märz", "mrz"] },
  { idx: 4, label: "April", aliases: ["april", "apr"] },
  { idx: 5, label: "Mai", aliases: ["mai"] },
  { idx: 6, label: "Juni", aliases: ["juni", "jun"] },
  { idx: 7, label: "Juli", aliases: ["juli", "jul"] },
  { idx: 8, label: "August", aliases: ["august", "aug"] },
  { idx: 9, label: "September", aliases: ["september", "sep", "sept"] },
  { idx: 10, label: "Oktober", aliases: ["oktober", "okt"] },
  { idx: 11, label: "November", aliases: ["november", "nov"] },
  { idx: 12, label: "Dezember", aliases: ["dezember", "dez"] },
];

const inferMonthYearFromPrompt = (prompt) => {
  const raw = String(prompt || "").toLowerCase();
  const p = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("Ã¤", "ae")
    .replaceAll("Ã¶", "oe")
    .replaceAll("Ã¼", "ue")
    .replaceAll("ã¤", "ae")
    .replaceAll("ã¶", "oe")
    .replaceAll("ã¼", "ue")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue");
  const now = new Date();

  for (const m of MONTHS) {
    const found = m.aliases.some((a) => p.includes(a));
    if (!found) continue;
    const yearMatch = p.match(/\b(20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : now.getFullYear();
    return { month: m.idx, monthLabel: m.label, year };
  }

  const fuzzyMatchers = [
    { month: 1, label: "Januar", re: /jan/ },
    { month: 2, label: "Februar", re: /feb/ },
    { month: 3, label: "März", re: /m.{0,3}rz|marz|maerz/ },
    { month: 4, label: "April", re: /apr/ },
    { month: 5, label: "Mai", re: /mai/ },
    { month: 6, label: "Juni", re: /jun[i]?/ },
    { month: 7, label: "Juli", re: /jul[i]?/ },
    { month: 8, label: "August", re: /aug/ },
    { month: 9, label: "September", re: /sept?|sep/ },
    { month: 10, label: "Oktober", re: /okt/ },
    { month: 11, label: "November", re: /nov/ },
    { month: 12, label: "Dezember", re: /dez/ },
  ];
  for (const fm of fuzzyMatchers) {
    if (!fm.re.test(p)) continue;
    const yearMatch = p.match(/\b(20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : now.getFullYear();
    return { month: fm.month, monthLabel: fm.label, year };
  }

  const numeric = p.match(/\b(0?[1-9]|1[0-2])[\.\/-](20\d{2})\b/);
  if (numeric) {
    const month = Number(numeric[1]);
    const year = Number(numeric[2]);
    const monthLabel = MONTHS.find((m) => m.idx === month)?.label || String(month);
    return { month, monthLabel, year };
  }

  return null;
};

const buildMonthAnswer = ({ prompt, context }) => {
  const p = String(prompt || "").toLowerCase();
  if (!(p.includes("im ") || p.includes("in ") || p.includes("monat"))) return null;

  const monthInfo = inferMonthYearFromPrompt(prompt);
  if (!monthInfo) return null;

  const grades = Array.isArray(context?.grades) ? context.grades : [];
  const inMonth = grades
    .filter((g) => {
      const d = parseDateSafe(g?.date);
      return d && d.getMonth() + 1 === monthInfo.month && d.getFullYear() === monthInfo.year;
    })
    .sort((a, b) => String(a?.date || "").localeCompare(String(b?.date || "")));

  if (!inMonth.length) return `Im ${monthInfo.monthLabel} hast du keine Noten eingetragen.`;

  const formatGrade = (value) => {
    const n = toNum(value);
    if (n == null) return "-";
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
  };

  const joinWithUnd = (parts = []) => {
    if (!parts.length) return "";
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} und ${parts[1]}`;
    return `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`;
  };

  const bySubject = new Map();
  for (const g of inMonth) {
    const subject = String(g?.subject || "Fach");
    const grade = toNum(g?.grade);
    if (grade == null) continue;
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject).push(grade);
  }

  const chunks = [...bySubject.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]), "de", { sensitivity: "base" }))
    .map(([subject, subjectGrades]) => {
      const parts = [...subjectGrades].sort((a, b) => a - b).map((n) => `eine ${formatGrade(n)}`);
      return `in ${subject} ${joinWithUnd(parts)} eingetragen`;
    });

  return `Im ${monthInfo.monthLabel} hast du ${joinWithUnd(chunks)}.`;
};

const buildLastWeekAnswer = ({ prompt, context, history }) => {
  const p = normalizedPrompt(prompt);
  const prevUserPrompt = normalizedPrompt(lastUserPrompt(history));
  const asksLastWeek =
    /\bletzt\w*\s+woche\b/.test(p) ||
    /\bvergang\w*\s+woche\b/.test(p) ||
    /\bvergeng\w*\s+woche\b/.test(p) ||
    p.includes("last week");

  const asksDetails = /\bwelche\b|\bwelcher\b|\bwelches\b/.test(p);
  const asksCount = p.includes("wieviel") || p.includes("wie viele") || p.includes("anzahl") || p.includes("wieviele");

  const prevMentionsLastWeek =
    /\bletzt\w*\s+woche\b/.test(prevUserPrompt) ||
    /\bvergang\w*\s+woche\b/.test(prevUserPrompt) ||
    /\bvergeng\w*\s+woche\b/.test(prevUserPrompt) ||
    prevUserPrompt.includes("last week");

  const isFollowUpToLastWeek = !asksLastWeek && (asksDetails || asksCount) && prevMentionsLastWeek;
  if (!asksLastWeek && !isFollowUpToLastWeek) return null;

  const grades = Array.isArray(context?.grades) ? context.grades : [];
  const recent = grades
    .filter((g) => inLastDays(g?.date, 7))
    .sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")));

  if (!recent.length) return "In der vergangenen Woche hast du keine Noten eingetragen.";
  if (asksCount) {
    const noun = recent.length === 1 ? "Note" : "Noten";
    return `In der vergangenen Woche hast du ${recent.length} ${noun} hinzugefuegt.`;
  }

  const formatGrade = (value) => {
    const n = toNum(value);
    if (n == null) return "-";
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
  };

  const joinWithUnd = (parts = []) => {
    if (!parts.length) return "";
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} und ${parts[1]}`;
    return `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`;
  };

  const bySubject = new Map();
  for (const g of recent) {
    const subject = String(g?.subject || "Fach");
    const grade = toNum(g?.grade);
    if (grade == null) continue;
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject).push(grade);
  }

  const subjectChunks = [...bySubject.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]), "de", { sensitivity: "base" }))
    .map(([subject, subjectGrades]) => {
    const sortedGrades = [...subjectGrades].sort((a, b) => a - b);
    const gradeParts = sortedGrades.map((n) => `eine ${formatGrade(n)}`);
    return `in ${subject} ${joinWithUnd(gradeParts)} eingetragen`;
  });

  if (asksDetails || isFollowUpToLastWeek) {
    const detailParts = recent.map((g) => {
      const subject = String(g?.subject || "Fach");
      const grade = formatGrade(g?.grade);
      const when = fmtDateDE(g?.date);
      return when ? `${subject}: ${grade} am ${when}` : `${subject}: ${grade}`;
    });
    return `In der vergangenen Woche waren das ${joinWithUnd(detailParts)}.`;
  }

  return `In der vergangenen Woche hast du ${joinWithUnd(subjectChunks)}.`;
};

const byDateAsc = (grades = []) =>
  [...grades].sort((a, b) => String(a?.date || "").localeCompare(String(b?.date || "")));

const monthKey = (dateValue) => {
  const d = parseDateSafe(dateValue);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabelFromKey = (key) => {
  const m = String(key || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return key;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const label = MONTHS.find((x) => x.idx === month)?.label || String(month);
  return `${label} ${y}`;
};

const groupedMonthAverages = (grades = []) => {
  const map = new Map();
  for (const g of grades) {
    const key = monthKey(g?.date);
    const grade = toNum(g?.grade);
    const weight = toNum(g?.weight) ?? 1;
    if (!key || grade == null || weight <= 0) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ grade, weight });
  }

  const out = [];
  for (const [key, items] of map.entries()) {
    const avg = weightedAverage(items);
    if (avg == null) continue;
    out.push({ key, avg, count: items.length });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
};

const normalizedPrompt = (prompt) =>
  String(prompt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue");

const buildBestWorstMonthAnswer = ({ prompt, context }) => {
  const p = normalizedPrompt(prompt);
  const asksMonthRanking = p.includes("welchem monat") || p.includes("welcher monat") || p.includes("bester monat") || p.includes("schlechtester monat");
  if (!asksMonthRanking) return null;

  const grades = Array.isArray(context?.grades) ? context.grades : [];
  const months = groupedMonthAverages(grades);
  if (!months.length) return "Noch keine Monatsdaten vorhanden.";

  const best = [...months].sort((a, b) => a.avg - b.avg)[0];
  const worst = [...months].sort((a, b) => b.avg - a.avg)[0];

  if (p.includes("schlech")) {
    return `Am schwächsten warst du im ${monthLabelFromKey(worst.key)} mit ${worst.avg.toFixed(2).replace(".", ",")}.`;
  }
  if (p.includes("best") || p.includes("gut")) {
    return `Am besten warst du im ${monthLabelFromKey(best.key)} mit ${best.avg.toFixed(2).replace(".", ",")}.`;
  }
  return `Am besten warst du im ${monthLabelFromKey(best.key)} mit ${best.avg.toFixed(2).replace(".", ",")}; am schwächsten im ${monthLabelFromKey(worst.key)} mit ${worst.avg.toFixed(2).replace(".", ",")}.`;
};

const buildTrendAnswer = ({ prompt, context }) => {
  const p = normalizedPrompt(prompt);
  const asksTrend = p.includes("trend") || p.includes("entwick") || p.includes("besser geworden") || p.includes("schlechter geworden");
  if (!asksTrend) return null;

  const grades = byDateAsc(Array.isArray(context?.grades) ? context.grades : []);
  if (grades.length < 3) return "Für einen Trend brauche ich mindestens 3 Noten.";

  const first = grades.slice(0, Math.ceil(grades.length / 2));
  const second = grades.slice(Math.ceil(grades.length / 2));
  const avgA = weightedAverage(first);
  const avgB = weightedAverage(second);
  if (avgA == null || avgB == null) return "Trend aktuell nicht eindeutig.";

  if (avgB < avgA - 0.08) {
    return `Dein Trend ist besser: von ${avgA.toFixed(2).replace(".", ",")} auf ${avgB.toFixed(2).replace(".", ",")}.`;
  }
  if (avgB > avgA + 0.08) {
    return `Dein Trend ist schlechter: von ${avgA.toFixed(2).replace(".", ",")} auf ${avgB.toFixed(2).replace(".", ",")}.`;
  }
  return `Dein Trend ist stabil bei etwa ${avgB.toFixed(2).replace(".", ",")}.`;
};

const buildHalfYearComparisonAnswer = ({ prompt, context }) => {
  const p = normalizedPrompt(prompt);
  const asksHalfYear = p.includes("erstes halbjahr") || p.includes("zweites halbjahr") || p.includes("halbjahr");
  if (!asksHalfYear) return null;

  const grades = Array.isArray(context?.grades) ? context.grades : [];
  if (!grades.length) return "Keine Noten für Halbjahresvergleich vorhanden.";

  const firstHalf = grades.filter((g) => {
    const d = parseDateSafe(g?.date);
    return d && d.getMonth() + 1 <= 6;
  });
  const secondHalf = grades.filter((g) => {
    const d = parseDateSafe(g?.date);
    return d && d.getMonth() + 1 >= 7;
  });

  const avgA = weightedAverage(firstHalf);
  const avgB = weightedAverage(secondHalf);

  if (avgA == null && avgB == null) return "Keine Noten für Halbjahresvergleich vorhanden.";
  if (avgA == null) return `Nur fürs zweite Halbjahr liegen Daten vor: ${avgB.toFixed(2).replace(".", ",")}.`;
  if (avgB == null) return `Nur fürs erste Halbjahr liegen Daten vor: ${avgA.toFixed(2).replace(".", ",")}.`;

  if (avgB < avgA) return `Im zweiten Halbjahr warst du besser: ${avgA.toFixed(2).replace(".", ",")} -> ${avgB.toFixed(2).replace(".", ",")}.`;
  if (avgB > avgA) return `Im zweiten Halbjahr warst du schwächer: ${avgA.toFixed(2).replace(".", ",")} -> ${avgB.toFixed(2).replace(".", ",")}.`;
  return `Beide Halbjahre sind gleich bei ${avgA.toFixed(2).replace(".", ",")}.`;
};

const buildSubjectStrengthAnswer = ({ prompt, context }) => {
  const p = normalizedPrompt(prompt);
  const asksSubjectComparison = p.includes("welches fach") || p.includes("starkstes fach") || p.includes("schwachstes fach") || p.includes("bestes fach");
  if (!asksSubjectComparison) return null;

  const grades = Array.isArray(context?.grades) ? context.grades : [];
  if (!grades.length) return "Noch keine Fachdaten vorhanden.";

  const map = new Map();
  for (const g of grades) {
    const subject = String(g?.subject || "").trim();
    if (!subject) continue;
    if (!map.has(subject)) map.set(subject, []);
    map.get(subject).push(g);
  }

  const stats = [...map.entries()]
    .map(([subject, entries]) => ({ subject, avg: weightedAverage(entries), count: entries.length }))
    .filter((s) => s.avg != null)
    .sort((a, b) => a.avg - b.avg);

  if (!stats.length) return "Noch keine Fachdaten vorhanden.";
  const best = stats[0];
  const worst = stats[stats.length - 1];

  if (p.includes("schwach") || p.includes("schlecht")) {
    return `Dein schwächstes Fach ist ${worst.subject} mit ${worst.avg.toFixed(2).replace(".", ",")}.`;
  }
  if (p.includes("stark") || p.includes("best")) {
    return `Dein stärkstes Fach ist ${best.subject} mit ${best.avg.toFixed(2).replace(".", ",")}.`;
  }
  return `Stärkstes Fach: ${best.subject} (${best.avg.toFixed(2).replace(".", ",")}); schwächstes Fach: ${worst.subject} (${worst.avg.toFixed(2).replace(".", ",")}).`;
};

const buildWhySubjectWeakerAnswer = ({ prompt, context }) => {
  const p = normalizedPrompt(prompt);
  if (!p.includes("warum")) return null;

  const grades = Array.isArray(context?.grades) ? context.grades : [];
  if (!grades.length) return "Ich kann das noch nicht bewerten, weil keine Noten vorhanden sind.";

  const askedSubject = inferSubjectFromPrompt(prompt, context);
  const targetSubject = askedSubject || context?.worstSubject?.subject || null;
  if (!targetSubject) return null;

  const subjectGrades = grades.filter((g) => String(g?.subject || "") === String(targetSubject));
  if (!subjectGrades.length) {
    return `Zu ${targetSubject} habe ich noch keine Noten, daher kann ich es noch nicht begründen.`;
  }

  const subjectAvg = weightedAverage(subjectGrades);
  const overallAvg = weightedAverage(grades);
  if (subjectAvg == null || overallAvg == null) return null;

  const recent = [...subjectGrades]
    .sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")))
    .slice(0, 3)
    .map((g) => toNum(g?.grade))
    .filter((n) => n != null);

  const recentHint = recent.length
    ? ` Die letzten Noten dort liegen bei ${recent.map((n) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","))).join(", ")}.`
    : "";

  if (subjectAvg > overallAvg) {
    return `${targetSubject} ist aktuell schwächer, weil dein gewichteter Schnitt dort bei ${subjectAvg.toFixed(2).replace(".", ",")} liegt und damit über deinem Gesamtschnitt von ${overallAvg.toFixed(2).replace(".", ",")}.` + recentHint;
  }

  return `${targetSubject} ist aktuell nicht schwächer, weil der gewichtete Schnitt dort bei ${subjectAvg.toFixed(2).replace(".", ",")} liegt und damit nicht über deinem Gesamtschnitt von ${overallAvg.toFixed(2).replace(".", ",")}.` + recentHint;
};

const runDeterministicAnalysis = ({ prompt, context, history }) => {
  const handlers = [
    buildBestNoteAnswer,
    buildLastNoteAnswer,
    buildBestWorstScenarioAnswer,
    buildDeepAnalysisAnswer,
    buildMonthAnswer,
    buildLastWeekAnswer,
    buildBestWorstMonthAnswer,
    buildHalfYearComparisonAnswer,
    buildWhySubjectWeakerAnswer,
    buildTrendAnswer,
    buildSubjectStrengthAnswer,
    buildSimulationAnswer,
  ];

  for (const fn of handlers) {
    const result = fn({ prompt, context, history });
    if (result) {
      return {
        answer: result,
        raw: { deterministic: true },
        model: "deterministic-analysis",
      };
    }
  }

  return null;
};

const weightedAverage = (grades = []) => {
  if (!Array.isArray(grades) || !grades.length) return null;
  let weightedSum = 0;
  let weightSum = 0;
  for (const g of grades) {
    const grade = toNum(g?.grade);
    const weight = toNum(g?.weight) ?? 1;
    if (grade == null || weight <= 0) continue;
    weightedSum += grade * weight;
    weightSum += weight;
  }
  if (!weightSum) return null;
  return Number((weightedSum / weightSum).toFixed(2));
};

const parseExplicitWeight = (prompt) => {
  const p = String(prompt || "").toLowerCase();
  const m = p.match(/(?:x|×|gewicht(?:ung)?)\s*(\d+(?:[\.,]\d+)?)/i);
  if (!m) return null;
  const w = toNum(m[1].replace(",", "."));
  return w != null && w > 0 ? w : null;
};

const levenshtein = (a, b) => {
  const s = String(a || "");
  const t = String(b || "");
  if (!s) return t.length;
  if (!t) return s.length;
  const dp = Array.from({ length: s.length + 1 }, () => new Array(t.length + 1).fill(0));
  for (let i = 0; i <= s.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= t.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= s.length; i += 1) {
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[s.length][t.length];
};

const inferTypeFromPrompt = (prompt, grades = []) => {
  const p = String(prompt || "").toLowerCase();
  const known = new Set([
    "schulaufgabe",
    "kurztest",
    "ausfrage",
    "stegreifaufgabe",
    "kurzarbeit",
    ...grades.map((g) => String(g?.type || "").toLowerCase()).filter(Boolean),
  ]);
  for (const t of known) {
    if (t && p.includes(t)) return t;
  }
  return null;
};

const inferReplacedTypeFromPrompt = (prompt, grades = []) => {
  const p = String(prompt || "").toLowerCase();
  const markers = ["statt", "anstatt", "ersetz", "tausch"];
  if (!markers.some((m) => p.includes(m))) return null;
  const known = [
    "schulaufgabe",
    "kurztest",
    "ausfrage",
    "stegreifaufgabe",
    "kurzarbeit",
    ...grades.map((g) => String(g?.type || "").toLowerCase()).filter(Boolean),
  ];
  for (const t of known) {
    const re = new RegExp(`(?:statt|anstatt)[^\\n]{0,30}${t}`, "i");
    if (re.test(p)) return t;
  }
  return null;
};

const inferSubjectFromPrompt = (prompt, context) => {
  const p = normalizedPrompt(prompt);
  const subjects = [
    ...(Array.isArray(context?.subjects) ? context.subjects : []),
    ...(Array.isArray(context?.grades) ? context.grades.map((g) => g?.subject).filter(Boolean) : []),
  ];
  const uniq = [...new Set(subjects.map((s) => String(s)))].sort((a, b) => b.length - a.length);
  for (const s of uniq) {
    const ss = normalizedPrompt(s);
    if (!ss) continue;
    if (ss.length <= 2) {
      const re = new RegExp(`\\b${ss.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(p)) return s;
      continue;
    }
    if (p.includes(ss)) return s;
  }

  let best = null;
  let bestDist = Infinity;
  const tokens = p.split(/[^a-z0-9]+/i).filter(Boolean);
  for (const s of uniq) {
    const ss = normalizedPrompt(s);
    if (!ss || ss.length < 4) continue;
    for (const tok of tokens) {
      if (tok.length < 4) continue;
      const d = levenshtein(tok, ss);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
  }
  if (best && bestDist <= 2) return best;

  return null;
};

const buildBestNoteAnswer = ({ prompt, context }) => {
  const p = normalizedPrompt(prompt);
  const asks = p.includes("beste note") || p.includes("best note") || p.includes("bester note");
  if (!asks) return null;
  const grades = Array.isArray(context?.grades) ? context.grades : [];
  if (!grades.length) return "Du hast noch keine Noten eingetragen.";

  let best = null;
  for (const g of grades) {
    const n = toNum(g?.grade);
    if (n == null) continue;
    if (!best || n < best.n) best = { n, g };
  }
  if (!best) return "Du hast noch keine gueltigen Noten eingetragen.";
  const dateText = fmtDateDE(best.g?.date);
  const subject = String(best.g?.subject || "Unbekannt");
  const gradeText = Number.isInteger(best.n) ? String(best.n) : best.n.toFixed(1).replace(".", ",");
  return dateText
    ? `Deine beste Note ist ${gradeText} in ${subject} vom ${dateText}.`
    : `Deine beste Note ist ${gradeText} in ${subject}.`;
};

const buildLastNoteAnswer = ({ prompt, context }) => {
  const p = normalizedPrompt(prompt);
  const asks = p.includes("letzte note") || p.includes("letzter note") || p.includes("last note");
  if (!asks) return null;
  const grades = Array.isArray(context?.grades) ? context.grades : [];
  if (!grades.length) return "Du hast noch keine Noten eingetragen.";

  const last = [...grades]
    .filter((g) => parseDateSafe(g?.date))
    .sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")))[0];
  if (!last) return "Du hast noch keine Noten mit Datum eingetragen.";

  const n = toNum(last?.grade);
  const gradeText = n == null ? "-" : (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
  const subject = String(last?.subject || "Unbekannt");
  const dateText = fmtDateDE(last?.date);
  return dateText
    ? `Deine letzte Note ist ${gradeText} in ${subject} vom ${dateText}.`
    : `Deine letzte Note ist ${gradeText} in ${subject}.`;
};

const defaultWeightForType = (type) => {
  if (!type) return 1;
  return String(type).toLowerCase().includes("schulaufgabe") ? 2 : 1;
};

const looksLikeSimulationQuestion = (prompt) => {
  const p = normalizedPrompt(prompt);
  return (
    p.includes("was passiert") ||
    p.includes("wenn ich") ||
    p.includes("wie wirkt") ||
    p.includes("wie verandert") ||
    p.includes("wie aendert") ||
    p.includes("gesamtschnitt")
  );
};

const isReplaceModePrompt = (prompt) => {
  const p = String(prompt || "").toLowerCase();
  return p.includes("statt") || p.includes("anstatt") || p.includes("ersetz") || p.includes("tausch");
};

const buildSimulationAnswer = ({ prompt, context }) => {
  if (!looksLikeSimulationQuestion(prompt)) return null;
  const grades = Array.isArray(context?.grades) ? context.grades : [];
  if (!grades.length) return null;

  const currentAvg = weightedAverage(grades);
  const newGrade = inferGradeFromPrompt(prompt);
  if (newGrade == null) return null;

  const subject = inferSubjectFromPrompt(prompt, context);
  const inferredType = inferTypeFromPrompt(prompt, grades);
  const replacedType = inferReplacedTypeFromPrompt(prompt, grades);
  const explicitWeight = parseExplicitWeight(prompt);
  const type = inferredType || "Leistung";
  const replaceMode = isReplaceModePrompt(prompt);

  let simulated = [...grades];
  if (replaceMode && subject) {
    const candidates = simulated
      .map((g, idx) => ({ g, idx }))
      .filter(({ g }) => {
        if (String(g?.subject || "") !== String(subject)) return false;
        if (!replacedType && !inferredType) return true;
        const targetType = replacedType || inferredType;
        return String(g?.type || "").toLowerCase() === targetType;
      })
      .sort((a, b) => String(b.g?.date || "").localeCompare(String(a.g?.date || "")));

    if (candidates.length) {
      const pick = candidates[0];
      const oldType = String(pick.g?.type || "").toLowerCase();
      const newType = String(type || "").toLowerCase();
      const typeChanged = !!newType && newType !== oldType;
      const replacementWeight = explicitWeight ?? (typeChanged ? defaultWeightForType(type) : (toNum(pick.g?.weight) ?? defaultWeightForType(type)));
      simulated.splice(pick.idx, 1, {
        ...pick.g,
        grade: newGrade,
        weight: replacementWeight,
        type,
      });
    } else {
      const weight = explicitWeight ?? defaultWeightForType(type);
      simulated.push({ grade: newGrade, weight, subject, type });
    }
  } else {
    const weight = explicitWeight ?? defaultWeightForType(type);
    simulated.push({
      grade: newGrade,
      weight,
      subject: subject || "Unbekannt",
      type,
    });
  }

  const newAvg = weightedAverage(simulated);
  if (currentAvg == null || newAvg == null) return null;

  if (newAvg < currentAvg) {
    return `Dein Schnitt wird besser: ${currentAvg.toFixed(2).replace(".", ",")} -> ${newAvg.toFixed(2).replace(".", ",")}.`;
  }
  if (newAvg > currentAvg) {
    return `Dein Schnitt wird schlechter: ${currentAvg.toFixed(2).replace(".", ",")} -> ${newAvg.toFixed(2).replace(".", ",")}.`;
  }
  return `Dein Schnitt bleibt gleich bei ${currentAvg.toFixed(2).replace(".", ",")}.`;
};

const buildBestWorstScenarioAnswer = ({ prompt, context }) => {
  const p = normalizedPrompt(prompt);
  const asksScenario =
    p.includes("best-case") ||
    p.includes("best case") ||
    p.includes("worst-case") ||
    p.includes("worst case") ||
    p.includes("szenario") ||
    (p.includes("best") && p.includes("worst"));
  if (!asksScenario) return null;

  const grades = Array.isArray(context?.grades) ? context.grades : [];
  if (!grades.length) return "Für ein Szenario brauche ich erst vorhandene Noten.";

  let weightedSum = 0;
  let weightSum = 0;
  for (const g of grades) {
    const grade = toNum(g?.grade);
    const weight = toNum(g?.weight) ?? 1;
    if (grade == null || weight <= 0) continue;
    weightedSum += grade * weight;
    weightSum += weight;
  }
  if (!weightSum) return "Für ein Szenario brauche ich verwertbare Gewichtungen.";

  const subject = inferSubjectFromPrompt(prompt, context) || context?.worstSubject?.subject || null;
  const inferredType = inferTypeFromPrompt(prompt, grades);
  const weightFromPrompt = parseExplicitWeight(prompt);
  const scenarioType = inferredType || (p.includes("schulaufgabe") ? "Schulaufgabe" : "Leistung");
  const scenarioWeight = weightFromPrompt ?? defaultWeightForType(scenarioType);

  const bestAvg = (weightedSum + 1 * scenarioWeight) / (weightSum + scenarioWeight);
  const worstAvg = (weightedSum + 6 * scenarioWeight) / (weightSum + scenarioWeight);

  const subjectText = subject ? ` in ${subject}` : "";
  return `Best-Case${subjectText}: mit einer 1${scenarioType ? ` (${scenarioType})` : ""} kommst du auf ${bestAvg.toFixed(2).replace(".", ",")}. Worst-Case${subjectText}: mit einer 6 liegst du bei ${worstAvg.toFixed(2).replace(".", ",")}.`;
};

const buildDeepAnalysisAnswer = ({ prompt, context }) => {
  const p = normalizedPrompt(prompt);
  const asksDeep = p.includes("tiefgrundig") || p.includes("tiefgruendig") || p.includes("detaill") || p.includes("ausfuhrlich") || p.includes("analyse");
  if (!asksDeep) return null;

  const grades = Array.isArray(context?.grades) ? context.grades : [];
  if (!grades.length) return "Für eine tiefere Analyse fehlen noch Noten.";

  const overall = weightedAverage(grades);
  const bySubject = new Map();
  for (const g of grades) {
    const subject = String(g?.subject || "").trim();
    if (!subject) continue;
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject).push(g);
  }

  const stats = [...bySubject.entries()]
    .map(([subject, entries]) => {
      const avg = weightedAverage(entries);
      const vals = entries.map((e) => toNum(e?.grade)).filter((n) => n != null);
      const range = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
      return { subject, avg, range, count: entries.length };
    })
    .filter((s) => s.avg != null)
    .sort((a, b) => a.avg - b.avg);

  if (!stats.length || overall == null) return "Für eine tiefere Analyse fehlen verwertbare Fachdaten.";

  const best = stats[0];
  const worst = stats[stats.length - 1];
  const mostVolatile = [...stats].sort((a, b) => b.range - a.range)[0];
  return `Dein gewichteter Gesamtschnitt liegt bei ${overall.toFixed(2).replace(".", ",")}; am stärksten bist du in ${best.subject} (${best.avg.toFixed(2).replace(".", ",")}) und den größten Hebel hast du in ${worst.subject} (${worst.avg.toFixed(2).replace(".", ",")}). Die stärkste Schwankung zeigt ${mostVolatile.subject} mit einer Noten-Spanne von ${mostVolatile.range.toFixed(1).replace(".", ",")}, daher lohnt sich dort ein klarer Lernfokus.`;
};

const buildTrendOnlyAnswer = ({ prompt, context }) => {
  const p = String(prompt || "").toLowerCase();
  const avg = toNum(context?.average);
  const grade = inferGradeFromPrompt(prompt);

  if (grade != null && avg != null) {
    if (grade < avg) return "Dein Durchschnitt wird besser. Wie stark, hängt vom Gewicht der Note ab.";
    if (grade > avg) return "Dein Durchschnitt wird schlechter. Wie stark, hängt vom Gewicht der Note ab.";
    return "Dein Durchschnitt bleibt etwa gleich. Wie stark, hängt vom Gewicht der Note ab.";
  }

  if (p.includes("was passiert") || p.includes("wenn ich")) {
    return "Die Tendenz hängt vom Gewicht der Note ab.";
  }
  return "Eine genaue Berechnung ist hier nicht eindeutig möglich.";
};

const normalizeAnswer = ({ prompt, answer, context }) => {
  let txt = stripMarkdown(answer)
    .replace(/\bemojis?\b/gi, "")
    .replace(/\bpunkte?n?\b/gi, "")
    .replace(/\b(in den|in der|in diesem|im)\s+(json|kontext)\b/gi, "")
    .replace(/\b(json|kontext|firestore snapshot)\b/gi, "")
    .replace(/\(\s*bullet\s*points?\s*\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Normalize list-like model output into plain sentence flow.
  if (txt.includes("\n") || /^\s*[-*]|^\s*\d+\./m.test(txt)) {
    const parts = txt
      .split(/\r?\n+/)
      .map((line) => line.replace(/^\s*(?:[-*]|\d+\.)\s*/, "").trim())
      .filter(Boolean);
    if (parts.length) {
      txt = parts.map((p) => (/[.!?]$/.test(p) ? p : `${p}.`)).join(" ").trim();
    }
  }

  txt = txt
    .replace(/^\s*\d+\.\s*/, "")
    .replace(/([:\s])\d+\.\s+/g, "$1")
    .trim();

  const p = String(prompt || "").toLowerCase();
  const asksPrediction = p.includes("was passiert") || p.includes("wenn ich") || p.includes("schulaufgabe");
  const mentionsFakeUnit = /\bpunkte?n?\b/i.test(String(answer || ""));

  if (!txt || (asksPrediction && mentionsFakeUnit)) {
    if (AI_ONLY_MODE) return "";
    return buildTrendOnlyAnswer({ prompt, context });
  }

  const sentences = splitSentences(txt).slice(0, 2);
  txt = sentences.join(" ").trim();

  const words = txt.split(/\s+/).filter(Boolean);
  if (words.length > 36) {
    txt = `${words.slice(0, 36).join(" ")}.`;
  }

  if (!txt) {
    if (AI_ONLY_MODE) return "";
    return buildTrendOnlyAnswer({ prompt, context });
  }
  return txt;
};

const looksEnglish = (text) => {
  const t = ` ${String(text || "").toLowerCase().replace(/\s+/g, " ").trim()} `;
  if (!t.trim()) return false;

  const hardMarkers = [
    " based on ",
    " based on the provided data ",
    " in the provided data ",
    " here is ",
    " here are ",
    " analysis of ",
    " cannot determine ",
    " however ",
    " therefore ",
    " this means ",
    " the subject ",
    " highest potential ",
    " improvement is ",
    " your best ",
    " your grade ",
    " if you ",
    " you are ",
    " grade is ",
    " we need to ",
    " the user says ",
    " short, motivating ",
  ];
  if (hardMarkers.some((m) => t.includes(m))) return true;

  const englishWords = [
    "the", "and", "with", "from", "this", "that", "your", "because", "while", "based", "provided", "subject",
    "improvement", "potential", "recorded", "latest", "overall", "result", "analysis", "best", "worst", "you", "are", "is",
    "we", "need", "to", "respond", "user", "says", "short", "motivating", "no", "filler", "greetings",
  ];
  const germanWords = [
    "dein", "deine", "du", "schnitt", "noten", "fach", "gewicht", "verbesserung", "schlechter", "besser", "aktuell", "weil", "mit", "und", "der", "die", "das",
  ];

  const tokens = t.match(/[a-zäöüß]+/g) || [];
  if (!tokens.length) return false;

  let enHits = 0;
  let deHits = 0;
  for (const tok of tokens) {
    if (englishWords.includes(tok)) enHits += 1;
    if (germanWords.includes(tok)) deHits += 1;
  }

  // Reject clearly English answers, but allow short numeric responses like "Schnitt: 2,50".
  const hasGermanChars = /[äöüß]/i.test(t);
  if (enHits >= 4 && enHits >= deHits + 2 && !hasGermanChars) return true;
  return false;
};

const isFalseNoDataClaim = (answer, context) => {
  const grades = Array.isArray(context?.grades) ? context.grades : [];
  if (!grades.length) return false;
  const t = String(answer || "").toLowerCase();
  const markers = [
    "keine angabe",
    "keine daten",
    "nicht genügend information",
    "nicht genug information",
    "cannot determine",
    "does not provide enough information",
    "keine information",
    "kann ich nicht beurteilen",
  ];
  return markers.some((m) => t.includes(m));
};

const isUngroundedAnswer = ({ prompt, answer, context }) => {
  const t = String(answer || "").toLowerCase();
  const p = String(prompt || "").toLowerCase();
  const grades = Array.isArray(context?.grades) ? context.grades : [];
  const subjects = new Set(
    (Array.isArray(context?.subjects) ? context.subjects : [])
      .map((s) => String(s || "").trim().toLowerCase())
      .filter(Boolean)
  );

  if (!t.trim()) return true;

  const genericAppGuidance = ["öffne die app", "oeffne die app", "navigiere", "notenübersicht", "notenuebersicht"];
  if (genericAppGuidance.some((m) => t.includes(m))) return true;

  const fabricatedHistory = ["interview", "mai 2023", "letztes interview", "in den letzten notenpilot-interviews"];
  if (fabricatedHistory.some((m) => t.includes(m))) return true;

  if ((p.includes("alle") || p.includes("zeige") || p.includes("meine noten")) && grades.length) {
    const hasAnySubject = [...subjects].some((s) => t.includes(s));
    const hasAnyGradeNumber = /\b[1-6](?:[\.,]0)?\b/.test(t);
    if (!hasAnySubject || !hasAnyGradeNumber) return true;
  }

  if ((p.includes("neueste note") || p.includes("neuste note") || p.includes("letzte note")) && grades.length) {
    const hasGrade = /\b[1-6](?:[\.,]0)?\b/.test(t);
    if (!hasGrade) return true;
    const newestDate = [...grades]
      .map((g) => String(g?.date || ""))
      .filter(Boolean)
      .sort((a, b) => String(b).localeCompare(String(a)))[0];
    if (newestDate && !t.includes(newestDate.toLowerCase())) return true;
  }

  if ((p.includes("beste note") || p.includes("best note")) && grades.length) {
    const bestGrade = [...grades]
      .map((g) => Number(g?.grade))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)[0];
    if (Number.isFinite(bestGrade)) {
      const bestStr = String(bestGrade).replace(".0", "");
      if (!t.includes(bestStr)) return true;
    }
  }

  if ((p.includes("was passiert") || p.includes("wenn ich")) && /\b6\b/.test(p)) {
    const clearlyPositive = ["wird besser", "beste note", "sehr gut aufgestellt"];
    if (clearlyPositive.some((m) => t.includes(m))) return true;
  }

  const asksTrend = p.includes("trend") || p.includes("entwicklung") || p.includes("fortsetzen") || p.includes("tendenz");
  if (asksTrend && grades.length >= 2) {
    const trendMarkers = ["besser", "schlechter", "verbess", "verschlechter", "gleich", "stabil", "tendenz"];
    if (!trendMarkers.some((m) => t.includes(m))) return true;
    if (t.split(/\s+/).filter(Boolean).length < 8) return true;
  }

  const asksAction = p.includes("was kann ich tun") || p.includes("was soll ich tun") || p.includes("tipps") || p.includes("wie kann ich");
  if (asksAction) {
    const actionMarkers = ["übe", "lernen", "verbess", "fokus", "wiederholung", "aufgaben", "ziel", "plan", "trainiere"];
    if (!actionMarkers.some((m) => t.includes(m))) return true;
    if (t.split(/\s+/).filter(Boolean).length < 8) return true;
  }

  const asksAnalysis = p.includes("analysiere") || p.includes("analyse") || p.includes("notenanalyse");
  if (asksAnalysis && grades.length >= 2) {
    const analysisMarkers = ["schnitt", "durchschnitt", "trend", "stärk", "schwäch", "hebel", "verbesser"];
    if (!analysisMarkers.some((m) => t.includes(m))) return true;
    if (t.includes('"') || t.includes("'") || t.includes("fach \"")) return true;
    if (t.split(/\s+/).filter(Boolean).length > 45) return true;
  }

  return false;
};

const isBrokenAnswer = (answer) => {
  const text = String(answer || "").trim();
  const lower = text.toLowerCase();
  if (!text) return true;
  if (/\([^)]*$/.test(text)) return true;
  if (/[,:;\-]\s*$/.test(text)) return true;
  if (/\([a-zA-ZÄÖÜäöü]$/.test(text)) return true;
  if (/(?:^|\s)(solltest|musst|kannst|würdest|sollte)\.?$/i.test(lower)) return true;
  if (text.split(/\s+/).filter(Boolean).length <= 2) return true;
  if (!/[.!?]$/.test(text) && text.split(/\s+/).filter(Boolean).length < 10) return true;
  return false;
};

const extractAnswerText = (data) => {
  const choice = data?.choices?.[0] || null;
  const fromMessage = contentToText(choice?.message?.content);
  if (fromMessage) return fromMessage;

  const fromText = contentToText(choice?.text);
  if (fromText) return fromText;

  const fromOutputText = contentToText(data?.output_text);
  if (fromOutputText) return fromOutputText;

  const finishReason = (choice?.finish_reason || "").toString();
  if (finishReason === "content_filter") {
    return "Das Modell konnte auf diese Anfrage keine direkte Antwort liefern. Formuliere bitte kurz um.";
  }

  return "Das Modell hat gerade keine Textantwort geliefert. Bitte versuche es erneut.";
};

const buildMessages = ({ prompt, context, history }) => {
  const safeContext = ensureFirestoreSnapshot(context);
  return [
    { role: "system", content: buildSystemPrompt(safeContext || {}) },
    ...toHistoryMessages(history || []),
    { role: "user", content: prompt },
  ];
};

const buildRepairMessages = ({ prompt, context, history }) => {
  const safeContext = ensureFirestoreSnapshot(context);
  return [
    { role: "system", content: buildRepairSystemPrompt(safeContext || {}) },
    ...toHistoryMessages(history || []),
    { role: "user", content: prompt },
  ];
};

const buildGeminiBody = ({ prompt, context, history, mode, repair = false }) => {
  const safeContext = ensureFirestoreSnapshot(context);
  const baseSystem = repair ? buildRepairSystemPrompt(safeContext || {}) : buildSystemPrompt(safeContext || {});
  const past = toHistoryMessages(history || []).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "") }],
  }));

  return {
    systemInstruction: {
      role: "system",
      parts: [{ text: baseSystem }],
    },
    contents: [
      ...past,
      {
        role: "user",
        parts: [{ text: String(prompt || "") }],
      },
    ],
    generationConfig: {
      temperature: mode === "quick" ? 0.2 : 0.25,
      maxOutputTokens: mode === "quick" ? 100 : 160,
    },
  };
};

const extractGeminiAnswerText = (data) => {
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (Array.isArray(parts)) {
    const text = parts
      .map((p) => String(p?.text || ""))
      .join("\n")
      .trim();
    if (text) return text;
  }
  return "";
};

const callGeminiOnce = async ({ prompt, context, history, mode, model = GEMINI_MODEL }) => {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY fehlt. Gemini kann nicht genutzt werden.");
  }

  const requestGemini = async (repair = false) => {
    const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildGeminiBody({ prompt, context, history, mode, repair })),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const answer = normalizeAnswer({
      prompt,
      answer: extractGeminiAnswerText(data),
      context,
    });
    return { data, answer };
  };

  const first = await requestGemini(false);
  let { data, answer } = first;

  if (isUngroundedAnswer({ prompt, answer, context }) || isBrokenAnswer(answer) || looksEnglish(answer)) {
    const repaired = await requestGemini(true);
    data = repaired.data;
    answer = repaired.answer;
  }

  if (!String(answer || "").trim()) {
    throw new Error("Gemini lieferte keine verwertbare Textantwort.");
  }
  if (looksEnglish(answer)) {
    throw new Error("Gemini lieferte keine deutsche Antwort.");
  }
  if (isFalseNoDataClaim(answer, context)) {
    throw new Error("Gemini behauptet fehlende Daten trotz vorhandenem Kontext.");
  }
  if (isUngroundedAnswer({ prompt, answer, context })) {
    throw new Error("Gemini lieferte eine nicht datentreue Antwort.");
  }
  if (isBrokenAnswer(answer)) {
    throw new Error("Gemini lieferte eine unvollständige Antwort.");
  }

  return { answer, raw: data, model, provider: "gemini-api" };
};

const callOpenRouterOnce = async ({ prompt, context, history, mode, model }) => {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY fehlt. Bitte als Umgebungsvariable setzen.");
  }

  if (!isFreeModel(model)) {
    throw new Error(`Nicht erlaubt: ${model}. Erlaubt sind nur Free-Modelle.`);
  }

  const requestOpenRouter = async (messages) => {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": HTTP_REFERER,
        "X-Title": APP_TITLE,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: mode === "quick" ? 0.2 : 0.25,
        max_tokens: mode === "quick" ? 100 : 160,
        stream: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenRouter HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const answer = normalizeAnswer({
      prompt,
      answer: extractAnswerText(data),
      context,
    });
    return { data, answer };
  };

  const first = await requestOpenRouter(buildMessages({ prompt, context, history }));
  let { data, answer } = first;

  if (isUngroundedAnswer({ prompt, answer, context })) {
    const repaired = await requestOpenRouter(buildRepairMessages({ prompt, context, history }));
    data = repaired.data;
    answer = repaired.answer;
  }

  if (isBrokenAnswer(answer)) {
    const repaired = await requestOpenRouter(buildRepairMessages({ prompt, context, history }));
    data = repaired.data;
    answer = repaired.answer;
  }

  if (!String(answer || "").trim()) {
    throw new Error("OpenRouter lieferte keine verwertbare Textantwort.");
  }
  if (looksEnglish(answer)) {
    throw new Error("OpenRouter lieferte keine deutsche Antwort.");
  }
  if (isFalseNoDataClaim(answer, context)) {
    throw new Error("OpenRouter behauptet fehlende Daten trotz vorhandenem Kontext.");
  }
  if (isUngroundedAnswer({ prompt, answer, context })) {
    throw new Error("OpenRouter lieferte eine nicht datentreue Antwort.");
  }
  if (isBrokenAnswer(answer)) {
    throw new Error("OpenRouter lieferte eine unvollständige Antwort.");
  }
  return { answer, raw: data, model };
};

const callHuggingFaceOnce = async ({ prompt, context, history, mode }) => {
  if (!HF_TOKEN) {
    throw new Error("HF_TOKEN fehlt. HuggingFace-Fallback kann nicht genutzt werden.");
  }

  const requestHuggingFace = async (messages) => {
    const res = await fetch(`${HF_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HF_TOKEN}`,
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages,
        temperature: mode === "quick" ? 0.2 : 0.25,
        max_tokens: mode === "quick" ? 100 : 160,
        stream: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HuggingFace HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const answer = normalizeAnswer({
      prompt,
      answer: extractAnswerText(data),
      context,
    });
    return { data, answer };
  };

  const first = await requestHuggingFace(buildMessages({ prompt, context, history }));
  let { data, answer } = first;

  if (isUngroundedAnswer({ prompt, answer, context })) {
    const repaired = await requestHuggingFace(buildRepairMessages({ prompt, context, history }));
    data = repaired.data;
    answer = repaired.answer;
  }

  if (isBrokenAnswer(answer)) {
    const repaired = await requestHuggingFace(buildRepairMessages({ prompt, context, history }));
    data = repaired.data;
    answer = repaired.answer;
  }

  if (!String(answer || "").trim()) {
    throw new Error("HuggingFace lieferte keine verwertbare Textantwort.");
  }
  if (looksEnglish(answer)) {
    throw new Error("HuggingFace lieferte keine deutsche Antwort.");
  }
  if (isFalseNoDataClaim(answer, context)) {
    throw new Error("HuggingFace behauptet fehlende Daten trotz vorhandenem Kontext.");
  }
  if (isUngroundedAnswer({ prompt, answer, context })) {
    throw new Error("HuggingFace lieferte eine nicht datentreue Antwort.");
  }
  if (isBrokenAnswer(answer)) {
    throw new Error("HuggingFace lieferte eine unvollständige Antwort.");
  }
  return { answer, raw: data, model: HF_MODEL, provider: "huggingface-router" };
};

const isNoTextAnswer = (answer) =>
  String(answer || "").toLowerCase().includes("keine textantwort geliefert");

const isLikelyTruncated = (raw, answer) => {
  const choice = raw?.choices?.[0] || {};
  const finishReason = String(choice?.finish_reason || raw?.finish_reason || raw?.native_finish_reason || "").toLowerCase();
  if (finishReason !== "length") return false;
  const text = String(answer || "").trim();
  if (!text) return true;
  if (text.length < 160) return true;
  const endsClean = /[.!?]\s*$/.test(text);
  return !endsClean;
};

const shouldFallbackToHuggingFace = () => true;

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const localFallbackAnswer = ({ prompt, context }) => {
  const p = String(prompt || "").toLowerCase();
  const avg = toNum(context?.average);
  const worst = context?.worstSubject;
  const best = context?.bestSubject;
  const grades = Array.isArray(context?.grades) ? context.grades : [];

  const asksNextGrade =
    p.includes("nächste") ||
    p.includes("naechste") ||
    p.includes("nächste note") ||
    p.includes("naechste note") ||
    p.includes("was könnte") ||
    p.includes("was koennte") ||
    p.includes("prognose");
  if (asksNextGrade) {
    const subject = inferSubjectFromPrompt(prompt, context);
    const subjectGrades = grades
      .filter((g) => {
        if (!subject) return true;
        return String(g?.subject || "").toLowerCase() === String(subject).toLowerCase();
      })
      .filter((g) => Number.isFinite(Number(g?.grade)));

    if (subjectGrades.length >= 2) {
      const ordered = [...subjectGrades].sort((a, b) => String(a?.date || "").localeCompare(String(b?.date || "")));
      const lastTwo = ordered.slice(-2).map((g) => Number(g.grade));
      const trendDelta = lastTwo.length === 2 ? (lastTwo[1] - lastTwo[0]) : 0;
      const avgSubject = weightedAverage(subjectGrades);
      if (avgSubject != null) {
        const estimate = Math.max(1, Math.min(6, Math.round((avgSubject + trendDelta * 0.25) * 10) / 10));
        const low = Math.max(1, Math.floor(estimate));
        const high = Math.min(6, Math.ceil(estimate));
        const subjectText = subject || "diesem Fach";
        if (low === high) {
          return `Für ${subjectText} liegt deine nächste Note voraussichtlich bei etwa ${low}. Realistisch ist ein Bereich von ${Math.max(1, low - 1)} bis ${Math.min(6, low + 1)}.`;
        }
        return `Für ${subjectText} liegt deine nächste Note voraussichtlich zwischen ${low} und ${high}. Mit guter Vorbereitung ist auch eine ${Math.max(1, low - 1)} möglich.`;
      }
    }
  }

  if (p.includes("analysiere") || p.includes("analyse") || p.includes("notenanalyse")) {
    if (!grades.length) return "Ich kann noch keine Notenanalyse erstellen, weil keine Noten vorliegen.";

    const bySubject = new Map();
    for (const g of grades) {
      const subject = String(g?.subject || "").trim();
      if (!subject) continue;
      if (!bySubject.has(subject)) bySubject.set(subject, []);
      bySubject.get(subject).push(g);
    }

    const subjectStats = [...bySubject.entries()]
      .map(([subject, entries]) => ({ subject, avg: weightedAverage(entries) }))
      .filter((s) => s.avg != null)
      .sort((a, b) => a.avg - b.avg);

    const overall = weightedAverage(grades);
    if (!subjectStats.length || overall == null) {
      return `Dein aktueller Schnitt liegt bei ${overall != null ? overall.toFixed(2).replace(".", ",") : "-"}. Für eine fachbezogene Analyse brauche ich mehr verwertbare Noten.`;
    }

    const strongest = subjectStats[0];
    const weakest = subjectStats[subjectStats.length - 1];

    if (strongest.subject === weakest.subject) {
      return `Dein aktueller Schnitt liegt bei ${overall.toFixed(2).replace(".", ",")}. In ${strongest.subject} liegst du bei ${strongest.avg.toFixed(2).replace(".", ",")}; mit regelmäßiger Wiederholung kannst du den Trend verbessern.`;
    }

    return `Dein aktueller Schnitt liegt bei ${overall.toFixed(2).replace(".", ",")}. Stark bist du in ${strongest.subject} (${strongest.avg.toFixed(2).replace(".", ",")}), den größten Hebel hast du in ${weakest.subject} (${weakest.avg.toFixed(2).replace(".", ",")}).`;
  }

  if (p.includes("verbesserungspotenzial") || p.includes("verbesserungspotential") || p.includes("groessten hebel") || p.includes("größten hebel")) {
    if (!grades.length) return "Ich kann noch kein Verbesserungspotenzial berechnen, weil keine Noten vorliegen.";

    const bySubject = new Map();
    for (const g of grades) {
      const subject = String(g?.subject || "").trim();
      if (!subject) continue;
      if (!bySubject.has(subject)) bySubject.set(subject, []);
      bySubject.get(subject).push(g);
    }

    const subjectStats = [...bySubject.entries()]
      .map(([subject, entries]) => ({ subject, avg: weightedAverage(entries) }))
      .filter((s) => s.avg != null)
      .sort((a, b) => a.avg - b.avg);

    if (!subjectStats.length) return "Dafür fehlen mir verwertbare Fachdaten.";
    const weakest = subjectStats[subjectStats.length - 1];
    return `${weakest.subject} hat aktuell das größte Verbesserungspotenzial mit einem gewichteten Schnitt von ${weakest.avg.toFixed(2).replace(".", ",")}. Fokus auf die nächsten Leistungen in ${weakest.subject} bringt dir den größten Effekt.`;
  }

  if (p.includes("was kann ich tun") || p.includes("was soll ich tun") || p.includes("tipps") || p.includes("wie kann ich")) {
    if (worst?.subject) {
      return `Fokussiere dich zuerst auf ${worst.subject}: übe dort regelmäßig kurze Aufgaben und wiederhole Fehler gezielt. Wenn du möchtest, erstelle ich dir dafür einen einfachen Wochenplan.`;
    }
    return "Setze auf regelmäßige Wiederholung, kurze Übungseinheiten und klare Wochenziele. Damit stabilisierst du deinen Trend Schritt für Schritt.";
  }

  if (p.includes("trend") || p.includes("entwicklung") || p.includes("fortsetzen") || p.includes("tendenz")) {
    const ordered = [...grades]
      .filter((g) => Number.isFinite(Number(g?.grade)))
      .sort((a, b) => String(a?.date || "").localeCompare(String(b?.date || "")));
    if (ordered.length >= 2) {
      const first = Number(ordered[0].grade);
      const last = Number(ordered[ordered.length - 1].grade);
      if (last < first) return "Dein Trend ist eher positiv, weil die neueren Noten besser sind als die älteren. Wenn du so weiterlernst, kann sich dein Schnitt weiter verbessern.";
      if (last > first) return "Dein Trend ist aktuell eher negativ, weil die neueren Noten schwächer sind als die älteren. Mit regelmäßigem Üben im schwächsten Fach kannst du das wieder drehen.";
      return "Dein Trend wirkt derzeit stabil ohne klare Verbesserung oder Verschlechterung. Mit gezieltem Training im schwächsten Bereich kannst du ihn nach oben bewegen.";
    }
  }

  if (avg != null && (p.includes("schnitt") || p.includes("durchschnitt"))) {
    return `Schnitt: ${avg.toFixed(2).replace(".", ",")}`;
  }

  if (p.includes("was passiert") || p.includes("wenn ich") || p.includes("schulaufgabe")) {
    return buildTrendOnlyAnswer({ prompt, context });
  }

  const whyAnswer = buildWhySubjectWeakerAnswer({ prompt, context });
  if (whyAnswer) return whyAnswer;

  if ((p.includes("schlecht") || p.includes("schw") || p.includes("verbesser")) && worst?.subject) {
    return `Der größte Hebel liegt aktuell in ${worst.subject}, weil dort dein schwächster gewichteter Schnitt liegt.`;
  }

  if (best?.subject && worst?.subject) {
    return `Aktuell bist du in ${best.subject} am stärksten und in ${worst.subject} am schwächsten.`;
  }

  if (avg != null) {
    return `Schnitt: ${avg.toFixed(2).replace(".", ",")}`;
  }

  return "Zu wenige Notendaten für eine Bewertung.";
};

const callOpenRouter = async ({ prompt, context, history, mode }) => {
  const safeContext = ensureFirestoreSnapshot(context);

  const buildNoSafeFallbackResult = (reason) => {
    return {
      answer: "AI aktuell nicht verfügbar. Versuch’s gleich nochmal.",
      raw: { unavailable: true, reason: String(reason || "unknown") },
      model: "error",
      provider: "error",
    };
  };

  const nowTs = Date.now();
  const geminiInBackoff = geminiBackoffUntilTs > nowTs;

  const providerRunners = [];

  if (GEMINI_API_KEY && !geminiInBackoff) {
    providerRunners.push(
      withTimeout(
        callGeminiOnce({
          prompt,
          context: safeContext,
          history,
          mode,
          model: GEMINI_MODEL,
        }),
        GEMINI_TIMEOUT_MS
      ).catch((err) => {
        const msg = String(err?.message || err || "unknown");
        if (msg.includes("Gemini HTTP 429")) {
          geminiBackoffUntilTs = Date.now() + Math.max(0, GEMINI_429_COOLDOWN_MS || 0);
        }
        console.warn(`[AI ROUTING] Gemini failed -> next (${msg})`);
        throw new Error(`gemini: ${msg}`);
      })
    );
  } else if (GEMINI_API_KEY && geminiInBackoff) {
    const waitSec = Math.max(1, Math.ceil((geminiBackoffUntilTs - nowTs) / 1000));
    console.warn(`[AI ROUTING] Gemini skipped (429 cooldown ${waitSec}s).`);
  }

  providerRunners.push(
    withTimeout(
      (async () => {
        const primary = await callOpenRouterOnce({
          prompt,
          context: safeContext,
          history,
          mode,
          model: OPENROUTER_MODEL,
        });
        if (!isNoTextAnswer(primary.answer)) return { ...primary, provider: "openrouter-proxy" };

        let lastError = new Error("OpenRouter lieferte keine verwertbare Textantwort.");
        for (const fallbackModel of OPENROUTER_FALLBACK_MODELS) {
          if (fallbackModel === OPENROUTER_MODEL) continue;
          try {
            const alt = await callOpenRouterOnce({
              prompt,
              context: safeContext,
              history,
              mode,
              model: fallbackModel,
            });
            if (!isNoTextAnswer(alt.answer)) return { ...alt, provider: "openrouter-proxy" };
          } catch (err) {
            lastError = err;
          }
        }
        throw lastError;
      })(),
      OPENROUTER_TIMEOUT_MS
    ).catch((err) => {
      const msg = String(err?.message || err || "unknown");
      console.warn(`[AI ROUTING] OpenRouter failed -> next (${msg})`);
      throw new Error(`openrouter: ${msg}`);
    })
  );

  const canUseHf = HF_FALLBACK_ENABLED && !!HF_TOKEN && (HF_WHEN_GEMINI_ENABLED || !GEMINI_API_KEY);
  if (canUseHf && shouldFallbackToHuggingFace()) {
    providerRunners.push(
      withTimeout(
        callHuggingFaceOnce({ prompt, context: safeContext, history, mode }),
        HF_TIMEOUT_MS
      ).catch((err) => {
        const msg = String(err?.message || err || "unknown");
        console.warn(`[AI ROUTING] HuggingFace failed -> next (${msg})`);
        throw new Error(`huggingface: ${msg}`);
      })
    );
  }

  if (!providerRunners.length) {
    return buildNoSafeFallbackResult("no provider configured");
  }

  try {
    const fastest = await Promise.any(
      providerRunners.map((p) =>
        p.then((res) => {
          const answer = String(res?.answer || "").trim();
          if (!answer) throw new Error("empty answer");
          return res;
        })
      )
    );
    return fastest;
  } catch (aggregateErr) {
    const reasons = Array.isArray(aggregateErr?.errors)
      ? aggregateErr.errors.map((e) => String(e?.message || e)).join(" | ")
      : String(aggregateErr?.message || aggregateErr || "unknown");
    return buildNoSafeFallbackResult(reasons);
  }
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,x-api-key",
    });
    res.end();
    return;
  }

  if (req.url !== "/ai" || req.method !== "POST") {
    writeJson(res, 404, { error: "Not found" });
    return;
  }

  try {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const payload = parseJson(raw);

    const prompt = String(payload?.prompt || "").trim();
    const mode = payload?.mode === "quick" ? "quick" : "chat";
    if (!prompt) {
      writeJson(res, 400, { error: "prompt fehlt" });
      return;
    }

    const context = buildServerContext(payload?.context);

    const inputLog = {
      mode,
      prompt,
      context,
      history: Array.isArray(payload?.history) ? payload.history : [],
    };
    console.log(`[AI INPUT ${new Date().toISOString()}] ${toSafeJsonLog(inputLog)}`);

    const result = await callOpenRouter({
      prompt,
      context,
      history: payload?.history,
      mode,
    });

    const nowIso = new Date().toISOString();
    console.log(
      `[AI LIVE ${nowIso}] provider=${result.provider || "openrouter-proxy"} model=${result.model || "unknown"} mode=${mode} answer="${previewAnswer(result.answer)}"`
    );

    writeJson(res, 200, {
      answer: result.answer,
      provider: result.provider || "openrouter-proxy",
      model: result.model,
      mode,
    });
  } catch (err) {
    writeJson(res, 500, {
      error: "AI proxy failed",
      detail: String(err?.message || err),
    });
  }
});

server.listen(PORT, () => {
  const geminiMode = GEMINI_API_KEY ? `enabled (${GEMINI_MODEL})` : "disabled";
  const hfMode = HF_FALLBACK_ENABLED && HF_TOKEN ? `enabled (${HF_MODEL})` : "disabled";
  const safeMode = AI_SAFE_FALLBACK_ENABLED ? "enabled" : "disabled";
  console.log(`AI proxy listening on http://localhost:${PORT}/ai (Gemini: ${geminiMode}, OpenRouter free-only, HF fallback: ${hfMode}, Safe fallback: ${safeMode})`);
});






