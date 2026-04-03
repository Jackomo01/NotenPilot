import { useEffect, useMemo, useRef, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLS } from "../hooks/index.jsx";
import { buildAIContext, getSuggestions, streamChatAnswer } from "../utils/ai.jsx";
import { consumeUserQuestionQuota, loadUserCloudData } from "../utils/cloudData.js";
import { C, R } from "../utils/tokens.jsx";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const buildSparklinePath = (grades = [], width = 78, height = 22) => {
  const sorted = [...grades]
    .filter((g) => Number.isFinite(Number(g?.grade)))
    .sort((a, b) => new Date(a?.date || 0) - new Date(b?.date || 0))
    .slice(-8);

  if (sorted.length < 2) return "";

  const minX = 2;
  const maxX = width - 2;
  const minY = 2;
  const maxY = height - 2;
  const step = (maxX - minX) / (sorted.length - 1);

  const points = sorted.map((g, i) => {
    const grade = Math.max(1, Math.min(6, Number(g.grade)));
    const y = minY + ((grade - 1) / 5) * (maxY - minY);
    const x = minX + step * i;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return `M ${points.join(" L ")}`;
};

const normalizeQ = (q) => String(q || "").trim().toLowerCase();

const AIMascotDrawer = memo(({
  grades,
  subjects,
  user,
  cloudSynced = true,
  messages,
  setMessages,
  askedQuestions = [],
  setAskedQuestions,
  questionsRemaining,
  setQuestionsRemaining,
  onOpenFullChat,
}) => {
  const [open, setOpen] = useLS("np6_ai_widget_open", false);
  const [panelPos, setPanelPos] = useLS("np6_ai_widget_panel_pos", { x: 0, y: 0 });
  const [iconPos, setIconPos] = useLS("np6_ai_widget_icon_pos", { x: 0, y: 0 });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [hasUnread, setHasUnread] = useLS("np6_ai_widget_unread", false);
  const [panelDragging, setPanelDragging] = useState(false);
  const [buttonDragging, setButtonDragging] = useState(false);
  const dragStartRef = useRef(null);
  const dragMovedRef = useRef(false);
  const listRef = useRef(null);

  const liveContext = useMemo(() => buildAIContext(grades, subjects), [grades, subjects]);

  useEffect(() => {
    if (!open) return;
    setHasUnread(false);
  }, [open, setHasUnread]);

  useEffect(() => {
    if (!setAskedQuestions) return;
    setAskedQuestions([]);
  }, [user?.uid, setAskedQuestions]);

  const currentSuggestions = useMemo(() => getSuggestions(liveContext, askedQuestions), [liveContext, askedQuestions]);
  const sparklinePath = useMemo(() => buildSparklinePath(liveContext?.grades || []), [liveContext?.grades]);
  const trendMeta = useMemo(() => {
    const slope = Number(liveContext?.trendSlope || 0);
    if (slope < -0.08) return { label: "Trend steigend", arrow: "↗", color: C.g1 };
    if (slope > 0.08) return { label: "Trend fallend", arrow: "↘", color: C.err };
    return { label: "Trend instabil", arrow: "→", color: C.wrn };
  }, [liveContext?.trendSlope]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (!open && last.role === "assistant" && !last.streaming) setHasUnread(true);
  }, [messages, open, setHasUnread]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: window.innerWidth <= 768 ? "auto" : "smooth" });
    });
  }, [messages, open]);

  const send = async (forcedPrompt) => {
    const prompt = String(forcedPrompt ?? input).trim();
    if (!prompt || sending) return;

    if (user?.uid && !cloudSynced) {
      setMessages((prev) => [...prev, {
        id: `ws_${Date.now()}`,
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
            id: `wl_${Date.now()}`,
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
        // On quota read/write failure, proceed to avoid blocking core chat.
      }
    }

    setSending(true);
    setInput("");

    const userMsg = { id: `wu_${Date.now()}`, role: "user", text: prompt, ts: Date.now() };
    const assistantId = `wa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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
        // Use local state if cloud read fails.
      }
    }

    const runtimeCtx = buildAIContext(runtimeGrades, runtimeSubjects);

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
        ? { 
            ...m, 
            streaming: false, 
            followUps: getSuggestions(runtimeCtx, nextAsked)
          }
        : m
    )));

    setSending(false);
  };

  // Button drag handlers
  const startButtonDrag = (e) => {
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: iconPos.x,
      offsetY: iconPos.y,
    };
    dragMovedRef.current = false;
    setButtonDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onButtonDragMove = (e) => {
    if (!buttonDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMovedRef.current = true;

    const maxLeft = Math.max(0, window.innerWidth - 56);
    const maxUp = Math.max(0, window.innerHeight - 56);

    setIconPos({
      x: clamp(dragStartRef.current.offsetX + dx, -maxLeft, 0),
      y: clamp(dragStartRef.current.offsetY + dy, -maxUp, 0),
    });
  };

  const endButtonDrag = (e) => {
    setButtonDragging(false);
    dragStartRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  // Panel drag handlers
  const startPanelDrag = (e) => {
    if (e.target.closest("input") || e.target.closest("button")) return;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: panelPos.x,
      offsetY: panelPos.y,
    };
    dragMovedRef.current = false;
    setPanelDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPanelDragMove = (e) => {
    if (!panelDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMovedRef.current = true;

    const maxLeft = Math.max(0, window.innerWidth - 340);
    const maxUp = Math.max(0, window.innerHeight - 520);

    setPanelPos({
      x: clamp(dragStartRef.current.offsetX + dx, 0, maxLeft),
      y: clamp(dragStartRef.current.offsetY + dy, 0, maxUp),
    });
  };

  const endPanelDrag = (e) => {
    setPanelDragging(false);
    dragStartRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const translateBtnX = Number(iconPos.x || 0);
  const translateBtnY = Number(iconPos.y || 0);
  const translatePnlX = Number(panelPos.x || 0);
  const translatePnlY = Number(panelPos.y || 0);

  return (
    <>
      <style>{`
        @keyframes mascot-wiggle {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(-4deg) scale(1.01); }
          50% { transform: rotate(4deg) scale(1.02); }
          75% { transform: rotate(-3deg) scale(1.01); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes mascot-blink {
          0%, 44%, 47%, 100% { transform: scaleY(1); }
          45%, 46% { transform: scaleY(0.06); }
        }
      `}</style>

      {/* Close overlay - subtle */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.08)",
              zIndex: 420,
            }}
          />
        )}
      </AnimatePresence>

      {/* Floating Card Panel - 340x520px */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onPointerDown={startPanelDrag}
            onPointerMove={onPanelDragMove}
            onPointerUp={endPanelDrag}
            onPointerCancel={endPanelDrag}
            style={{
              position: "fixed",
              right: 20,
              bottom: 90,
              transform: `translate(${translatePnlX}px, ${translatePnlY}px)`,
              width: 340,
              height: 520,
              background: C.bg4,
              border: `1px solid ${C.line}`,
              borderRadius: R.xl,
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.25)",
              zIndex: 430,
              display: "grid",
              gridTemplateRows: "auto 1fr 64px",
              pointerEvents: "auto",
              cursor: panelDragging ? "grabbing" : "default",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - draggable */}
            <div style={{
              padding: "12px 14px 10px",
              borderBottom: `1px solid ${C.line}`,
              background: `linear-gradient(180deg, ${C.acc}18 0%, ${C.bg4} 65%)`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              cursor: "grab",
              userSelect: "none",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.t0, fontWeight: 800, letterSpacing: "-0.01em" }}>Analysiere Trends, Daten und Szenarien.</div>
                <div style={{ fontSize: 11, color: C.t1, marginTop: 2, fontWeight: 700, letterSpacing: "0.04em" }}>AI PILOT</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 10,
                    color: trendMeta.color,
                    background: `${trendMeta.color}18`,
                    border: `1px solid ${trendMeta.color}44`,
                    borderRadius: R.f,
                    padding: "2px 7px",
                    fontWeight: 700,
                  }}>
                    <span>{trendMeta.arrow}</span>
                    <span>{trendMeta.label}</span>
                  </div>

                  <svg width="78" height="22" viewBox="0 0 78 22" role="img" aria-label="Trendverlauf">
                    <path d={sparklinePath} fill="none" stroke={trendMeta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 6px",
                  color: C.t1,
                  fontSize: 16,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Chat Area */}
            <div ref={listRef} style={{
              overflowY: "auto",
              padding: "12px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              {messages.length === 0 && (
                <div style={{
                  padding: "12px",
                  background: C.bg3,
                  borderRadius: R.m,
                  color: C.t1,
                  fontSize: 12,
                  lineHeight: 1.4,
                  textAlign: "center",
                  marginTop: "auto",
                  marginBottom: "auto",
                }}>
                  Was möchtest du über deine Noten-Daten wissen?
                </div>
              )}

              {messages.length === 0 && (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}>
                  <div style={{ fontSize: 10, color: C.t2, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    Intelligente Kurzfragen
                  </div>
                  <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr" }}>
                  {currentSuggestions.slice(0, 3).map((f) => (
                    <button
                      key={f}
                      onClick={() => send(f)}
                      style={{
                        border: `1px solid ${C.line}`,
                        background: C.bg3,
                        color: C.t1,
                        fontSize: 12,
                        borderRadius: R.m,
                        padding: "9px 12px",
                        minHeight: 40,
                        width: "100%",
                        textAlign: "left",
                        whiteSpace: "normal",
                        lineHeight: 1.35,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: 500,
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = C.line;
                        e.target.style.borderColor = C.accH;
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = C.bg3;
                        e.target.style.borderColor = C.line;
                      }}
                    >
                      {f}
                    </button>
                  ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}>
                  <div style={{
                    maxWidth: "85%",
                    padding: "8px 11px",
                    borderRadius: m.role === "user" ? R.l : R.l,
                    background: m.role === "user" ? C.acc : C.bg3,
                    color: m.role === "user" ? C.t0 : C.t1,
                    fontSize: 12,
                    lineHeight: 1.35,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}>
                    {m.text || (m.streaming ? "..." : "")}
                    {m.streaming && <span style={{ marginLeft: 3, opacity: 0.6 }}>▍</span>}
                  </div>
                </div>
              ))}

              {messages.length > 0 && !sending && messages[messages.length - 1]?.role === "assistant" && (
                <div style={{
                  display: "grid",
                  gap: 6,
                  gridTemplateColumns: "1fr",
                  marginTop: 6,
                }}>
                  {messages[messages.length - 1].followUps?.slice(0, 3).map((f) => (
                    <button
                      key={f}
                      onClick={() => send(f)}
                      style={{
                        border: `1px solid ${C.line}`,
                        background: C.bg3,
                        color: C.t1,
                        fontSize: 12,
                        borderRadius: R.m,
                        padding: "9px 12px",
                        minHeight: 40,
                        width: "100%",
                        textAlign: "left",
                        whiteSpace: "normal",
                        lineHeight: 1.35,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: 500,
                        transition: `all 0.2s ease`,
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = C.line;
                        e.target.style.borderColor = C.accH;
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = C.bg3;
                        e.target.style.borderColor = C.line;
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input Area */}
            <div style={{
              borderTop: `1px solid ${C.line}`,
              padding: "8px 10px",
              display: "grid",
              gap: 6,
            }}>
              {Number.isFinite(questionsRemaining) && (
                <div style={{
                  alignSelf: "start",
                  fontSize: 11,
                  fontWeight: 700,
                  color: questionsRemaining > 0 ? C.t1 : C.err,
                  background: questionsRemaining > 0 ? C.bg3 : `${C.err}22`,
                  border: `1px solid ${questionsRemaining > 0 ? C.line : `${C.err}66`}`,
                  borderRadius: R.f,
                  padding: "4px 9px",
                }}>
                  Noch {questionsRemaining} Frage{questionsRemaining === 1 ? "" : "n"} übrig
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Schreibe deine Frage..."
                  style={{
                    flex: 1,
                    background: C.bg3,
                    border: `1px solid ${C.line}`,
                    borderRadius: R.s,
                    color: C.t0,
                    fontSize: 13,
                    padding: "11px 13px",
                    minHeight: 46,
                    outline: "none",
                    fontFamily: "inherit",
                    transition: `border-color 0.15s, box-shadow 0.15s`,
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = C.accH;
                    e.target.style.boxShadow = `0 0 0 2px ${C.acc}22`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = C.line;
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || sending || questionsRemaining === 0}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: R.s,
                    background: !input.trim() || sending || questionsRemaining === 0 ? C.bg3 : C.acc,
                    color: C.t0,
                    border: `1px solid ${!input.trim() || sending || questionsRemaining === 0 ? C.line : `${C.acc}66`}`,
                    cursor: !input.trim() || sending || questionsRemaining === 0 ? "not-allowed" : "pointer",
                    fontSize: 16,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    opacity: !input.trim() ? 0.55 : 1,
                    transition: "background 0.15s, border-color 0.15s, transform 0.12s",
                  }}
                >
                  ➤
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button - 56px, morphs between 🤖 and ✕ */}
      <motion.button
        type="button"
        onPointerDown={startButtonDrag}
        onPointerMove={onButtonDragMove}
        onPointerUp={endButtonDrag}
        onPointerCancel={endButtonDrag}
        onClick={() => {
          if (!dragMovedRef.current) setOpen((v) => !v);
        }}
        whileHover={{ scale: open ? 1 : 1.06 }}
        whileTap={{ scale: open ? 1 : 0.95 }}
        title={open ? "Schließen" : "AI Pilot öffnen"}
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          transform: `translate(${translateBtnX}px, ${translateBtnY}px)`,
          zIndex: 440,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: C.acc,
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
          display: "grid",
          placeItems: "center",
          cursor: buttonDragging ? "grabbing" : "pointer",
          animation: hasUnread && !open ? "mascot-wiggle 1.6s ease-in-out infinite" : "none",
          userSelect: "none",
          touchAction: "none",
          transition: "background 0.2s, box-shadow 0.2s",
          fontSize: 24,
          fontWeight: 700,
          color: C.t0,
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.boxShadow = "0 12px 32px rgba(0, 0, 0, 0.3)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.2)";
        }}
      >
        {open ? "✕" : "🤖"}

        {/* Unread badge */}
        {hasUnread && !open && (
          <span style={{
            position: "absolute",
            top: -4,
            right: -4,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: C.g5,
            border: `2px solid ${C.bg0}`,
            boxShadow: `0 2px 8px ${C.g5}66`,
          }} />
        )}
      </motion.button>
    </>
  );
});

AIMascotDrawer.displayName = "AIMascotDrawer";
export default AIMascotDrawer;
