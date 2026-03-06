/**
 * Notentracker — Production-Grade Academic Dashboard
 * German UI · Modular Architecture · Design System · Framer Motion
 *
 * Architecture:
 *   tokens/         → Design tokens (colors, spacing, typography)
 *   types/          → TypeScript-style JSDoc types
 *   lib/            → Pure utility functions
 *   hooks/          → Reusable state hooks
 *   ui/             → Atomic UI components (Button, Card, Input, Badge, Modal…)
 *   features/       → Feature components (Dashboard, Fächer, Statistik, Planer)
 */

import {
  useState, useEffect, useCallback, useMemo, useRef, memo
} from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS — Single source of truth for design decisions
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  // Colors
  bg:       "#09090f",
  surface:  "#0e0e18",
  surfaceHover: "#13131f",
  border:   "#1c1c2e",
  borderHover: "#252538",
  accent:   "#3b6ef0",
  accentDim: "#3b6ef018",
  text:     "#e8e8f0",
  textSub:  "#6b6b80",
  textMuted:"#3a3a50",

  // Grade colors
  g1: "#22c55e",
  g2: "#84cc16",
  g3: "#eab308",
  g4: "#f97316",
  g5: "#ef4444",

  // Spacing (8px grid)
  sp1: "8px",
  sp2: "16px",
  sp3: "24px",
  sp4: "32px",
  sp5: "40px",
  sp6: "48px",

  // Radius
  r1: "6px",
  r2: "10px",
  r3: "14px",

  // Motion
  ease: "cubic-bezier(0.4, 0, 0.2, 1)",
  fast: "150ms",
  base: "200ms",
  slow: "350ms",
};

// ─────────────────────────────────────────────────────────────────────────────
// LIB — Pure utility functions
// ─────────────────────────────────────────────────────────────────────────────
const gradeColor = (g) => {
  if (!g) return T.textMuted;
  if (g <= 1.5) return T.g1;
  if (g <= 2.5) return T.g2;
  if (g <= 3.5) return T.g3;
  if (g <= 4.5) return T.g4;
  return T.g5;
};

const gradeLabel = (g) => {
  if (!g) return "–";
  if (g <= 1.5) return "Sehr gut";
  if (g <= 2.5) return "Gut";
  if (g <= 3.5) return "Befriedigend";
  if (g <= 4.5) return "Ausreichend";
  return "Mangelhaft";
};

const weightedAvg = (grades) => {
  if (!grades?.length) return null;
  const tw = grades.reduce((s, g) => s + g.weight, 0);
  const tg = grades.reduce((s, g) => s + g.value * g.weight, 0);
  return tw ? +(tg / tw).toFixed(2) : null;
};

const subjectAvg = (grades, sid) =>
  weightedAvg(grades.filter((g) => g.subjectId === sid));

const daysUntil = (d) =>
  Math.ceil((new Date(d) - new Date()) / 86400000);

const uid = () => Math.random().toString(36).slice(2, 9);

const fmt = (n, dec = 2) => n?.toFixed(dec) ?? "–";

const formatDate = (d) =>
  new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────
const useLocalStorage = (key, initial) => {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; }
    catch { return initial; }
  });
  const set = useCallback((v) => {
    const next = typeof v === "function" ? v(val) : v;
    setVal(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  }, [key, val]);
  return [val, set];
};

const useCountUp = (target, duration = 1000) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target == null) return;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - (1 - p) ** 3;
      setVal(+(target * ease).toFixed(2));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return val;
};

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────────────────────
const SEED_SUBJECTS = [
  { id: "s1", name: "Mathematik",  weight: 2,   target: 2.0 },
  { id: "s2", name: "Physik",      weight: 1.5, target: 2.5 },
  { id: "s3", name: "Geschichte",  weight: 1,   target: 3.0 },
  { id: "s4", name: "Literatur",   weight: 1,   target: 2.0 },
];

const SEED_GRADES = [
  { id: "g1", subjectId: "s1", value: 2.0, weight: 2, date: "2025-01-15", type: "Prüfung"  },
  { id: "g2", subjectId: "s1", value: 1.5, weight: 1, date: "2025-01-22", type: "Hausaufgabe" },
  { id: "g3", subjectId: "s2", value: 3.0, weight: 2, date: "2025-01-18", type: "Prüfung"  },
  { id: "g4", subjectId: "s3", value: 2.5, weight: 1, date: "2025-01-20", type: "Mündlich" },
  { id: "g5", subjectId: "s4", value: 1.0, weight: 1, date: "2025-01-25", type: "Prüfung"  },
  { id: "g6", subjectId: "s2", value: 2.0, weight: 1, date: "2025-02-01", type: "Hausaufgabe" },
  { id: "g7", subjectId: "s1", value: 1.0, weight: 2, date: "2025-02-10", type: "Prüfung"  },
  { id: "g8", subjectId: "s3", value: 3.5, weight: 2, date: "2025-02-14", type: "Prüfung"  },
];

const SEED_EXAMS = [
  { id: "e1", subjectId: "s1", title: "Halbjahrsprüfung",   date: "2025-03-15", reminder: true  },
  { id: "e2", subjectId: "s2", title: "Laborbewertung",     date: "2025-03-20", reminder: false },
  { id: "e3", subjectId: "s3", title: "Hausarbeit abgeben", date: "2025-03-28", reminder: true  },
  { id: "e4", subjectId: "s4", title: "Abschlussprüfung",   date: "2025-04-10", reminder: true  },
];

const XP_PER_GRADE = 50;
const LEVEL_XP     = 500;

// ─────────────────────────────────────────────────────────────────────────────
// UI / ATOMS
// ─────────────────────────────────────────────────────────────────────────────

/** Skeleton shimmer block */
const Skeleton = memo(({ width = "100%", height = 16, radius = T.r1 }) => (
  <div style={{
    width, height, borderRadius: radius,
    background: `linear-gradient(90deg, ${T.border} 25%, ${T.surfaceHover} 50%, ${T.border} 75%)`,
    backgroundSize: "400% 100%",
    animation: "skshimmer 1.6s ease infinite",
  }} />
));

