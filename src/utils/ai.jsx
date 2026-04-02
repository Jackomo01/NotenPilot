import { wAvg } from "./helpers.jsx";

const MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f32_1-MLC";
let enginePromise = null;
let engineStatus = "idle"; // idle | loading | ready | fallback

const AI_ENDPOINT = (import.meta.env.VITE_AI_ENDPOINT || import.meta.env.VITE_APPWRITE_AI_ENDPOINT || "").trim();
const AI_API_KEY = (import.meta.env.VITE_AI_API_KEY || import.meta.env.VITE_APPWRITE_AI_API_KEY || "").trim();
const AI_PROVIDER_ENV = (import.meta.env.VITE_AI_PROVIDER || "").trim().toLowerCase();
const AI_PROVIDER = AI_PROVIDER_ENV || (AI_ENDPOINT ? "backend" : "local");
const AI_ENABLE_LOCAL_ENGINE = (import.meta.env.VITE_AI_ENABLE_LOCAL_ENGINE || "false").trim().toLowerCase() === "true";
const AI_ALLOW_RULE_FALLBACK = (import.meta.env.VITE_AI_ALLOW_RULE_FALLBACK || "false").trim().toLowerCase() === "true";

const toNum = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const isFollowUpPrompt = () => false;

const resolvePromptWithHistory = (prompt, history = []) => {
  if (!isFollowUpPrompt(prompt)) return prompt;
  const prev = [...history]
    .reverse()
    .find((m) => m.role === "user" && !isFollowUpPrompt(m.text || ""));
  if (!prev?.text) return prompt;
  return `${String(prompt || "").trim()}: ${prev.text}`;
};

