import { useEffect, useMemo, useRef, useState, memo } from "react";
import { motion } from "framer-motion";
import { useApp } from "../context/index.jsx";
import { C, R } from "../utils/tokens.jsx";
import { Card, SparkBtn } from "../components/ui.jsx";
import { buildAIContext, getAIProvider, getAIStatus, getSuggestions, streamChatAnswer } from "../utils/ai.jsx";
import { consumeUserQuestionQuota, loadUserCloudData } from "../utils/cloudData.js";

const normalizeQ = (q) => String(q || "").trim().toLowerCase();

const AIPage = memo(({
  messages,
  setMessages,
  seedPrompt,
  onSeedConsumed,
  cloudSynced = true,
  askedQuestions = [],
  setAskedQuestions,
  questionsRemaining,
  setQuestionsRemaining,
}) => {
  const { grades, subjects, user } = useApp();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [engineProgress, setEngineProgress] = useState("");
  const listRef = useRef(null);

  const ctx = useMemo(() => buildAIContext(grades, subjects), [grades, subjects]);

  useEffect(() => {
    if (!seedPrompt) return;
    setInput(seedPrompt);
    onSeedConsumed?.();
  }, [seedPrompt, onSeedConsumed]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (forcedPrompt) => {
    const prompt = (forcedPrompt ?? input).trim();
    if (!prompt || sending) return;

    if (user?.uid && !cloudSynced) {
      setMessages((prev) => [...prev, {
        id: `as_${Date.now()}`,
        role: "assistant",
        text: "Bitte kurz warten: Deine Daten werden noch mit der Cloud synchronisiert.",
        ts: Date.now(),
        streaming: false,
        followUps: [],
      }]);
      return;
    }

    const hasAsked = (askedQuestions || []).some((q) => normalizeQ(q) === normalizeQ(prompt));
    const nextAsked = hasAsked ? askedQuestions : [...(askedQuestions || []), prompt];
    setAskedQuestions?.(nextAsked);

    if (user?.uid) {
      try {
        const quota = await consumeUserQuestionQuota(user.uid, 3);
        setQuestionsRemaining?.(quota.remaining);
        if (!quota.allowed) {
          const limitMsg = {
            id: `al_${Date.now()}`,
            role: "assistant",
            text: "Limit erreicht. Du hast heute keine Fragen mehr übrig.",
            ts: Date.now(),
            streaming: false,
            followUps: [],
          };
          setMessages((prev) => [...prev, limitMsg]);
          return;
        }
      } catch {
        // Bei temporärem Quota-Fehler Chat nicht blockieren.
      }
    }

    setSending(true);
    setInput("");

    const userMsg = { id: `u_${Date.now()}`, role: "user", text: prompt, ts: Date.now() };
    const assistantId = `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const assistantMsg = {
      id: assistantId,
      role: "assistant",
      text: "",
      ts: Date.now(),
      streaming: true,
      followUps: [],
      aiProvider: null,
      aiModel: null,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    let runtimeGrades = grades;
    let runtimeSubjects = subjects;
    if (user?.uid) {
      try {
        const remote = await loadUserCloudData(user.uid);
        if (remote) {
          runtimeGrades = Array.isArray(remote.grades) ? remote.grades : grades;
          runtimeSubjects = Array.isArray(remote.subjects) ? remote.subjects : subjects;
        }
      } catch {
        // Keep local in-memory data if cloud read fails.
      }
    }
    const runtimeCtx = buildAIContext(runtimeGrades, runtimeSubjects);

    const provider = getAIProvider();
    const isBackend = provider === "backend" || provider === "proxy" || provider === "appwrite";
    setEngineProgress(isBackend ? "Verbinde mit AI-Backend..." : (getAIStatus() === "ready" ? "" : "Lade lokales AI-Modell..."));
    const history = messages.filter((m) => m.role === "user" || m.role === "assistant");
    for await (const partial of streamChatAnswer(prompt, runtimeCtx, history, (p) => {
      if (isBackend) return;
      const pct = p?.progress != null ? Math.round(p.progress * 100) : null;
      if (pct != null) setEngineProgress(`Lade lokales AI-Modell... ${pct}%`);
    }, (meta) => {
      setMessages((prev) => prev.map((m) => (
        m.id === assistantId
          ? { ...m, aiProvider: meta?.provider || m.aiProvider, aiModel: meta?.model || m.aiModel }
          : m
      )));
    })) {
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, text: partial, streaming: true } : m)));
    }

    setMessages((prev) => prev.map((m) => (
      m.id === assistantId
        ? { ...m, streaming: false, followUps: getSuggestions(runtimeCtx, nextAsked) }
        : m
    )));
    setEngineProgress("");
    setSending(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.t0, letterSpacing: "-0.02em", marginBottom: 3 }}>AI PILOT</h2>
          {!!engineProgress && <p style={{ fontSize: 11, color: C.t2, marginTop: 4 }}>{engineProgress}</p>}
          {Number.isFinite(questionsRemaining) && (
            <p style={{
              marginTop: 6,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color: questionsRemaining > 0 ? C.t1 : C.err,
              background: questionsRemaining > 0 ? C.bg3 : `${C.err}22`,
              border: `1px solid ${questionsRemaining > 0 ? C.line : `${C.err}66`}`,
              borderRadius: R.f,
              padding: "4px 8px",
            }}>
              <span>Noch {questionsRemaining} Frage{questionsRemaining === 1 ? "" : "n"} übrig</span>
            </p>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{
              background: C.bg3,
              border: `1px solid ${C.line}`,
              color: C.t2,
              fontSize: 11,
              borderRadius: R.s,
              padding: "6px 10px",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.target.style.color = C.t0; e.target.style.borderColor = C.acc; }}
            onMouseLeave={(e) => { e.target.style.color = C.t2; e.target.style.borderColor = C.line; }}
          >
            Verlauf löschen
          </button>
        )}
      </div>

      <Card pad="0" style={{ overflow: "hidden" }}>
        <div ref={listRef} style={{ maxHeight: 420, overflowY: "auto", padding: "16px 16px 10px", display: "grid", gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ fontSize: 13, color: C.t2, padding: "8px 4px" }}>
              Starte mit einer Frage wie: "Welche Note habe ich im März in Mathe geschrieben?"
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "82%",
                  borderRadius: R.l,
                  padding: "10px 12px",
                  background: m.role === "user" ? `${C.acc}1f` : C.bg3,
                  border: `1px solid ${m.role === "user" ? `${C.acc}4a` : C.line}`,
                  color: m.role === "user" ? C.t0 : C.t1,
                  fontSize: 13,
                  lineHeight: 1.45,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.text || (m.streaming ? "…" : "")}
                {m.streaming && <span style={{ marginLeft: 6, color: C.accH }}>▍</span>}
                {m.role === "assistant" && !m.streaming && (m.aiProvider || m.aiModel) && (
                  <div style={{
                    marginTop: 7,
                    fontSize: 10,
                    color: C.t2,
                    display: "inline-flex",
                    gap: 7,
                    alignItems: "center",
                    background: C.bg4,
                    border: `1px solid ${C.line}`,
                    borderRadius: R.f,
                    padding: "3px 7px",
                  }}>
                    <span>AI: {m.aiProvider || "unknown"}</span>
                    <span style={{ opacity: 0.75 }}>·</span>
                    <span>{m.aiModel || "unknown"}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {!!messages.length && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.streaming && (
            <div style={{ display: "flex", gap: 8, paddingLeft: 2 }}>
              {messages[messages.length - 1].followUps?.map((f) => (
                <button
                  key={f}
                  onClick={() => send(f)}
                  style={{
                    border: `1px solid ${C.line}`,
                    background: C.bg4,
                    color: C.t1,
                    fontSize: 11,
                    borderRadius: R.f,
                    padding: "5px 10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${C.line}`, padding: 12, display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Frag etwas zu Trends, Daten oder Was-wäre-wenn-Szenarien..."
            style={{
              flex: 1,
              background: C.bg4,
              border: `1px solid ${C.line}`,
              borderRadius: R.s,
              color: C.t0,
              fontSize: 13,
              padding: "10px 12px",
              minHeight: 44,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <SparkBtn onClick={() => send()} disabled={!input.trim() || sending || questionsRemaining === 0}>Senden</SparkBtn>
        </div>
      </Card>
    </motion.div>
  );
});

export default AIPage;
