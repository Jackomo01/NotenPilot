const json = (res, body, status = 200) => res.json(body, status);

const parsePayload = (req) => {
  if (typeof req.body === "object" && req.body) return req.body;
  const raw = req.bodyRaw || req.body || "{}";
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

const buildSystemPrompt = (context) => {
  const compact = {
    average: context?.average ?? null,
    bestSubject: context?.bestSubject ?? null,
    worstSubject: context?.worstSubject ?? null,
    subjectStats: context?.subjectStats ?? [],
    recent: context?.recent ?? [],
    grades: context?.grades ?? [],
    subjects: context?.subjects ?? [],
  };

  return [
    "Du bist der AI-Lerncoach von Notenpilot.",
    "Antworte auf Deutsch, locker und klar.",
    "Kurz, konkret, maximal 6 Zeilen.",
    "Nutze Bulletpoints wenn sinnvoll.",
    "Keine generischen Phrasen, direkt auf den Datenkontext eingehen.",
    `Kontext JSON: ${JSON.stringify(compact)}`,
  ].join(" ");
};

const requestLLM = async ({ messages, mode }) => {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
  const model = process.env.LLM_MODEL || "nvidia/nemotron-3-super-120b-a12b:free";

  if (!apiKey) {
    throw new Error("LLM_API_KEY fehlt in den Function-Umgebungsvariablen.");
  }

  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.LLM_HTTP_REFERER || "https://notenpilot.local",
      "X-Title": process.env.LLM_APP_TITLE || "Notenpilot",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: mode === "quick" ? 0.35 : 0.45,
      max_tokens: mode === "quick" ? 220 : 420,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`LLM Fehler ${res.status}: ${txt.slice(0, 400)}`);
  }

  const data = await res.json();
  const answer = data?.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("Leere LLM-Antwort.");
  return answer;
};

export default async ({ req, res, log, error }) => {
  try {
    if (req.method && req.method !== "POST") {
      return json(res, { error: "Method not allowed" }, 405);
    }

    const payload = parsePayload(req);
    const prompt = String(payload?.prompt || "").trim();
    const mode = payload?.mode === "quick" ? "quick" : "chat";

    if (!prompt) {
      return json(res, { error: "prompt fehlt" }, 400);
    }

    const system = buildSystemPrompt(payload?.context || {});
    const history = toHistoryMessages(payload?.history || []);
    const messages = [
      { role: "system", content: system },
      ...history,
      { role: "user", content: prompt },
    ];

    const answer = await requestLLM({ messages, mode });

    return json(res, {
      answer,
      provider: "appwrite-function",
      mode,
      model: process.env.LLM_MODEL || "nvidia/nemotron-3-super-120b-a12b:free",
    });
  } catch (e) {
    error?.(e?.stack || String(e));
    log?.(String(e?.message || e));
    return json(res, {
      error: "AI backend failed",
      detail: String(e?.message || e),
    }, 500);
  }
};