/** Pill badge */
const Badge = memo(({ children, color = T.accent, size = "sm" }) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    padding: size === "sm" ? "2px 8px" : "4px 12px",
    borderRadius: 999,
    fontSize: size === "sm" ? 11 : 13,
    fontWeight: 600, letterSpacing: "0.03em",
    background: color + "1a", color,
    border: `1px solid ${color}33`,
    whiteSpace: "nowrap",
  }}>{children}</span>
));

/** Primary button */
const Button = memo(({ children, onClick, variant = "primary", size = "md",
  type = "button", disabled, icon }) => {
  const sz = { sm: "7px 13px", md: "9px 17px", lg: "12px 24px" }[size];
  const fs = { sm: 12, md: 13, lg: 14 }[size];
  const vars = {
    primary: { bg: T.accent, color: "#fff", border: "transparent" },
    ghost:   { bg: "transparent", color: T.textSub, border: T.border },
    danger:  { bg: "#ef444415", color: "#ef4444", border: "#ef444430" },
  };
  const v = vars[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: sz, borderRadius: T.r1,
      background: v.bg, color: v.color,
      border: `1px solid ${v.border}`,
      fontSize: fs, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.45 : 1,
      transition: `all ${T.fast} ${T.ease}`,
      fontFamily: "inherit", lineHeight: 1.4, whiteSpace: "nowrap",
    }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.opacity = "0.85")}
      onMouseLeave={e => !disabled && (e.currentTarget.style.opacity = "1")}
      onMouseDown={e  => !disabled && (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={e    => !disabled && (e.currentTarget.style.transform = "scale(1)")}
    >{icon && <span style={{ fontSize: fs + 1 }}>{icon}</span>}{children}</button>
  );
});

/** Surface card */
const Card = memo(({ children, style: s, padding = T.sp3, onClick }) => (
  <div onClick={onClick} style={{
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: T.r3, padding,
    transition: `border-color ${T.base} ${T.ease}`,
    cursor: onClick ? "pointer" : "default", ...s,
  }}
    onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = T.borderHover)}
    onMouseLeave={e => onClick && (e.currentTarget.style.borderColor = T.border)}
  >{children}</div>
));

/** Section label */
const Label = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
    textTransform: "uppercase", color: T.textMuted, marginBottom: T.sp1,
  }}>{children}</div>
);

/** Divider */
const Sep = () => <div style={{ height: 1, background: T.border, margin: `${T.sp2} 0` }} />;

/** Inline form field */
const Field = memo(({ label, children }) => (
  <div style={{ marginBottom: T.sp2 }}>
    {label && <Label>{label}</Label>}
    {children}
  </div>
));

/** Text input */
const Input = memo(({ value, onChange, type = "text", placeholder, autoFocus,
  min, max, step, onKeyDown }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    autoFocus={autoFocus} min={min} max={max} step={step} onKeyDown={onKeyDown}
    style={{
      width: "100%", boxSizing: "border-box",
      background: T.bg, border: `1px solid ${T.border}`,
      borderRadius: T.r1, padding: "9px 12px",
      color: T.text, fontSize: 14, outline: "none",
      fontFamily: "inherit",
      transition: `border-color ${T.fast} ${T.ease}`,
    }}
    onFocus={e  => (e.target.style.borderColor = T.accent)}
    onBlur={e   => (e.target.style.borderColor = T.border)}
  />
));

/** Select */
const Select = memo(({ value, onChange, options }) => (
  <select value={value} onChange={onChange} style={{
    width: "100%", boxSizing: "border-box",
    background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: T.r1, padding: "9px 12px",
    color: T.text, fontSize: 14, outline: "none",
    fontFamily: "inherit", cursor: "pointer",
    transition: `border-color ${T.fast} ${T.ease}`,
  }}
    onFocus={e => (e.target.style.borderColor = T.accent)}
    onBlur={e  => (e.target.style.borderColor = T.border)}
  >
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
));

/** Progress bar */
const ProgressBar = memo(({ value, max = 1, color = T.accent, height = 4 }) => (
  <div style={{ height, background: T.border, borderRadius: 999, overflow: "hidden" }}>
    <div style={{
      height: "100%",
      width: `${Math.min(100, Math.max(0, (value / max) * 100))}%`,
      background: color, borderRadius: 999,
      transition: `width ${T.slow} ${T.ease}`,
    }} />
  </div>
));

/** Modal overlay */
const Modal = memo(({ open, onClose, title, children, width = 460 }) => {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "#00000070", backdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: T.sp2,
        animation: "fadeIn 0.15s ease",
      }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: width,
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: T.r3, padding: T.sp4,
        boxShadow: "0 32px 64px #00000088",
        animation: "slideUp 0.18s cubic-bezier(.4,0,.2,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: T.sp3 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: T.text, letterSpacing: "-0.01em" }}>{title}</h3>
          <button onClick={onClose} aria-label="Schließen" style={{
            background: "none", border: "none", color: T.textMuted, cursor: "pointer",
            fontSize: 18, padding: "4px 6px", borderRadius: T.r1, lineHeight: 1,
            transition: `color ${T.fast} ${T.ease}`,
          }}
            onMouseEnter={e => (e.currentTarget.style.color = T.text)}
            onMouseLeave={e => (e.currentTarget.style.color = T.textMuted)}
          >✕</button>
        </div>
        {children}
      </div>
    </div>
  );
});

/** Toast notifications */
const ToastContainer = memo(({ toasts, dismiss }) => (
  <div role="alert" aria-live="polite" style={{
    position: "fixed", top: T.sp2, right: T.sp2, zIndex: 999,
    display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none",
  }}>
    {toasts.map(t => (
      <div key={t.id} onClick={() => dismiss(t.id)} style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px",
        background: T.surface, border: `1px solid ${t.error ? "#ef444440" : T.border}`,
        borderRadius: T.r2, cursor: "pointer", pointerEvents: "auto",
        boxShadow: "0 8px 24px #00000055",
        animation: "slideIn 0.18s ease",
        maxWidth: 320, fontSize: 13, color: T.text,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: t.error ? "#ef4444" : T.accent, flexShrink: 0
        }} />
        {t.message}
      </div>
    ))}
  </div>
));

