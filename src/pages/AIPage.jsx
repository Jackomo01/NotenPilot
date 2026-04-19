import { useEffect, useMemo, useRef, useState, memo } from "react";
import { motion } from "framer-motion";
import { useApp } from "../context/index.jsx";
import { C, R } from "../utils/tokens.jsx";
import { Card, SparkBtn } from "../components/ui.jsx";
import { AI_REQUEST_COOLDOWN_MS, buildAIContext, getAIProvider, getSuggestions, isOpenRouterOnlyEnabled, streamChatAnswer, waitForAICooldown } from "../utils/ai.jsx";
import { consumeUserQuestionQuota, DAILY_AI_PILOT_QUESTIONS, loadUserCloudData } from "../utils/cloudData.js";

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
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const listRef = useRef(null);
  const cooldownTimerRef = useRef(null);

  const ctx = useMemo(() => buildAIContext(grades, subjects), [grades, subjects]);

  useEffect(() => {
    if (!seedPrompt) return;
    setInput(seedPrompt);
    onSeedConsumed?.();
  }, [seedPrompt, onSeedConsumed]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!cooldownRemainingMs) return undefined;
    cooldownTimerRef.current = window.setInterval(() => {
      setCooldownRemainingMs((current) => Math.max(0, current - 250));
    }, 250);
    return () => {
      if (cooldownTimerRef.current) window.clearInterval(cooldownTimerRef.current);
    };
  }, [cooldownRemainingMs]);

  const send = async (forcedPrompt) => {
    const prompt = (forcedPrompt ?? input).trim();
    if (!prompt || sending || cooldownRemainingMs > 0) return;

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
        const quota = await consumeUserQuestionQuota(user.uid, DAILY_AI_PILOT_QUESTIONS);
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
    setCooldownRemainingMs(AI_REQUEST_COOLDOWN_MS);

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

    await waitForAICooldown("ai-page");

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
    const isBackend = provider !== "none";
    setEngineProgress(isBackend ? "Verbinde mit AI-Backend..." : "AI-Backend nicht konfiguriert.");
    const history = messages.filter((m) => m.role === "user" || m.role === "assistant");
    for await (const partial of streamChatAnswer(prompt, runtimeCtx, history, undefined, (meta) => {
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        display: "grid",
        gap: 16,
        background: `linear-gradient(180deg, ${C.bg4} 0%, ${C.bg3} 100%)`,
        border: `1px solid ${C.acc}55`,
        borderRadius: R.xl,
        padding: 14,
        boxShadow: "0 24px 60px rgba(0,0,0,0.42), 0 0 0 1px rgba(91,110,240,0.16)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          border: `1px solid ${C.line}`,
          borderRadius: R.l,
          background: C.bg3,
          padding: "10px 12px",
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.t0, letterSpacing: "-0.02em", marginBottom: 3 }}>AI PILOT</h2>
          {isOpenRouterOnlyEnabled() && (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
              fontSize: 10,
              fontWeight: 700,
              color: C.acc,
              background: `${C.acc}18`,
              border: `1px solid ${C.acc}30`,
              borderRadius: R.f,
              padding: "3px 8px",
            }}>
              Nur OpenRouter aktiv
            </div>
          )}
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

      <Card pad="0" style={{ overflow: "hidden", borderRadius: R.l, border: `1px solid ${C.lineH}` }}>
        <div ref={listRef} style={{ maxHeight: 420, overflowY: "auto", padding: "16px 16px 10px", display: "grid", gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ display: "grid", gap: 10, padding: "8px 4px" }}>
              {[1,2,3].map((i) => (
                <div key={i} style={{ height: 18, borderRadius: 999, background: `linear-gradient(90deg, ${C.bg4} 25%, ${C.line} 50%, ${C.bg4} 75%)`, backgroundSize: "200% 100%", animation: "sk 1.2s ease-in-out infinite" }} />
              ))}
              <div style={{ fontSize: 13, color: C.t2 }}>
                Starte mit einer Frage wie: "Welche Note habe ich im März in Mathe geschrieben?"
              </div>
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
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
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

          {sending && (
            <div style={{ display: "grid", gap: 8, padding: "2px 0 0" }}>
              {[1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 14,
                    width: i === 1 ? "72%" : "56%",
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${C.bg4} 25%, ${C.line} 50%, ${C.bg4} 75%)`,
                    backgroundSize: "200% 100%",
                    animation: "sk 1.2s ease-in-out infinite",
                  }}
                />
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
          <SparkBtn onClick={() => send()} disabled={!input.trim() || sending || questionsRemaining === 0 || cooldownRemainingMs > 0}>
            {cooldownRemainingMs > 0 ? `Warte ${Math.ceil(cooldownRemainingMs / 1000)}s` : "Senden"}
          </SparkBtn>
        </div>
      </Card>
    </motion.div>
  );
});

export default AIPage;