const findSubjectInPrompt = (prompt, subjects = []) => {
  const p = (prompt || "").toLowerCase();
  const sorted = [...subjects].sort((a, b) => String(b || "").length - String(a || "").length);
  for (const s of sorted) {
    const ss = String(s || "").toLowerCase();
    if (!ss) continue;
    if (ss.length <= 2) {
      const re = new RegExp(`\\b${ss.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(p)) return s;
      continue;
    }
    if (p.includes(ss)) return s;
  }
  return null;
};

const findTypeInPrompt = (prompt, grades = []) => {
  const p = (prompt || "").toLowerCase();
  const types = [...new Set(grades.map((g) => g.type).filter(Boolean))];
  return types.find((t) => p.includes(t.toLowerCase())) || null;
};

const normalizeDate = (raw) => {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

const inLastDays = (raw, days) => {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return d >= start && d <= end;
};

const formatGradeShort = (value) => {
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
    if (!m.aliases.some((a) => p.includes(a))) continue;
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

const findDateInPrompt = (prompt) => {
  const p = String(prompt || "");
  const dot = p.match(/\b(\d{1,2}\.\d{1,2}\.\d{2,4})\b/);
  if (dot) {
    const parts = dot[1].split(".");
    const dd = parts[0].padStart(2, "0");
    const mm = parts[1].padStart(2, "0");
    const yy = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${dd}.${mm}.${yy}`;
  }
  const iso = p.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) {
    const [y, m, d] = iso[1].split("-");
    return `${d}.${m}.${y}`;
  }
  return null;
};

const isGenericOutput = (text = "") => {
  const t = text.toLowerCase();
  if (!t.trim()) return true;
  const genericMarkers = [
    "kurzantwort: dein schnitt",
    "priorität:",
    "stabil halten:",
    "nächster schritt:",
    "naechster schritt:",
  ];
  const hits = genericMarkers.reduce((s, m) => s + (t.includes(m) ? 1 : 0), 0);
  return hits >= 3;
};

export const buildAIContext = (grades = [], subjects = []) => {
  const sorted = [...grades].sort((a, b) => new Date(a.date) - new Date(b.date));
  const average = wAvg(grades);
  const subjectStats = subjects
    .map((s) => {
      const sg = grades.filter((g) => g.subject === s);
      return { subject: s, avg: wAvg(sg), count: sg.length };
    })
    .filter((s) => s.avg != null)
    .sort((a, b) => a.avg - b.avg);

  const recent = [...grades]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

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

export const getSuggestions = (ctx, askedQuestions = []) => {
  const asked = new Set((askedQuestions || []).map((q) => String(q || "").trim().toLowerCase()));
  const worst = ctx?.worstSubject?.subject;
  const best = ctx?.bestSubject?.subject;
  const trend = Number(ctx?.trendSlope || 0);
  const fallbackSubject = worst || best || "Dein Fokusfach";

  const base = [
    `${fallbackSubject}: Wie verbessere ich meine Note in den naechsten 2 Wochen?`,
    trend > 0.08
      ? `Trend fallend: Was ist gerade mein groesster Fehler?`
      : trend < -0.08
        ? `Trend steigend: Wie halte ich den Aufwaertstrend stabil?`
        : "Trend instabil: Welche Gewohnheit bringt schnell Stabilitaet?",
    `${fallbackSubject}: Welche Uebung bringt den groessten Effekt?`,
    best ? `${best}: Wie halte ich mein Niveau konstant?` : "Wie plane ich 2 Lernsessions pro Woche sinnvoll?",
    "Was ist mein realistisches Ziel fuer den naechsten Test?",
  ];

  return base
    .filter((q) => !asked.has(String(q).toLowerCase()))
    .slice(0, 3);
};

export const quickSuggestions = (ctx, askedQuestions = []) => getSuggestions(ctx, askedQuestions);

const parseWeightFromPrompt = (prompt) => {
  const m = String(prompt || "").toLowerCase().match(/(?:x|×|gewicht(?:ung)?)\s*(\d+(?:[\.,]\d+)?)/);
  if (!m) return null;
  const n = toNum(String(m[1]).replace(",", "."));
  return n != null && n > 0 ? n : null;
};

const inferTypeFromPrompt = (prompt, grades = []) => {
  const p = String(prompt || "").toLowerCase();
  const known = [
    "schulaufgabe",
    "kurztest",
    "ausfrage",
    "stegreifaufgabe",
    "kurzarbeit",
    ...grades.map((g) => String(g?.type || "").toLowerCase()).filter(Boolean),
  ];
  return known.find((t) => t && p.includes(t)) || null;
};

const inferReplacedTypeFromPrompt = (prompt, grades = []) => {
  const p = String(prompt || "").toLowerCase();
  if (!(p.includes("statt") || p.includes("anstatt") || p.includes("ersetz") || p.includes("tausch"))) return null;
  const known = [
    "schulaufgabe",
    "kurztest",
    "ausfrage",
    "stegreifaufgabe",
    "kurzarbeit",
    ...grades.map((g) => String(g?.type || "").toLowerCase()).filter(Boolean),
  ];
  return known.find((t) => t && new RegExp(`(?:statt|anstatt)[^\\n]{0,30}${t}`, "i").test(p)) || null;
};

const defaultWeightForType = (type) => (String(type || "").toLowerCase().includes("schulaufgabe") ? 2 : 1);

const isReplaceModePrompt = (prompt) => {
  const p = String(prompt || "").toLowerCase();
  return p.includes("statt") || p.includes("anstatt") || p.includes("ersetz") || p.includes("tausch");
};

const simulateOverallAverage = (ctx, prompt) => {
  const gradeValue = toNum(String(prompt || "").match(/(\d+[\.,]?\d*)/)?.[1] || "");
  if (gradeValue == null) return null;
  const targetGrade = Math.max(1, Math.min(6, gradeValue));
  const targetSubject = findSubjectInPrompt(prompt, ctx.subjects) || ctx.worstSubject?.subject || ctx.subjects[0];
  const type = inferTypeFromPrompt(prompt, ctx.grades) || "Leistung";
  const replacedType = inferReplacedTypeFromPrompt(prompt, ctx.grades);
  const explicitWeight = parseWeightFromPrompt(prompt);
  if (!targetSubject) return null;

  const current = wAvg(ctx.grades);
  const replaceMode = isReplaceModePrompt(prompt);

  const nextGrades = [...ctx.grades];
  if (replaceMode) {
    const candidates = nextGrades
      .map((g, idx) => ({ g, idx }))
      .filter(({ g }) => {
        if (String(g?.subject || "") !== String(targetSubject)) return false;
        const targetType = replacedType || (type && type !== "Leistung" ? type : null);
        if (!targetType) return true;
        return String(g?.type || "").toLowerCase() === String(targetType).toLowerCase();
      })
      .sort((a, b) => String(b.g?.date || "").localeCompare(String(a.g?.date || "")));

    if (candidates.length) {
      const pick = candidates[0];
      const oldType = String(pick.g?.type || "").toLowerCase();
      const newType = String(type || "").toLowerCase();
      const typeChanged = !!newType && newType !== oldType;
      const weight = explicitWeight ?? (typeChanged ? defaultWeightForType(type) : (toNum(pick.g?.weight) ?? defaultWeightForType(type)));
      nextGrades.splice(pick.idx, 1, {
        ...pick.g,
        grade: targetGrade,
        weight,
        type,
      });
    } else {
      const weight = explicitWeight ?? defaultWeightForType(type);
      nextGrades.push({ subject: targetSubject, grade: targetGrade, weight, type });
    }
  } else {
    const weight = explicitWeight ?? defaultWeightForType(type);
    nextGrades.push({ subject: targetSubject, grade: targetGrade, weight, type });
  }

  const next = wAvg(nextGrades);
  if (current == null || next == null) return null;

  return {
    targetGrade,
    targetSubject,
    current,
    next,
  };
};

const quickAskRule = (prompt, ctx, history = []) => {
  const resolvedPrompt = resolvePromptWithHistory(prompt, history);
  const p = (resolvedPrompt || "").toLowerCase();
  if (!ctx.grades.length) return "Du hast noch keine Noten. Trag zuerst welche ein.";

  if (p.includes("letzte woche") || p.includes("letzter woche") || p.includes("last week")) {
    const recent = ctx.grades
      .filter((g) => inLastDays(g?.date, 7))
      .sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")));
    if (!recent.length) return "Letzte Woche keine Noten eingetragen.";

    const bySubject = new Map();
    for (const g of recent) {
      const subject = String(g?.subject || "Fach");
      const grade = toNum(g?.grade);
      if (grade == null) continue;
      if (!bySubject.has(subject)) bySubject.set(subject, []);
      bySubject.get(subject).push(grade);
    }

    const chunks = [...bySubject.entries()]
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]), "de", { sensitivity: "base" }))
      .map(([subject, grades]) => {
      const parts = [...grades].sort((a, b) => a - b).map((n) => `eine ${formatGradeShort(n)}`);
      return `in ${subject} ${joinWithUnd(parts)} eingetragen`;
    });

    return `Letzte Woche hast du ${joinWithUnd(chunks)}.`;
  }

  const monthInfo = inferMonthYearFromPrompt(resolvedPrompt);
  if (monthInfo) {
    const inMonth = ctx.grades
      .filter((g) => {
        const d = new Date(g?.date);
        return !Number.isNaN(d.getTime()) && d.getMonth() + 1 === monthInfo.month && d.getFullYear() === monthInfo.year;
      })
      .sort((a, b) => String(a?.date || "").localeCompare(String(b?.date || "")));
    if (!inMonth.length) return `Im ${monthInfo.monthLabel} hast du keine Noten eingetragen.`;

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
      .map(([subject, grades]) => {
        const parts = [...grades].sort((a, b) => a - b).map((n) => `eine ${formatGradeShort(n)}`);
        return `in ${subject} ${joinWithUnd(parts)} eingetragen`;
      });

    return `Im ${monthInfo.monthLabel} hast du ${joinWithUnd(chunks)}.`;
  }

  const dateInPrompt = findDateInPrompt(resolvedPrompt);
  if (dateInPrompt) {
    const onDate = ctx.grades.filter((g) => normalizeDate(g.date) === dateInPrompt);
    if (!onDate.length) return `Am ${dateInPrompt} keine Noten.`;
    const summary = onDate
      .slice(0, 3)
      .map((g) => `${g.subject} ${Number(g.grade).toFixed(1).replace(".", ",")}`)
      .join("; ");
    return `Am ${dateInPrompt}: ${summary}`;
  }

  const subjectInPrompt = findSubjectInPrompt(resolvedPrompt, ctx.subjects);
  if (subjectInPrompt) {
    const sg = ctx.grades.filter((g) => g.subject === subjectInPrompt);
      if (!sg.length) return `Zu ${subjectInPrompt} keine Daten vorhanden.`;
    const sgAvg = wAvg(sg);
    if (sgAvg != null) {
      return `${subjectInPrompt}: ${sgAvg.toFixed(2).replace(".", ",")}`;
    }
  }

  const typeInPrompt = findTypeInPrompt(resolvedPrompt, ctx.grades);
  if (typeInPrompt) {
    const tg = ctx.grades.filter((g) => g.type === typeInPrompt);
    const tAvg = wAvg(tg);
    if (!tg.length) return `Zu ${typeInPrompt} keine Daten.`;
    return `${typeInPrompt}: ${tAvg?.toFixed(2).replace(".", ",") || "-"}`;
  }


  if (p.includes("durchschnitt") || p.includes("schnitt")) {
    return `Schnitt: ${ctx.average?.toFixed(2).replace(".", ",") || "-"}`;
  }

  if (p.includes("schlech") || p.includes("schwäch")) {
    if (!ctx.worstSubject) return "Zu wenig Daten.";
    return `Dein schwächstes Fach ist aktuell ${ctx.worstSubject.subject} mit einem Schnitt von ${ctx.worstSubject.avg.toFixed(2).replace(".", ",")}.`;
  }

  if (p.includes("best")) {
    if (!ctx.bestSubject) return "Zu wenig Daten.";
    return `Dein stärkstes Fach ist aktuell ${ctx.bestSubject.subject} mit einem Schnitt von ${ctx.bestSubject.avg.toFixed(2).replace(".", ",")}.`;
  }

  if (p.includes("was passiert") || p.includes("wenn ich")) {
    const sim = simulateOverallAverage(ctx, resolvedPrompt);
    if (!sim) return "Nicht genug Daten für Simulation.";
    if (sim.next < sim.current) {
      return `Schnitt besser: ${sim.current.toFixed(2).replace(".", ",")} -> ${sim.next.toFixed(2).replace(".", ",")}`;
    }
    if (sim.next > sim.current) {
      return `Schnitt schlechter: ${sim.current.toFixed(2).replace(".", ",")} -> ${sim.next.toFixed(2).replace(".", ",")}`;
    }
    return `Schnitt unverändert: ${sim.current.toFixed(2).replace(".", ",")}`;
  }

  if (p.includes("verbesser") || p.includes("besser")) {
    if (!ctx.worstSubject) return "Zu wenig Daten.";
    return `Wenn du dich verbessern willst, solltest du zuerst ${ctx.worstSubject.subject} angehen, weil dort aktuell dein größter Hebel liegt.`;
  }

  if (p.includes("begründ") || p.includes("wieso")) {
    const subjectInPrompt = findSubjectInPrompt(resolvedPrompt, ctx.subjects);
    const target = subjectInPrompt || ctx.worstSubject?.subject;
    if (!target) return "Zu wenig Daten.";
    const sg = ctx.grades.filter((g) => g.subject === target);
    const sgAvg = wAvg(sg);
    if (sgAvg == null || ctx.average == null) return `Zu ${target} fehlen noch genug Daten für eine klare Begründung.`;
    if (sgAvg > ctx.average) {
      return `${target} wirkt schwächer, weil dein Schnitt dort bei ${sgAvg.toFixed(2).replace(".", ",")} liegt und damit über deinem Gesamtschnitt von ${ctx.average.toFixed(2).replace(".", ",")}.`;
    }
    return `${target} ist aktuell nicht schwächer, weil der Schnitt dort bei ${sgAvg.toFixed(2).replace(".", ",")} liegt und damit nicht über deinem Gesamtschnitt von ${ctx.average.toFixed(2).replace(".", ",")}.`;
  }

  if (p.includes("nächster schritt") || p.includes("empfehlung") || p.includes("tipps")) {
    if (!ctx.worstSubject) return "Trag zuerst Noten ein.";
    return `Ein sinnvoller Start ist ${ctx.worstSubject.subject}: plane dort zwei kurze Lerneinheiten pro Woche und prüfe nach jeder Note, ob sich dein Schnitt verbessert.`;
  }

  return `Schnitt: ${ctx.average?.toFixed(2).replace(".", ",") || "-"}`;
};