/** Animated progress ring */
const Ring = memo(({ value, max = 6, size = 148, stroke = 9 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = value ? Math.max(0, 1 - (value - 1) / (max - 1)) : 0;
  const color = value ? gradeColor(value) : T.textMuted;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={T.border} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${circ * pct} ${circ}`}
        strokeLinecap="round"
        style={{ transition: `stroke-dasharray 1.1s ${T.ease}, stroke 0.4s` }}
      />
    </svg>
  );
});

/** Keyboard shortcut hint */
const KbdHint = ({ keys }) => (
  <span style={{ display: "inline-flex", gap: 3 }}>
    {keys.map((k, i) => (
      <span key={i} style={{
        display: "inline-block", padding: "1px 5px",
        background: T.bg, border: `1px solid ${T.border}`,
        borderRadius: 4, fontSize: 11, color: T.textSub,
        fontFamily: "monospace",
      }}>{k}</span>
    ))}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND PALETTE
// ─────────────────────────────────────────────────────────────────────────────
const CommandPalette = memo(({ open, onClose, onNavigate, onAddGrade }) => {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 40); }
  }, [open]);

  const commands = [
    { label: "Dashboard",     key: "dashboard", hint: "Übersicht" },
    { label: "Fächer",        key: "faecher",   hint: "Fächer verwalten" },
    { label: "Statistiken",   key: "statistik", hint: "Leistungsanalyse" },
    { label: "Prüfungsplan",  key: "planer",    hint: "Termine verwalten" },
    { label: "Note hinzufügen", key: "__grade", hint: "Neue Note eintragen" },
  ].filter(c => !q || c.label.toLowerCase().includes(q.toLowerCase()));

  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "#00000075", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: 100, animation: "fadeIn 0.1s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 500,
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: T.r3, overflow: "hidden",
        boxShadow: "0 40px 80px #00000099",
        animation: "slideUp 0.15s ease",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", borderBottom: `1px solid ${T.border}`,
        }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
            stroke={T.textMuted} strokeWidth={2} strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Befehl suchen…"
            onKeyDown={e => e.key === "Escape" && onClose()}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: T.text, fontSize: 15, fontFamily: "inherit",
            }} />
          <KbdHint keys={["ESC"]} />
        </div>
        <div style={{ padding: 6, maxHeight: 300, overflowY: "auto" }}>
          {commands.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
              Keine Ergebnisse
            </div>
          )}
          {commands.map((c, i) => (
            <button key={i} onClick={() => {
              if (c.key === "__grade") onAddGrade();
              else onNavigate(c.key);
              onClose();
            }} style={{
              width: "100%", display: "flex", justifyContent: "space-between",
              alignItems: "center", padding: "10px 12px",
              background: "none", border: "none", borderRadius: T.r1,
              cursor: "pointer", fontFamily: "inherit",
              transition: `background ${T.fast} ${T.ease}`,
            }}
              onMouseEnter={e => (e.currentTarget.style.background = T.surfaceHover)}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <span style={{ fontSize: 14, color: T.text }}>{c.label}</span>
              <span style={{ fontSize: 12, color: T.textMuted }}>{c.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURES / DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
const StatCard = memo(({ label, value, sub, color }) => (
  <Card padding={T.sp3}>
    <Label>{label}</Label>
    <div style={{
      fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em",
      color: color || T.text, lineHeight: 1, marginBottom: 4,
    }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: T.textMuted }}>{sub}</div>}
  </Card>
));

const GradeRow = memo(({ grade, subject }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: `${T.sp1} 0`, borderBottom: `1px solid ${T.border}`,
  }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{subject?.name ?? "Unbekannt"}</div>
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
        {grade.type} · {formatDate(grade.date)}
      </div>
    </div>
    <div style={{
      fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em",
      color: gradeColor(grade.value),
    }}>{grade.value.toFixed(1)}</div>
  </div>
));

const ExamRow = memo(({ exam, subject }) => {
  const days = daysUntil(exam.date);
  const urgent = days <= 3;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: `12px 0`, borderBottom: `1px solid ${T.border}`,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{exam.title}</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
          {subject?.name} · {formatDate(exam.date)}
        </div>
      </div>
      <Badge color={urgent ? "#ef4444" : days <= 7 ? "#f97316" : T.accent}>
        {days === 0 ? "Heute" : days === 1 ? "Morgen" : `${days}d`}
      </Badge>
    </div>
  );
});

const Dashboard = memo(({ grades, subjects, exams, xp, loading }) => {
  const avg = weightedAvg(grades);
  const animAvg = useCountUp(avg, 1100);

  const subjectAvgs = useMemo(() =>
    subjects.map(s => ({ ...s, avg: subjectAvg(grades, s.id) }))
      .filter(s => s.avg !== null)
      .sort((a, b) => a.avg - b.avg),
    [grades, subjects]
  );

  const best   = subjectAvgs[0];
  const worst  = subjectAvgs[subjectAvgs.length - 1];
  const recent = useMemo(() =>
    [...grades].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
    [grades]
  );

  const upcoming = useMemo(() =>
    [...exams].filter(e => daysUntil(e.date) >= 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4),
    [exams]
  );

  const xpInLevel = xp % LEVEL_XP;
  const level     = Math.floor(xp / LEVEL_XP) + 1;

  const trend = useMemo(() => {
    if (grades.length < 4) return null;
    const sorted = [...grades].sort((a, b) => new Date(a.date) - new Date(b.date));
    const h = Math.floor(sorted.length / 2);
    const a1 = weightedAvg(sorted.slice(0, h));
    const a2 = weightedAvg(sorted.slice(h));
    if (a1 == null || a2 == null) return null;
    return a2 < a1 ? "steigend" : a2 > a1 ? "fallend" : "stabil";
  }, [grades]);

  if (loading) return (
    <div style={{ display: "grid", gap: T.sp2 }}>
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr", gap: T.sp2 }}>
        <Skeleton height={180} radius={T.r3} />
        <Skeleton height={180} radius={T.r3} />
        <Skeleton height={180} radius={T.r3} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: T.sp2 }}>
        <Skeleton height={280} radius={T.r3} />
        <Skeleton height={280} radius={T.r3} />
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: T.sp2, animation: "fadeIn 0.3s ease" }}>
      {/* Top row */}
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr", gap: T.sp2 }}>
        {/* Average ring */}
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: T.sp1 }} padding={T.sp3}>
          <div style={{ position: "relative", width: 148, height: 148 }}>
            <Ring value={avg} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{
                fontSize: 34, fontWeight: 800, letterSpacing: "-0.04em",
                color: avg ? gradeColor(avg) : T.textMuted, lineHeight: 1,
              }}>{avg ? animAvg.toFixed(2) : "–"}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>
                {avg ? gradeLabel(avg) : "Keine Noten"}
              </div>
            </div>
          </div>
          <Label>Gesamtdurchschnitt</Label>
          {trend && (
            <Badge color={trend === "steigend" ? T.g1 : trend === "fallend" ? T.g5 : T.textSub}>
              {trend === "steigend" ? "↑ Verbessernd" : trend === "fallend" ? "↓ Fallend" : "→ Stabil"}
            </Badge>
          )}
        </Card>

        {/* Best */}
        <Card padding={T.sp3}>
          <Label>Bestes Fach</Label>
          {best ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 6 }}>{best.name}</div>
              <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", color: gradeColor(best.avg), lineHeight: 1 }}>
                {best.avg.toFixed(2)}
              </div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{gradeLabel(best.avg)}</div>
              <Sep />
              <div style={{ fontSize: 12, color: T.textMuted }}>Ziel: {best.target.toFixed(1)}</div>
              <ProgressBar
                value={best.avg <= best.target ? 1 : best.target / best.avg}
                color={gradeColor(best.avg)}
                height={3}
              />
            </>
          ) : <div style={{ color: T.textMuted, fontSize: 14 }}>Noch keine Daten</div>}
        </Card>

        {/* Worst + XP */}
        <div style={{ display: "flex", flexDirection: "column", gap: T.sp2 }}>
          <Card padding={T.sp3} style={{ flex: 1 }}>
            <Label>Verbesserungsbedarf</Label>
            {worst && worst.id !== best?.id ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 4 }}>{worst.name}</div>
                <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em", color: gradeColor(worst.avg), lineHeight: 1 }}>
                  {worst.avg.toFixed(2)}
                </div>
              </>
            ) : <div style={{ color: T.textMuted, fontSize: 14 }}>Alle Fächer auf Ziel</div>}
          </Card>
          <Card padding={T.sp3} style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: T.sp1 }}>
              <Label>Level {level}</Label>
              <span style={{ fontSize: 11, color: T.textMuted }}>{xpInLevel}/{LEVEL_XP} XP</span>
            </div>
            <ProgressBar value={xpInLevel} max={LEVEL_XP} color={T.accent} height={5} />
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>
              Noch {LEVEL_XP - xpInLevel} XP bis Level {level + 1}
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: T.sp2 }}>
        <Card padding={T.sp3}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: T.sp2 }}>Zuletzt eingetragene Noten</div>
          {recent.length === 0
            ? <div style={{ color: T.textMuted, fontSize: 14, paddingTop: T.sp3, textAlign: "center" }}>Noch keine Noten eingetragen.</div>
            : recent.map(g => <GradeRow key={g.id} grade={g} subject={subjects.find(s => s.id === g.subjectId)} />)
          }
        </Card>

        <Card padding={T.sp3}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: T.sp2 }}>Anstehende Prüfungen</div>
          {upcoming.length === 0
            ? <div style={{ color: T.textMuted, fontSize: 14, paddingTop: T.sp3, textAlign: "center" }}>Keine anstehenden Prüfungen.</div>
            : upcoming.map(e => <ExamRow key={e.id} exam={e} subject={subjects.find(s => s.id === e.subjectId)} />)
          }
        </Card>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURES / GRADE MODAL
// ─────────────────────────────────────────────────────────────────────────────
const GradeModal = memo(({ open, onClose, subjects, grades, onAdd }) => {
  const [form, setForm] = useState({
    subjectId: subjects[0]?.id ?? "",
    value: "",
    weight: "1",
    date: new Date().toISOString().slice(0, 10),
    type: "Prüfung",
  });
  const [error, setError] = useState("");
  const [impact, setImpact] = useState(null);

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    const v = parseFloat(form.value);
    if (isNaN(v) || v < 1 || v > 6 || !form.subjectId) { setImpact(null); return; }
    const sg   = grades.filter(g => g.subjectId === form.subjectId);
    const before = weightedAvg(sg);
    const after  = weightedAvg([...sg, { value: v, weight: +form.weight }]);
    setImpact({ before, after, delta: after != null && before != null ? +(after - before).toFixed(2) : null });
  }, [form.value, form.weight, form.subjectId, grades]);

  const validate = () => {
    const v = parseFloat(form.value);
    if (!form.subjectId) { setError("Bitte ein Fach auswählen."); return false; }
    if (isNaN(v) || v < 1 || v > 6) { setError("Note muss zwischen 1,0 und 6,0 liegen."); return false; }
    setError(""); return true;
  };

  const submit = () => {
    if (!validate()) return;
    onAdd({ ...form, value: parseFloat(form.value), weight: +form.weight });
    setForm(p => ({ ...p, value: "", weight: "1" }));
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Note hinzufügen">
      <Field label="Fach">
        <Select value={form.subjectId} onChange={f("subjectId")}
          options={subjects.map(s => ({ value: s.id, label: s.name }))} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: T.sp2 }}>
        <Field label="Note (1,0 – 6,0)">
          <Input type="number" value={form.value} onChange={f("value")}
            min={1} max={6} step={0.5} placeholder="z.B. 2,0" autoFocus
            onKeyDown={e => e.key === "Enter" && submit()} />
        </Field>
        <Field label="Gewichtung">
          <Input type="number" value={form.weight} onChange={f("weight")} min={0.5} max={5} step={0.5} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: T.sp2 }}>
        <Field label="Datum">
          <Input type="date" value={form.date} onChange={f("date")} />
        </Field>
        <Field label="Art">
          <Select value={form.type} onChange={f("type")}
            options={["Prüfung", "Mündlich", "Hausaufgabe", "Test"].map(t => ({ value: t, label: t }))} />
        </Field>
      </div>

      {/* Impact preview */}
      {impact && impact.before != null && impact.after != null && (
        <div style={{
          background: T.bg, border: `1px solid ${T.border}`,
          borderRadius: T.r2, padding: T.sp2, marginBottom: T.sp2,
        }}>
          <Label>Auswirkung auf Durchschnitt</Label>
          <div style={{ display: "flex", alignItems: "center", gap: T.sp3, marginTop: 6 }}>
            <div>
              <div style={{ fontSize: 11, color: T.textMuted }}>Vorher</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: gradeColor(impact.before) }}>
                {impact.before.toFixed(2)}
              </div>
            </div>
            <div style={{ color: T.textMuted }}>→</div>
            <div>
              <div style={{ fontSize: 11, color: T.textMuted }}>Nachher</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: gradeColor(impact.after) }}>
                {impact.after.toFixed(2)}
              </div>
            </div>
            {impact.delta != null && (
              <Badge
                color={impact.delta < 0 ? T.g1 : impact.delta > 0 ? T.g5 : T.textSub}
                size="md"
              >
                {impact.delta > 0 ? "+" : ""}{impact.delta.toFixed(2)}
              </Badge>
            )}
          </div>
        </div>
      )}

      {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: T.sp2 }}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: T.sp1 }}>
        <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
        <Button onClick={submit}>Note speichern</Button>
      </div>
    </Modal>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURES / FÄCHER
// ─────────────────────────────────────────────────────────────────────────────
const SubjectFormModal = memo(({ open, onClose, onSave, initial }) => {
  const [form, setForm] = useState(initial ?? { name: "", weight: "1", target: "2.0" });
  useEffect(() => { if (open) setForm(initial ?? { name: "", weight: "1", target: "2.0" }); }, [open, initial]);

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const submit = () => {
    if (!form.name.trim()) return;
    onSave({ ...form, weight: +form.weight, target: +form.target });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Fach bearbeiten" : "Fach hinzufügen"} width={400}>
      <Field label="Fachname">
        <Input value={form.name} onChange={f("name")} placeholder="z.B. Mathematik" autoFocus
          onKeyDown={e => e.key === "Enter" && submit()} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: T.sp2 }}>
        <Field label="Gewichtung"><Input type="number" value={form.weight} onChange={f("weight")} min={0.5} max={5} step={0.5} /></Field>
        <Field label="ZielNote"><Input type="number" value={form.target} onChange={f("target")} min={1} max={6} step={0.5} /></Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: T.sp1 }}>
        <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
        <Button onClick={submit} disabled={!form.name.trim()}>{initial ? "Speichern" : "Fach anlegen"}</Button>
      </div>
    </Modal>
  );
});

const SubjectCard = memo(({ subject, grades, onEdit, onDelete }) => {
  const avg = subjectAvg(grades, subject.id);
  const sg  = grades.filter(g => g.subjectId === subject.id);

  const required = avg != null ? (() => {
    const tw = sg.reduce((a, g) => a + g.weight, 0);
    const ws = sg.reduce((a, g) => a + g.value * g.weight, 0);
    return Math.max(1, Math.min(6, +(subject.target * (tw + 1) - ws).toFixed(2)));
  })() : null;

  const onTarget = avg != null && avg <= subject.target;

  return (
    <Card style={{ animation: "fadeIn 0.25s ease" }}>
      <div style={{ display: "flex", gap: T.sp2, alignItems: "flex-start" }}>
        <div style={{
          width: 3, alignSelf: "stretch", borderRadius: 99,
          background: avg ? gradeColor(avg) : T.border, flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: T.sp1 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{subject.name}</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                Gewichtung ×{subject.weight} · {sg.length} Noten · Ziel: {subject.target.toFixed(1)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              {avg != null
                ? <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", color: gradeColor(avg) }}>{avg.toFixed(2)}</div>
                : <div style={{ fontSize: 14, color: T.textMuted }}>Keine Noten</div>
              }
            </div>
          </div>

          {avg != null && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMuted, marginBottom: 4 }}>
                <span>Fortschritt zum Ziel ({subject.target.toFixed(1)})</span>
                <span style={{ color: onTarget ? T.g1 : T.g4 }}>
                  {onTarget ? "Ziel erreicht" : `Nächste Note: ${required}`}
                </span>
              </div>
              <ProgressBar
                value={onTarget ? 1 : subject.target / avg}
                color={gradeColor(avg)}
                height={3}
              />
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <Button variant="ghost" size="sm" onClick={() => onEdit(subject)}>Bearbeiten</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(subject.id)}>Löschen</Button>
        </div>
      </div>
    </Card>
  );
});

const FaecherPage = memo(({ subjects, grades, onAdd, onEdit, onDelete }) => {
  const [modal, setModal] = useState(null);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: T.sp3 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: T.text, letterSpacing: "-0.02em" }}>Fächer</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>{subjects.length} Fächer erfasst</p>
        </div>
        <Button onClick={() => setModal("new")} icon="+">&ensp;Fach hinzufügen</Button>
      </div>

      <div style={{ display: "grid", gap: T.sp2 }}>
        {subjects.map(s => (
          <SubjectCard key={s.id} subject={s} grades={grades}
            onEdit={(s) => setModal(s)}
            onDelete={onDelete}
          />
        ))}
        {subjects.length === 0 && (
          <Card padding={T.sp6} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, color: T.textMuted, marginBottom: T.sp2 }}>
              Noch keine Fächer angelegt.
            </div>
            <Button onClick={() => setModal("new")}>Erstes Fach anlegen</Button>
          </Card>
        )}
      </div>

      <SubjectFormModal
        open={modal !== null}
        onClose={() => setModal(null)}
        onSave={modal === "new" ? onAdd : (d) => onEdit(modal.id, d)}
        initial={modal !== "new" && modal !== null ? modal : null}
      />
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURES / STATISTIK
// ─────────────────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: T.r2, padding: "10px 14px", fontSize: 12,
    }}>
      <div style={{ color: T.textMuted, marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.name === "Schnitt" ? T.accent : T.text, fontWeight: 600 }}>
          {p.name}: {p.value?.toFixed ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  );
};

const RANGES = [
  { id: "7d", label: "7 Tage" },
  { id: "30d", label: "30 Tage" },
  { id: "semester", label: "Semester" },
  { id: "all", label: "Alles" },
];

const StatistikPage = memo(({ grades, subjects }) => {
  const [range, setRange] = useState("semester");

  const filtered = useMemo(() => {
    const days = { "7d": 7, "30d": 30, "semester": 180, "all": Infinity }[range];
    return grades.filter(g => (Date.now() - new Date(g.date)) / 86400000 <= days);
  }, [grades, range]);

  const lineData = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
    return sorted.map((g, i) => ({
      datum: g.date.slice(5),
      Note: g.value,
      Schnitt: weightedAvg(sorted.slice(0, i + 1)),
    }));
  }, [filtered]);

  const barData = useMemo(() =>
    subjects.map(s => ({
      name: s.name.slice(0, 10),
      Schnitt: subjectAvg(filtered, s.id) ?? 0,
      Ziel: s.target,
    })).filter(d => d.Schnitt > 0),
    [filtered, subjects]
  );

  const avg   = weightedAvg(filtered);
  const best  = filtered.length ? Math.min(...filtered.map(g => g.value)) : null;
  const worst = filtered.length ? Math.max(...filtered.map(g => g.value)) : null;

  return (
    <div style={{ display: "grid", gap: T.sp2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: T.text, letterSpacing: "-0.02em" }}>Statistiken</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>{filtered.length} Noten im Zeitraum</p>
        </div>
        <div style={{ display: "flex", gap: 3, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r2, padding: 4 }}>
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)} style={{
              padding: "6px 13px", borderRadius: T.r1, border: "none", cursor: "pointer",
              background: range === r.id ? T.surfaceHover : "transparent",
              color: range === r.id ? T.text : T.textSub,
              fontSize: 13, fontWeight: range === r.id ? 600 : 400,
              transition: `all ${T.fast} ${T.ease}`, fontFamily: "inherit",
            }}>{r.label}</button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: T.sp2 }}>
        {[
          { label: "Durchschnitt",   value: avg?.toFixed(2) ?? "–",    color: avg ? gradeColor(avg) : T.textMuted },
          { label: "Beste Note",     value: best?.toFixed(1) ?? "–",   color: best ? gradeColor(best) : T.textMuted },
          { label: "Schlechteste",   value: worst?.toFixed(1) ?? "–",  color: worst ? gradeColor(worst) : T.textMuted },
          { label: "Anzahl Noten",   value: filtered.length, color: T.text },
        ].map(s => <StatCard key={s.label} label={s.label} value={s.value} color={s.color} />)}
      </div>

      {filtered.length === 0 ? (
        <Card padding={T.sp6} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, color: T.textMuted }}>Keine Noten in diesem Zeitraum.</div>
        </Card>
      ) : (
        <>
          <Card padding={T.sp3}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: T.sp2 }}>Notenentwicklung</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={lineData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke={T.border} strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="datum" stroke={T.border} tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[1, 6]} reversed stroke={T.border} tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={4} stroke="#ef444428" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="Note" stroke={T.border} strokeWidth={1}
                  dot={{ fill: T.accent, r: 3, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="Schnitt" stroke={T.accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card padding={T.sp3}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: T.sp2 }}>Fächervergleich</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke={T.border} strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" stroke={T.border} tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 6]} reversed stroke={T.border} tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={4} stroke="#ef444428" strokeDasharray="4 4" />
                <Bar dataKey="Schnitt" radius={[3, 3, 0, 0]} fill={T.accent} />
                <Bar dataKey="Ziel" radius={[3, 3, 0, 0]} fill={T.border} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURES / PRÜFUNGSPLANER
// ─────────────────────────────────────────────────────────────────────────────
const ExamModal = memo(({ open, onClose, subjects, onAdd }) => {
  const [form, setForm] = useState({ subjectId: subjects[0]?.id ?? "", title: "", date: "", reminder: false });
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const submit = () => {
    if (!form.subjectId || !form.title || !form.date) return;
    onAdd({ ...form });
    setForm(p => ({ ...p, title: "", date: "" }));
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Prüfung hinzufügen" width={400}>
      <Field label="Fach">
        <Select value={form.subjectId} onChange={f("subjectId")} options={subjects.map(s => ({ value: s.id, label: s.name }))} />
      </Field>
      <Field label="Prüfungstitel">
        <Input value={form.title} onChange={f("title")} placeholder="z.B. Halbjahrsprüfung" autoFocus
          onKeyDown={e => e.key === "Enter" && submit()} />
      </Field>
      <Field label="Datum">
        <Input type="date" value={form.date} onChange={f("date")} />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: T.sp1 }}>
        <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
        <Button onClick={submit} disabled={!form.title || !form.date}>Prüfung anlegen</Button>
      </div>
    </Modal>
  );
});

const PlanerPage = memo(({ exams, subjects, onAdd, onToggleReminder, onDelete }) => {
  const [month, setMonth] = useState(new Date());
  const [addOpen, setAddOpen] = useState(false);

  const yr = month.getFullYear();
  const mo = month.getMonth();
  const firstDow = new Date(yr, mo, 1).getDay();
  const daysInMo = new Date(yr, mo + 1, 0).getDate();
  const monthLabel = month.toLocaleString("de-DE", { month: "long", year: "numeric" });

  const byDate = useMemo(() => {
    const m = {};
    exams.forEach(e => { (m[e.date] = m[e.date] ?? []).push(e); });
    return m;
  }, [exams]);

  const upcoming = useMemo(() =>
    [...exams].filter(e => daysUntil(e.date) >= 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [exams]
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: T.sp2, alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: T.sp3 }}>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: T.text, letterSpacing: "-0.02em" }}>Prüfungsplan</h2>
          <div style={{ display: "flex", gap: T.sp1, alignItems: "center" }}>
            <Button variant="ghost" size="sm" onClick={() => setMonth(new Date(yr, mo - 1))}>‹</Button>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text, minWidth: 160, textAlign: "center" }}>{monthLabel}</span>
            <Button variant="ghost" size="sm" onClick={() => setMonth(new Date(yr, mo + 1))}>›</Button>
          </div>
        </div>

        <Card padding={T.sp2}>
          {/* Weekday headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"].map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, color: T.textMuted, padding: "4px 0", fontWeight: 500 }}>{d}</div>
            ))}
          </div>
          {/* Days grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {Array.from({ length: firstDow }).map((_, i) => <div key={`pad${i}`} />)}
            {Array.from({ length: daysInMo }).map((_, i) => {
              const d = i + 1;
              const ds = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const dayExams = byDate[ds] ?? [];
              const isToday = ds === today;
              return (
                <div key={d} style={{
                  minHeight: 48, padding: "4px 5px",
                  borderRadius: T.r1,
                  background: isToday ? `${T.accent}12` : T.bg,
                  border: `1px solid ${isToday ? T.accent + "40" : T.border}`,
                }}>
                  <div style={{ fontSize: 11, color: isToday ? T.accent : T.textMuted, fontWeight: isToday ? 700 : 400 }}>{d}</div>
                  {dayExams.map(ex => (
                    <div key={ex.id} style={{
                      fontSize: 9, color: T.accent, marginTop: 2,
                      background: T.accentDim, borderRadius: 3, padding: "1px 3px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{ex.title}</div>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Sidebar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: T.sp2 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Anstehend</div>
          <Button size="sm" onClick={() => setAddOpen(true)}>+ Hinzufügen</Button>
        </div>
        <div style={{ display: "grid", gap: T.sp1 }}>
          {upcoming.map(ex => {
            const subj  = subjects.find(s => s.id === ex.subjectId);
            const days  = daysUntil(ex.date);
            const urgent = days <= 3;
            return (
              <Card key={ex.id} padding={T.sp2}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: T.sp1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2 }}>{ex.title}</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{subj?.name}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: T.sp1 }}>
                      <Badge color={urgent ? "#ef4444" : days <= 7 ? "#f97316" : T.accent}>
                        {days === 0 ? "Heute" : days === 1 ? "Morgen" : `in ${days} Tagen`}
                      </Badge>
                      <button
                        onClick={() => onToggleReminder(ex.id)}
                        aria-label="Erinnerung umschalten"
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 13, color: ex.reminder ? T.accent : T.textMuted,
                          transition: `color ${T.fast} ${T.ease}`,
                        }}>
                        {ex.reminder ? "Erinnerung aktiv" : "Erinnerung"}
                      </button>
                    </div>
                  </div>
                  <button onClick={() => onDelete(ex.id)} aria-label="Prüfung löschen"
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: T.textMuted, fontSize: 14, padding: 2,
                      transition: `color ${T.fast} ${T.ease}`,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                    onMouseLeave={e => (e.currentTarget.style.color = T.textMuted)}
                  >✕</button>
                </div>
              </Card>
            );
          })}
          {upcoming.length === 0 && (
            <Card padding={T.sp4} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, color: T.textMuted }}>Keine anstehenden Prüfungen.</div>
            </Card>
          )}
        </div>
      </div>

      <ExamModal open={addOpen} onClose={() => setAddOpen(false)} subjects={subjects} onAdd={onAdd} />
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION (Sidebar only — one system)
// ─────────────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard",     icon: ({ active }) => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={active ? "currentColor" : "currentColor"} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )},
  { id: "faecher",   label: "Fächer",        icon: ({ active }) => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  )},
  { id: "statistik", label: "Statistiken",   icon: ({ active }) => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  )},
  { id: "planer",    label: "Prüfungsplan",  icon: ({ active }) => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )},
];

const Sidebar = memo(({ page, setPage, onCmdOpen }) => (
  <nav aria-label="Hauptnavigation" style={{
    position: "fixed", left: 0, top: 0, bottom: 0, width: 216,
    background: T.bg, borderRight: `1px solid ${T.border}`,
    display: "flex", flexDirection: "column",
    padding: `${T.sp3} ${T.sp2}`, zIndex: 100,
  }}>
    {/* Brand */}
    <div style={{ padding: `${T.sp1} ${T.sp2}`, marginBottom: T.sp3 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: "-0.02em" }}>
        Notentracker
      </div>
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Akademisches Dashboard</div>
    </div>

    {/* Nav items */}
    {NAV_ITEMS.map(item => {
      const active = page === item.id;
      return (
        <button key={item.id} onClick={() => setPage(item.id)} aria-current={active ? "page" : undefined}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 12px", borderRadius: T.r1,
            background: active ? T.surfaceHover : "transparent",
            border: "none", cursor: "pointer",
            color: active ? T.text : T.textSub,
            fontSize: 13, fontWeight: active ? 600 : 400,
            transition: `all ${T.fast} ${T.ease}`,
            textAlign: "left", width: "100%",
            marginBottom: 2, fontFamily: "inherit",
            borderLeft: `2px solid ${active ? T.accent : "transparent"}`,
          }}
          onMouseEnter={e => !active && (e.currentTarget.style.color = T.text)}
          onMouseLeave={e => !active && (e.currentTarget.style.color = T.textSub)}
        >
          <item.icon active={active} />
          {item.label}
        </button>
      );
    })}

    {/* Command palette hint */}
    <div style={{ marginTop: "auto" }}>
      <button onClick={onCmdOpen} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "8px 12px",
        background: "none", border: `1px solid ${T.border}`, borderRadius: T.r1,
        cursor: "pointer", fontFamily: "inherit",
        transition: `border-color ${T.fast} ${T.ease}`,
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = T.borderHover)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
      >
        <span style={{ fontSize: 12, color: T.textMuted }}>Suchen &amp; navigieren</span>
        <KbdHint keys={["⌘", "K"]} />
      </button>
    </div>
  </nav>
));

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [subjects, setSubjects] = useLocalStorage("nt_subjects_v2", SEED_SUBJECTS);
  const [grades,   setGrades]   = useLocalStorage("nt_grades_v2",   SEED_GRADES);
  const [exams,    setExams]    = useLocalStorage("nt_exams_v2",    SEED_EXAMS);
  const [xp,       setXp]       = useLocalStorage("nt_xp_v2",      0);
  const [page,     setPage]     = useState("dashboard");
  const [gradeOpen, setGradeOpen] = useState(false);
  const [cmdOpen,   setCmdOpen]   = useState(false);
  const [toasts,    setToasts]    = useState([]);
  const [loading,   setLoading]   = useState(true);

  // Simulate initial load
  useEffect(() => { const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t); }, []);

  // Global keyboard shortcut
  useEffect(() => {
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const toast = useCallback((message, error = false) => {
    const id = uid();
    setToasts(p => [...p, { id, message, error }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);

  const addGrade = useCallback((grade) => {
    setGrades(p => [...p, { ...grade, id: `g${uid()}` }]);
    setXp(x => x + XP_PER_GRADE);
    toast("Note wurde gespeichert.");
  }, []);

  const addSubject  = useCallback((d) => { setSubjects(p => [...p, { ...d, id: `s${uid()}` }]); toast("Fach hinzugefügt."); }, []);
  const editSubject = useCallback((id, d) => { setSubjects(p => p.map(s => s.id === id ? { ...s, ...d } : s)); toast("Fach aktualisiert."); }, []);
  const deleteSubject = useCallback((id) => { setSubjects(p => p.filter(s => s.id !== id)); setGrades(p => p.filter(g => g.subjectId !== id)); toast("Fach gelöscht."); }, []);

  const addExam = useCallback((d) => { setExams(p => [...p, { ...d, id: `e${uid()}` }]); toast("Prüfung angelegt."); }, []);
  const toggleReminder = useCallback((id) => { setExams(p => p.map(e => e.id === id ? { ...e, reminder: !e.reminder } : e)); }, []);
  const deleteExam = useCallback((id) => { setExams(p => p.filter(e => e.id !== id)); }, []);

  const level = Math.floor(xp / LEVEL_XP) + 1;

  const PAGE_TITLES = {
    dashboard: "Dashboard",
    faecher:   "Fächer",
    statistik: "Statistiken",
    planer:    "Prüfungsplan",
  };

  const renderPage = () => {
    switch (page) {
      case "dashboard": return <Dashboard grades={grades} subjects={subjects} exams={exams} xp={xp} loading={loading} />;
      case "faecher":   return <FaecherPage subjects={subjects} grades={grades} onAdd={addSubject} onEdit={editSubject} onDelete={deleteSubject} />;
      case "statistik": return <StatistikPage grades={grades} subjects={subjects} />;
      case "planer":    return <PlanerPage exams={exams} subjects={subjects} onAdd={addExam} onToggleReminder={toggleReminder} onDelete={deleteExam} />;
      default:          return null;
    }
  };

  return (
    <>
      {/* ─── Global Styles ─── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { background: ${T.bg}; color: ${T.text}; font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; }
        body { background: ${T.bg}; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 999px; }
        ::selection { background: ${T.accent}33; }

        @keyframes fadeIn  { from { opacity: 0; }                          to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes skshimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }

        @media (max-width: 768px) {
          .sidebar { display: none !important; }
          .main    { margin-left: 0 !important; padding: ${T.sp2} !important; }
        }
      `}</style>

      {/* ─── Sidebar ─── */}
      <div className="sidebar">
        <Sidebar page={page} setPage={setPage} onCmdOpen={() => setCmdOpen(true)} />
      </div>

      {/* ─── Main ─── */}
      <main className="main" style={{
        marginLeft: 216, padding: T.sp4,
        minHeight: "100vh", maxWidth: 1120,
      }}>
        {/* Page header */}
        <header style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: T.sp4,
        }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: "-0.025em", lineHeight: 1.2 }}>
              {PAGE_TITLES[page]}
            </h1>
            {page === "dashboard" && (
              <p style={{ fontSize: 13, color: T.textMuted, marginTop: 3 }}>
                Willkommen zurück. Hier ist dein aktueller Leistungsüberblick.
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: T.sp1, alignItems: "center" }}>
            <button onClick={() => setCmdOpen(true)} aria-label="Befehlspalette öffnen" style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 13px", background: T.surface,
              border: `1px solid ${T.border}`, borderRadius: T.r1,
              color: T.textMuted, cursor: "pointer", fontSize: 13,
              fontFamily: "inherit",
              transition: `border-color ${T.fast} ${T.ease}`,
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = T.borderHover)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              Suchen
              <KbdHint keys={["⌘K"]} />
            </button>
            <Button onClick={() => setGradeOpen(true)}>Note hinzufügen</Button>
          </div>
        </header>

        {/* Page content */}
        <div key={page} style={{ animation: "fadeIn 0.2s ease" }}>
          {renderPage()}
        </div>
      </main>

      {/* ─── Modals ─── */}
      <GradeModal
        open={gradeOpen} onClose={() => setGradeOpen(false)}
        subjects={subjects} grades={grades} onAdd={addGrade}
      />
      <CommandPalette
        open={cmdOpen} onClose={() => setCmdOpen(false)}
        onNavigate={setPage} onAddGrade={() => { setGradeOpen(true); }}
      />

      {/* ─── Toasts ─── */}
      <ToastContainer toasts={toasts} dismiss={(id) => setToasts(p => p.filter(t => t.id !== id))} />
    </>
  );
}