const chatAnswerRule = (prompt, ctx, history = []) => {
  const intro = quickAskRule(prompt, ctx, history);
  const resolvedPrompt = resolvePromptWithHistory(prompt, history);
  const p = (resolvedPrompt || "").toLowerCase();
  return intro;
};

const canUseWebGPU = () => typeof navigator !== "undefined" && !!navigator.gpu;

const buildLLMMessages = (prompt, ctx, history = []) => {
  const compactCtx = {
    average: ctx.average,
    bestSubject: ctx.bestSubject,
    worstSubject: ctx.worstSubject,
    subjectStats: ctx.subjectStats,
    recent: ctx.recent,
  };

  const system = {
    role: "system",
    content:
      "Du bist ein Lernassistent in einer Schueler-App. Antworte auf Deutsch, kurz und klar. Maximal 3 Stichpunkte oder 2 kurze Saetze. Keine Markdown-Formatierung (kein **, *, Emojis). Keine unnuetigen Einleitungen oder Wiederholungen. Beantworte nur die aktuelle Frage. Gib nur relevante Informationen. Kontext JSON: " +
      JSON.stringify(compactCtx),
  };

  const trimmedHistory = history
    .slice(-8)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.text || "" }));

  return [system, ...trimmedHistory, { role: "user", content: prompt }];
};

const backendProviderSelected = () => ["appwrite", "backend", "proxy"].includes(AI_PROVIDER);
// If an endpoint exists, always prefer backend over local WebLLM.
const useBackendAI = () => !!AI_ENDPOINT && (backendProviderSelected() || AI_PROVIDER === "local");
const backendOnlyMode = () => backendProviderSelected() || !!AI_ENDPOINT;
// Local WebLLM is opt-in only to avoid accidental WebGPU errors in backend setups.
const allowLocalEngine = () => AI_ENABLE_LOCAL_ENGINE && AI_PROVIDER === "local" && !AI_ENDPOINT;
const realAiUnavailableText = () =>
  "Echte AI ist gerade nicht verfügbar. Bitte aktiviere WebGPU im Browser oder konfiguriere einen AI-Provider.";
const backendUnavailableText = (err) => {
  const detail = String(err?.message || "").replace(/^Backend AI HTTP \d+:\s*/i, "").trim();
  return detail
    ? `Backend AI nicht verfügbar: ${detail}`
    : "Backend AI nicht verfügbar. Bitte Proxy/API-Key prüfen.";
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
  history: history
    .slice(-8)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, text: m.text || "" })),
});

const requestBackendAI = async (payload) => {
  if (!useBackendAI()) return null;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const headers = {
    "Content-Type": "application/json",
  };
  if (AI_API_KEY) headers["x-api-key"] = AI_API_KEY;

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Backend AI HTTP ${res.status}: ${txt.slice(0, 400)}`);
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        const answer = (data?.answer || data?.text || data?.response || "").toString().trim();
        if (!answer) throw new Error("Backend AI lieferte leere Antwort.");
        return {
          answer,
          provider: (data?.provider || "backend").toString(),
          model: (data?.model || "unknown").toString(),
        };
      }

      const txt = (await res.text()).trim();
      if (!txt) throw new Error("Backend AI lieferte leere Textantwort.");
      return {
        answer: txt,
        provider: "backend",
        model: "unknown",
      };
    } catch (err) {
      lastError = err;
      const msg = String(err?.message || "").toLowerCase();
      const retriable = msg.includes("networkerror") || msg.includes("failed to fetch") || msg.includes("timeout") || msg.includes("backend ai lieferte leere");
      if (!retriable || attempt === 3) break;
      await wait(220 * attempt);
    }
  }
  throw lastError || new Error("Backend AI request failed.");
};

const ensureEngine = async (onProgress) => {
  if (!canUseWebGPU()) {
    engineStatus = "fallback";
    return null;
  }

  if (!enginePromise) {
    engineStatus = "loading";
    enginePromise = (async () => {
      const webllm = await import("@mlc-ai/web-llm");
      const createEngine = webllm.CreateMLCEngine || webllm.CreateWebWorkerMLCEngine;
      if (!createEngine) throw new Error("WebLLM Engine API nicht gefunden");

      const engine = await createEngine(MODEL_ID, {
        initProgressCallback: (p) => onProgress?.(p),
      });
      engineStatus = "ready";
      return engine;
    })().catch((err) => {
      engineStatus = "fallback";
      console.error("WebLLM init failed, fallback enabled:", err);
      return null;
    });
  }

  const engine = await enginePromise;
  return engine;
};

export const getAIStatus = () => engineStatus;
export const getAIProvider = () => AI_PROVIDER;

export const quickAskDetailed = async (prompt, ctx, onProgress, history = []) => {
  try {
    if (useBackendAI()) {
      const backend = await requestBackendAI(buildBackendPayload(prompt, ctx, history, "quick"));
      if (backend?.answer) return backend;
      return {
        answer: "Backend AI hat leer geantwortet. Bitte erneut versuchen.",
        provider: "backend",
        model: "unknown",
      };
    }

    return {
      answer: "AI-Backend erforderlich. Bitte Proxy/Endpoint prüfen.",
      provider: "none",
      model: "none",
    };
  } catch (err) {
    console.error("quickAsk AI failed, fallback used:", err);
    return {
      answer: backendUnavailableText(err),
      provider: "error",
      model: "error",
    };
  }
};

export const quickAsk = async (prompt, ctx, onProgress, history = []) => {
  const result = await quickAskDetailed(prompt, ctx, onProgress, history);
  return result.answer;
};

export async function* streamChatAnswer(prompt, ctx, history = [], onProgress, onMeta) {
  const resolvedPrompt = resolvePromptWithHistory(prompt, history);

  const streamWords = async function* (text, delay) {
    const words = String(text || "").split(" ");
    let acc = "";
    for (const w of words) {
      acc = acc ? `${acc} ${w}` : w;
      yield acc;
      await new Promise((r) => setTimeout(r, delay));
    }
  };

  try {
    if (useBackendAI()) {
      const backend = await requestBackendAI(buildBackendPayload(resolvedPrompt, ctx, history, "chat"));
      if (backend?.answer) {
        onMeta?.({ provider: backend.provider, model: backend.model });
        for await (const chunk of streamWords(backend.answer, 8)) yield chunk;
        return;
      }
      for await (const chunk of streamWords("Backend AI hat leer geantwortet. Bitte erneut versuchen.", 12)) yield chunk;
      return;
    }

    for await (const chunk of streamWords("AI-Backend erforderlich. Bitte Proxy/Endpoint prüfen.", 12)) yield chunk;
    return;
  } catch (err) {
    console.error("chat streaming AI failed, fallback used:", err);
    for await (const chunk of streamWords(backendUnavailableText(err), 14)) yield chunk;
  }
}

export const dashboardInsight = (ctx) => {
  if (!ctx.grades.length) return "Noch keine Trenddaten: Trage weitere Noten ein, dann folgt eine Prognose mit Handlungsempfehlung.";

  const trend = Number(ctx.trendSlope || 0);
  const trendText = trend < -0.08
    ? "Trend: steigend"
    : trend > 0.08
      ? "Trend: fallend"
      : "Trend: instabil";

  const prediction = trend < -0.08
    ? "Wenn du so weitermachst, stabilisieren sich die naechsten Ergebnisse auf besserem Niveau."
    : trend > 0.08
      ? "Wenn das so weiterlaeuft, drohen in den naechsten Arbeiten schwaechere Ergebnisse."
      : "Wenn du nichts aenderst, bleibt die Leistung voraussichtlich schwankend.";

  const advice = trend > 0.08
    ? "Empfehlung: Setze diese Woche zwei kurze Lerneinheiten direkt vor den naechsten Leistungserhebungen."
    : "Empfehlung: Halte deinen Rhythmus bei und plane feste Wiederholungsfenster nach jeder neuen Note.";

  return `${trendText}. ${prediction} ${advice}`;
};
