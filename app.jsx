import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENT = "#2563EB";
const ACCENT_GLOW = "#2563EB40";
const GRADE_MIN = 1.0;
const GRADE_MAX = 6.0;

const GRADE_COLOR = (g) => {
  if (g <= 2.0) return "#22c55e";
  if (g <= 3.0) return "#84cc16";
  if (g <= 4.0) return "#eab308";
  if (g <= 5.0) return "#f97316";
  return "#ef4444";
};

const GRADE_LABEL = (g) => {
  if (g <= 1.5) return "Excellent";
  if (g <= 2.5) return "Good";
  if (g <= 3.5) return "Satisfactory";
  if (g <= 4.5) return "Sufficient";
  return "Poor";
};

const XP_PER_GRADE = 50;
const LEVEL_XP = 500;

const ACHIEVEMENTS = [
  { id: "first_grade", label: "First Grade", icon: "⭐", desc: "Added your first grade", condition: (s) => s.totalGrades >= 1 },
  { id: "streak_5", label: "On a Roll", icon: "🔥", desc: "Added 5 grades in a row", condition: (s) => s.totalGrades >= 5 },
  { id: "perfect", label: "Perfectionist", icon: "💎", desc: "Average below 1.5", condition: (s) => s.avg <= 1.5 && s.totalGrades > 0 },
  { id: "ten_grades", label: "Dedicated", icon: "📚", desc: "Added 10 grades", condition: (s) => s.totalGrades >= 10 },
];

const INITIAL_SUBJECTS = [
  { id: "s1", name: "Mathematics", weight: 2, target: 2.0, color: "#2563EB" },
  { id: "s2", name: "Physics", weight: 1.5, target: 2.5, color: "#7c3aed" },
  { id: "s3", name: "History", weight: 1, target: 3.0, color: "#0891b2" },
  { id: "s4", name: "Literature", weight: 1, target: 2.0, color: "#059669" },
];

const INITIAL_GRADES = [
  { id: "g1", subjectId: "s1", value: 2.0, weight: 2, date: "2025-01-15", type: "Exam" },
  { id: "g2", subjectId: "s1", value: 1.5, weight: 1, date: "2025-01-22", type: "Homework" },
  { id: "g3", subjectId: "s2", value: 3.0, weight: 2, date: "2025-01-18", type: "Exam" },
  { id: "g4", subjectId: "s3", value: 2.5, weight: 1, date: "2025-01-20", type: "Oral" },
  { id: "g5", subjectId: "s4", value: 1.0, weight: 1, date: "2025-01-25", type: "Exam" },
  { id: "g6", subjectId: "s2", value: 2.0, weight: 1, date: "2025-02-01", type: "Homework" },
  { id: "g7", subjectId: "s1", value: 1.0, weight: 2, date: "2025-02-10", type: "Exam" },
  { id: "g8", subjectId: "s3", value: 3.5, weight: 2, date: "2025-02-14", type: "Exam" },
];

const INITIAL_EXAMS = [
  { id: "e1", subjectId: "s1", title: "Midterm Exam", date: "2025-03-15", reminder: true },
  { id: "e2", subjectId: "s2", title: "Lab Assessment", date: "2025-03-20", reminder: false },
  { id: "e3", subjectId: "s3", title: "Essay Due", date: "2025-03-28", reminder: true },
  { id: "e4", subjectId: "s4", title: "Final Exam", date: "2025-04-10", reminder: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const calcWeightedAvg = (grades) => {
  if (!grades.length) return null;
  const totalW = grades.reduce((s, g) => s + g.weight, 0);
  const totalWG = grades.reduce((s, g) => s + g.value * g.weight, 0);
  return totalW ? +(totalWG / totalW).toFixed(2) : null;
};

const calcSubjectAvg = (grades, subjectId) =>
  calcWeightedAvg(grades.filter((g) => g.subjectId === subjectId));

const daysUntil = (dateStr) => {
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const useLocalStorage = (key, initial) => {
  const [val, setVal] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch { return initial; }
  });
  const set = useCallback((v) => {
    setVal(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  }, [key]);
  return [val, set];
};

const uid = () => Math.random().toString(36).slice(2, 10);

// ─── Micro Components ─────────────────────────────────────────────────────────
const Kbd = ({ children }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", padding: "1px 5px",
    background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 4,
    fontSize: 11, color: "#888", fontFamily: "monospace"
  }}>{children}</span>
);

const Badge = ({ children, color = ACCENT }) => (
  <span style={{
    display: "inline-block", padding: "2px 8px", borderRadius: 99,
    fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
    background: color + "22", color, border: `1px solid ${color}44`
  }}>{children}</span>
);

const Dot = ({ color }) => (
  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
);

const Divider = () => (
  <div style={{ height: 1, background: "#1e1e2e", margin: "8px 0" }} />
);

const CountUp = ({ to, duration = 1200, decimals = 2 }) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!to) return;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(+(to * ease).toFixed(decimals));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [to]);
  return <span>{val.toFixed(decimals)}</span>;
};

const ProgressRing = ({ value, max = 6, size = 160, stroke = 10 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = value ? 1 - (value - 1) / (max - 1) : 0;
  const dash = circ * pct;
  const color = value ? GRADE_COLOR(value) : "#2a2a3e";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a1a2e" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1), stroke 0.5s" }}
        filter={`drop-shadow(0 0 6px ${color}88)`}
      />
    </svg>
  );
};

const Toast = ({ toasts, remove }) => (
  <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
    {toasts.map((t) => (
      <div key={t.id} onClick={() => remove(t.id)} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
        background: "#0f0f1a", border: `1px solid ${t.type === "error" ? "#ef444444" : "#2563EB44"}`,
        borderRadius: 10, cursor: "pointer", minWidth: 220, maxWidth: 320,
        boxShadow: "0 8px 32px #00000066",
        animation: "slideIn 0.2s ease",
      }}>
        <span style={{ fontSize: 16 }}>{t.type === "error" ? "⚠️" : t.type === "achievement" ? "🏆" : "✓"}</span>
        <span style={{ fontSize: 13, color: "#e2e2f0" }}>{t.message}</span>
      </div>
    ))}
  </div>
);

// ─── Modal ────────────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, children, width = 480 }) => {
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "#00000088", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: width, background: "#0d0d1a",
        border: "1px solid #1e1e2e", borderRadius: 16, padding: 32,
        boxShadow: "0 24px 80px #00000099",
        animation: "modalIn 0.18s cubic-bezier(.4,0,.2,1)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#e2e2f0" }}>{title}</h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#555", cursor: "pointer",
            fontSize: 20, padding: 4, borderRadius: 6, lineHeight: 1,
            transition: "color 0.15s"
          }} onMouseOver={e => e.target.style.color = "#e2e2f0"}
            onMouseOut={e => e.target.style.color = "#555"}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ─── Input ────────────────────────────────────────────────────────────────────
const Input = ({ label, value, onChange, type = "text", min, max, step, placeholder, autoFocus, required, options, onKeyDown }) => {
  const style = {
    width: "100%", background: "#0a0a16", border: "1px solid #1e1e2e",
    borderRadius: 8, padding: "10px 12px", color: "#e2e2f0",
    fontSize: 14, outline: "none", transition: "border-color 0.15s",
    boxSizing: "border-box"
  };
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</label>}
      {options ? (
        <select value={value} onChange={onChange} style={{ ...style, cursor: "pointer" }}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          type={type} value={value} onChange={onChange}
          min={min} max={max} step={step} placeholder={placeholder}
          autoFocus={autoFocus} required={required} onKeyDown={onKeyDown}
          style={style}
          onFocus={e => e.target.style.borderColor = ACCENT}
          onBlur={e => e.target.style.borderColor = "#1e1e2e"}
        />
      )}
    </div>
  );
};

const Btn = ({ children, onClick, variant = "primary", size = "md", type = "button", disabled, style: extStyle }) => {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    cursor: disabled ? "not-allowed" : "pointer", border: "none", borderRadius: 8,
    fontWeight: 600, transition: "all 0.15s", opacity: disabled ? 0.5 : 1,
    fontSize: size === "sm" ? 12 : size === "lg" ? 15 : 13,
    padding: size === "sm" ? "6px 12px" : size === "lg" ? "12px 24px" : "8px 16px",
    ...extStyle
  };
  const variants = {
    primary: { background: ACCENT, color: "#fff" },
    ghost: { background: "transparent", color: "#888", border: "1px solid #1e1e2e" },
    danger: { background: "#ef444422", color: "#ef4444", border: "1px solid #ef444433" },
    success: { background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e33" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}
      onMouseOver={e => { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.opacity = disabled ? "0.5" : "0.9"; }}
      onMouseOut={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.opacity = disabled ? "0.5" : "1"; }}
      onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
      onMouseUp={e => e.currentTarget.style.transform = "scale(1.02)"}
    >{children}</button>
  );
};

// ─── Card ─────────────────────────────────────────────────────────────────────
const Card = ({ children, style: s, onClick, hover = true }) => (
  <div onClick={onClick} style={{
    background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 12,
    padding: 24, cursor: onClick ? "pointer" : "default",
    transition: "all 0.2s", ...s
  }}
    onMouseOver={e => hover && (e.currentTarget.style.borderColor = "#2a2a3e")}
    onMouseOut={e => hover && (e.currentTarget.style.borderColor = "#1a1a2e")}
  >{children}</div>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ w = "100%", h = 16, r = 6 }) => (
  <div style={{
    width: w, height: h, borderRadius: r,
    background: "linear-gradient(90deg, #1a1a2e 25%, #22223a 50%, #1a1a2e 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s infinite"
  }} />
);

// ─── Command Palette ──────────────────────────────────────────────────────────
const CommandPalette = ({ open, onClose, onNav, onAddGrade }) => {
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (open) { setQ(""); setTimeout(() => ref.current?.focus(), 50); } }, [open]);
  if (!open) return null;

  const cmds = [
    { label: "Go to Dashboard", icon: "⌂", action: () => { onNav("dashboard"); onClose(); } },
    { label: "Go to Subjects", icon: "📖", action: () => { onNav("subjects"); onClose(); } },
    { label: "Go to Statistics", icon: "📊", action: () => { onNav("stats"); onClose(); } },
    { label: "Go to Planner", icon: "📅", action: () => { onNav("planner"); onClose(); } },
    { label: "Add Grade", icon: "+", action: () => { onAddGrade(); onClose(); } },
  ].filter(c => !q || c.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "#00000088", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 480, background: "#0d0d1a",
        border: "1px solid #2a2a3e", borderRadius: 14,
        overflow: "hidden", boxShadow: "0 32px 80px #00000099",
        animation: "modalIn 0.15s ease"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid #1a1a2e" }}>
          <span style={{ color: "#444", fontSize: 16 }}>⌕</span>
          <input ref={ref} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Type a command or search…"
            onKeyDown={e => e.key === "Escape" && onClose()}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e2e2f0", fontSize: 15 }} />
          <Kbd>ESC</Kbd>
        </div>
        <div style={{ padding: 8, maxHeight: 320, overflowY: "auto" }}>
          {cmds.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "#444", fontSize: 14 }}>No results</div>}
          {cmds.map((c, i) => (
            <button key={i} onClick={c.action} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
              background: "none", border: "none", borderRadius: 8, cursor: "pointer", color: "#ccc",
              fontSize: 14, textAlign: "left", transition: "background 0.1s"
            }}
              onMouseOver={e => e.currentTarget.style.background = "#1a1a2e"}
              onMouseOut={e => e.currentTarget.style.background = "none"}
            >
              <span style={{ width: 20, textAlign: "center" }}>{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Add Grade Modal ──────────────────────────────────────────────────────────
const AddGradeModal = ({ open, onClose, subjects, onAdd, grades }) => {
  const [form, setForm] = useState({ subjectId: subjects[0]?.id || "", value: "", weight: 1, date: new Date().toISOString().slice(0, 10), type: "Exam" });
  const [impact, setImpact] = useState(null);

  useEffect(() => {
    if (!form.subjectId || !form.value) { setImpact(null); return; }
    const v = parseFloat(form.value);
    if (isNaN(v) || v < 1 || v > 6) { setImpact(null); return; }
    const subGrades = grades.filter(g => g.subjectId === form.subjectId);
    const before = calcWeightedAvg(subGrades);
    const after = calcWeightedAvg([...subGrades, { value: v, weight: Number(form.weight) }]);
    setImpact({ before, after, diff: after !== null && before !== null ? +(after - before).toFixed(2) : null });
  }, [form.value, form.subjectId, form.weight, grades]);

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const submit = () => {
    const v = parseFloat(form.value);
    if (!form.subjectId || isNaN(v) || v < 1 || v > 6) return;
    onAdd({ ...form, value: v, weight: Number(form.weight) });
    setForm(p => ({ ...p, value: "", weight: 1 }));
    onClose();
  };

  const kd = (e) => e.key === "Enter" && submit();

  return (
    <Modal open={open} onClose={onClose} title="Add Grade">
      <Input label="Subject" value={form.subjectId} onChange={f("subjectId")} options={subjects.map(s => ({ value: s.id, label: s.name }))} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Grade (1.0 – 6.0)" type="number" value={form.value} onChange={f("value")} min={1} max={6} step={0.5} placeholder="2.0" autoFocus onKeyDown={kd} />
        <Input label="Weight" type="number" value={form.weight} onChange={f("weight")} min={0.5} max={5} step={0.5} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Date" type="date" value={form.date} onChange={f("date")} />
        <Input label="Type" value={form.type} onChange={f("type")} options={["Exam", "Oral", "Homework"].map(t => ({ value: t, label: t }))} />
      </div>

      {impact && impact.before !== null && impact.after !== null && (
        <div style={{ background: "#0a0a16", border: "1px solid #1e1e2e", borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>Grade Impact Preview</div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#555" }}>Before</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: GRADE_COLOR(impact.before) }}>{impact.before.toFixed(2)}</div>
            </div>
            <div style={{ color: "#333", fontSize: 20 }}>→</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#555" }}>After</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: GRADE_COLOR(impact.after) }}>{impact.after.toFixed(2)}</div>
            </div>
            {impact.diff !== null && (
              <div style={{ marginLeft: "auto" }}>
                <Badge color={impact.diff < 0 ? "#22c55e" : impact.diff > 0 ? "#ef4444" : "#888"}>
                  {impact.diff < 0 ? "▲" : impact.diff > 0 ? "▼" : "—"} {Math.abs(impact.diff).toFixed(2)}
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit} disabled={!form.value || parseFloat(form.value) < 1 || parseFloat(form.value) > 6}>Add Grade</Btn>
      </div>
    </Modal>
  );
};

// ─── Subject Modal ────────────────────────────────────────────────────────────
const SubjectModal = ({ open, onClose, onSave, initial }) => {
  const [form, setForm] = useState(initial || { name: "", weight: 1, target: 2.0 });
  useEffect(() => { if (open) setForm(initial || { name: "", weight: 1, target: 2.0 }); }, [open, initial]);
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const submit = () => {
    if (!form.name.trim()) return;
    onSave({ ...form, weight: Number(form.weight), target: Number(form.target) });
    onClose();
  };
  const kd = (e) => e.key === "Enter" && submit();
  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit Subject" : "Add Subject"} width={400}>
      <Input label="Subject Name" value={form.name} onChange={f("name")} placeholder="e.g. Mathematics" autoFocus onKeyDown={kd} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Weight" type="number" value={form.weight} onChange={f("weight")} min={0.5} max={5} step={0.5} />
        <Input label="Target Grade" type="number" value={form.target} onChange={f("target")} min={1} max={6} step={0.5} />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit} disabled={!form.name.trim()}>{initial ? "Save" : "Add Subject"}</Btn>
      </div>
    </Modal>
  );
};

// ─── Nav ──────────────────────────────────────────────────────────────────────
const Nav = ({ page, setPage }) => {
  const items = [
    { id: "dashboard", icon: "⌂", label: "Dashboard" },
    { id: "subjects", icon: "📖", label: "Subjects" },
    { id: "stats", icon: "📊", label: "Statistics" },
    { id: "planner", icon: "📅", label: "Planner" },
  ];
  return (
    <>
      {/* Desktop sidebar */}
      <nav style={{
        position: "fixed", left: 0, top: 0, bottom: 0, width: 220,
        background: "#080812", borderRight: "1px solid #1a1a2e",
        display: "flex", flexDirection: "column", padding: "24px 12px",
        zIndex: 100
      }}>
        <div style={{ padding: "8px 12px", marginBottom: 32 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e2f0", letterSpacing: "-0.02em" }}>GradeTrack</div>
          <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>Academic Dashboard</div>
        </div>
        {items.map(it => (
          <button key={it.id} onClick={() => setPage(it.id)} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
            borderRadius: 8, border: "none", cursor: "pointer",
            background: page === it.id ? "#1a1a2e" : "transparent",
            color: page === it.id ? "#e2e2f0" : "#555",
            fontSize: 14, fontWeight: page === it.id ? 600 : 400,
            transition: "all 0.15s", marginBottom: 2, textAlign: "left", width: "100%",
            borderLeft: page === it.id ? `2px solid ${ACCENT}` : "2px solid transparent"
          }}
            onMouseOver={e => page !== it.id && (e.currentTarget.style.color = "#aaa")}
            onMouseOut={e => page !== it.id && (e.currentTarget.style.color = "#555")}
          >
            <span style={{ fontSize: 16 }}>{it.icon}</span>
            {it.label}
          </button>
        ))}
        <div style={{ marginTop: "auto", padding: "8px 12px", fontSize: 11, color: "#333" }}>
          <div style={{ marginBottom: 4 }}><Kbd>⌘K</Kbd> Command Palette</div>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, height: 60,
        background: "#080812", borderTop: "1px solid #1a1a2e",
        display: "none", alignItems: "center", justifyContent: "space-around",
        zIndex: 100, paddingBottom: "env(safe-area-inset-bottom)"
      }} className="mobile-nav">
        {items.map(it => (
          <button key={it.id} onClick={() => setPage(it.id)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            background: "none", border: "none", cursor: "pointer",
            color: page === it.id ? ACCENT : "#555", fontSize: 10, padding: "8px 12px"
          }}>
            <span style={{ fontSize: 20 }}>{it.icon}</span>
            {it.label}
          </button>
        ))}
      </nav>
    </>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = ({ grades, subjects, exams, xp, level, achievements, loading }) => {
  const avg = calcWeightedAvg(grades);
  const recentGrades = [...grades].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  const subjectAvgs = subjects.map(s => ({ ...s, avg: calcSubjectAvg(grades, s.id) })).filter(s => s.avg !== null);
  const best = subjectAvgs.sort((a, b) => a.avg - b.avg)[0];
  const worst = subjectAvgs.sort((a, b) => b.avg - a.avg)[0];

  const upcoming = [...exams]
    .filter(e => daysUntil(e.date) >= 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);

  const trend = (() => {
    if (grades.length < 4) return null;
    const sorted = [...grades].sort((a, b) => new Date(a.date) - new Date(b.date));
    const half = Math.floor(sorted.length / 2);
    const first = calcWeightedAvg(sorted.slice(0, half));
    const second = calcWeightedAvg(sorted.slice(half));
    if (first === null || second === null) return null;
    return second < first ? "improving" : second > first ? "declining" : "stable";
  })();

  const xpInLevel = xp % LEVEL_XP;
  const xpPct = xpInLevel / LEVEL_XP;

  if (loading) return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {[1, 2, 3].map(i => <Card key={i}><Skeleton h={80} /></Card>)}
      </div>
      <Card><Skeleton h={200} /></Card>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Top row */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Average */}
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 32, minWidth: 200 }}>
          <div style={{ position: "relative", width: 160, height: 160 }}>
            <ProgressRing value={avg} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: avg ? GRADE_COLOR(avg) : "#333", letterSpacing: "-0.04em", lineHeight: 1 }}>
                {avg ? <CountUp to={avg} /> : "—"}
              </div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{avg ? GRADE_LABEL(avg) : "No grades"}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#555" }}>Overall Average</div>
          {trend && (
            <Badge color={trend === "improving" ? "#22c55e" : trend === "declining" ? "#ef4444" : "#888"}>
              {trend === "improving" ? "↑ Improving" : trend === "declining" ? "↓ Declining" : "→ Stable"}
            </Badge>
          )}
        </Card>

        {/* Best & Worst */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>Strongest Subject</div>
            {best ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#e2e2f0", marginBottom: 4 }}>{best.name}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: GRADE_COLOR(best.avg) }}>{best.avg.toFixed(2)}</div>
              </>
            ) : <div style={{ color: "#333", fontSize: 14 }}>No data yet</div>}
          </Card>
          <Card style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>Needs Attention</div>
            {worst ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#e2e2f0", marginBottom: 4 }}>{worst.name}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: GRADE_COLOR(worst.avg) }}>{worst.avg.toFixed(2)}</div>
              </>
            ) : <div style={{ color: "#333", fontSize: 14 }}>No data yet</div>}
          </Card>
        </div>

        {/* XP & Achievements */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e2f0" }}>Level {level}</div>
              <Badge>{xpInLevel} / {LEVEL_XP} XP</Badge>
            </div>
            <div style={{ height: 6, background: "#1a1a2e", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${xpPct * 100}%`, background: ACCENT,
                borderRadius: 99, transition: "width 1s cubic-bezier(.4,0,.2,1)",
                boxShadow: `0 0 8px ${ACCENT_GLOW}`
              }} />
            </div>
            <div style={{ fontSize: 11, color: "#444", marginTop: 6 }}>{Math.round((1 - xpPct) * LEVEL_XP)} XP to Level {level + 1}</div>
          </Card>
          <Card style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>Achievements</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ACHIEVEMENTS.map(a => (
                <span key={a.id} title={a.desc} style={{
                  fontSize: 20, opacity: achievements.includes(a.id) ? 1 : 0.2,
                  filter: achievements.includes(a.id) ? "none" : "grayscale(1)",
                  transition: "all 0.3s"
                }}>{a.icon}</span>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Recent Grades */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e2f0", marginBottom: 16 }}>Recent Grades</div>
          {recentGrades.length === 0 ? (
            <div style={{ color: "#333", fontSize: 14, textAlign: "center", padding: "24px 0" }}>No grades yet. Add your first grade!</div>
          ) : recentGrades.map(g => {
            const subject = subjects.find(s => s.id === g.subjectId);
            return (
              <div key={g.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0", borderBottom: "1px solid #1a1a2e"
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#ccc" }}>{subject?.name || "Unknown"}</div>
                  <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>{g.type} · {g.date}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: GRADE_COLOR(g.value) }}>{g.value.toFixed(1)}</div>
              </div>
            );
          })}
        </Card>

        {/* Upcoming Exams */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e2f0", marginBottom: 16 }}>Upcoming Exams</div>
          {upcoming.length === 0 ? (
            <div style={{ color: "#333", fontSize: 14, textAlign: "center", padding: "24px 0" }}>No upcoming exams</div>
          ) : upcoming.map(ex => {
            const subject = subjects.find(s => s.id === ex.subjectId);
            const days = daysUntil(ex.date);
            return (
              <div key={ex.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 0", borderBottom: "1px solid #1a1a2e"
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#ccc" }}>{ex.title}</div>
                  <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>{subject?.name} · {ex.date}</div>
                </div>
                <Badge color={days <= 3 ? "#ef4444" : days <= 7 ? "#f97316" : ACCENT}>
                  {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                </Badge>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
};

// ─── Subjects Page ────────────────────────────────────────────────────────────
const SubjectsPage = ({ subjects, grades, onAdd, onEdit, onDelete }) => {
  const [modal, setModal] = useState(null); // null | "add" | subject

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#e2e2f0" }}>Subjects</h2>
          <p style={{ margin: "4px 0 0", color: "#555", fontSize: 14 }}>{subjects.length} subjects tracked</p>
        </div>
        <Btn onClick={() => setModal("add")}>+ Add Subject</Btn>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {subjects.map(s => {
          const avg = calcSubjectAvg(grades, s.id);
          const subGrades = grades.filter(g => g.subjectId === s.id);
          const toTarget = avg !== null ? (() => {
            // Required next grade = (target * (totalW + 1) - currentWSum) / 1
            const totalW = subGrades.reduce((a, g) => a + g.weight, 0);
            const wSum = subGrades.reduce((a, g) => a + g.value * g.weight, 0);
            const req = s.target * (totalW + 1) - wSum;
            return Math.max(1, Math.min(6, +req.toFixed(2)));
          })() : null;

          return (
            <Card key={s.id}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 4, alignSelf: "stretch", borderRadius: 99, background: s.color || ACCENT, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#e2e2f0" }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>Weight ×{s.weight} · {subGrades.length} grades · Target: {s.target.toFixed(1)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {avg !== null && (
                        <div style={{ fontSize: 28, fontWeight: 800, color: GRADE_COLOR(avg) }}>{avg.toFixed(2)}</div>
                      )}
                      {avg === null && <div style={{ fontSize: 14, color: "#333" }}>No grades</div>}
                    </div>
                  </div>

                  {/* Progress toward target */}
                  {avg !== null && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginBottom: 4 }}>
                        <span>Progress to target ({s.target.toFixed(1)})</span>
                        {avg <= s.target
                          ? <span style={{ color: "#22c55e" }}>✓ On target</span>
                          : <span style={{ color: "#f97316" }}>Need {toTarget} next</span>
                        }
                      </div>
                      <div style={{ height: 4, background: "#1a1a2e", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${Math.min(100, Math.max(0, ((GRADE_MAX - avg) / (GRADE_MAX - s.target)) * 100))}%`,
                          background: avg <= s.target ? "#22c55e" : GRADE_COLOR(avg),
                          borderRadius: 99, transition: "width 0.8s ease"
                        }} />
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Btn variant="ghost" size="sm" onClick={() => setModal(s)}>Edit</Btn>
                  <Btn variant="danger" size="sm" onClick={() => onDelete(s.id)}>Delete</Btn>
                </div>
              </div>
            </Card>
          );
        })}

        {subjects.length === 0 && (
          <Card style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
            <div style={{ fontSize: 16, color: "#555", marginBottom: 16 }}>No subjects yet</div>
            <Btn onClick={() => setModal("add")}>Add your first subject</Btn>
          </Card>
        )}
      </div>

      <SubjectModal
        open={modal !== null}
        onClose={() => setModal(null)}
        onSave={modal === "add" ? onAdd : (data) => onEdit(modal.id, data)}
        initial={modal !== "add" && modal !== null ? modal : null}
      />
    </div>
  );
};

// ─── Statistics Page ──────────────────────────────────────────────────────────
const StatsPage = ({ grades, subjects }) => {
  const [range, setRange] = useState("semester");

  const ranges = [
    { id: "7d", label: "7 Days" },
    { id: "30d", label: "30 Days" },
    { id: "semester", label: "Semester" },
    { id: "all", label: "All Time" },
  ];

  const filterGrades = (gs) => {
    const now = new Date();
    const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "semester" ? 180 : Infinity;
    return gs.filter(g => (now - new Date(g.date)) / 86400000 <= days);
  };

  const filtered = filterGrades(grades);

  // Line chart: grade over time
  const lineData = (() => {
    const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
    const acc = [];
    sorted.forEach((g, i) => {
      const sub = subjects.find(s => s.id === g.subjectId);
      acc.push({
        date: g.date.slice(5),
        grade: g.value,
        subject: sub?.name || "?",
        avg: calcWeightedAvg(sorted.slice(0, i + 1))
      });
    });
    return acc;
  })();

  // Bar chart: subject averages
  const barData = subjects.map(s => ({
    name: s.name.slice(0, 8),
    avg: calcSubjectAvg(filtered, s.id) || 0,
    target: s.target,
    fill: GRADE_COLOR(calcSubjectAvg(filtered, s.id) || 4)
  })).filter(d => d.avg > 0);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "#0d0d1a", border: "1px solid #2a2a3e", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
        <div style={{ color: "#888", marginBottom: 4 }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: GRADE_COLOR(p.value), fontWeight: 600 }}>
            {p.name}: {p.value?.toFixed(2)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#e2e2f0" }}>Statistics</h2>
          <p style={{ margin: "4px 0 0", color: "#555", fontSize: 14 }}>{filtered.length} grades in range</p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 8, padding: 4 }}>
          {ranges.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)} style={{
              padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer",
              background: range === r.id ? "#1a1a2e" : "transparent",
              color: range === r.id ? "#e2e2f0" : "#555",
              fontSize: 13, fontWeight: range === r.id ? 600 : 400, transition: "all 0.15s"
            }}>{r.label}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 16, color: "#555" }}>No grades in this period</div>
        </Card>
      ) : (
        <>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e2f0", marginBottom: 16 }}>Grade Development</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={lineData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="#1a1a2e" strokeDasharray="4 4" />
                <XAxis dataKey="date" stroke="#333" tick={{ fill: "#555", fontSize: 11 }} />
                <YAxis domain={[1, 6]} reversed stroke="#333" tick={{ fill: "#555", fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={4} stroke="#ef444433" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="grade" stroke="#2563EB44" strokeWidth={1} dot={{ fill: ACCENT, r: 4, strokeWidth: 0 }} name="Grade" />
                <Line type="monotone" dataKey="avg" stroke={ACCENT} strokeWidth={2} dot={false} name="Avg" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e2f0", marginBottom: 16 }}>Subject Comparison</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="#1a1a2e" strokeDasharray="4 4" />
                <XAxis dataKey="name" stroke="#333" tick={{ fill: "#555", fontSize: 11 }} />
                <YAxis domain={[0, 6]} reversed stroke="#333" tick={{ fill: "#555", fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={4} stroke="#ef444433" strokeDasharray="4 4" />
                <Bar dataKey="avg" name="Average" radius={[4, 4, 0, 0]}>
                  {barData.map((d, i) => (
                    <rect key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Average", value: calcWeightedAvg(filtered)?.toFixed(2) || "—" },
              { label: "Best Grade", value: Math.min(...filtered.map(g => g.value)).toFixed(1) },
              { label: "Worst Grade", value: Math.max(...filtered.map(g => g.value)).toFixed(1) },
              { label: "Total Grades", value: filtered.length },
            ].map(stat => (
              <Card key={stat.label} style={{ padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#e2e2f0" }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{stat.label}</div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Planner ──────────────────────────────────────────────────────────────────
const PlannerPage = ({ exams, subjects, onAddExam, onToggleReminder, onDeleteExam }) => {
  const [month, setMonth] = useState(new Date());
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ subjectId: subjects[0]?.id || "", title: "", date: "", reminder: false });

  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDay = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();

  const examsByDate = useMemo(() => {
    const map = {};
    exams.forEach(e => { if (!map[e.date]) map[e.date] = []; map[e.date].push(e); });
    return map;
  }, [exams]);

  const upcoming = [...exams]
    .filter(e => daysUntil(e.date) >= 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const monthStr = month.toLocaleString("default", { month: "long", year: "numeric" });

  const submit = () => {
    if (!form.subjectId || !form.title || !form.date) return;
    onAddExam({ ...form });
    setAddModal(false);
    setForm(p => ({ ...p, title: "", date: "" }));
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#e2e2f0" }}>Exam Planner</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Btn variant="ghost" size="sm" onClick={() => setMonth(new Date(year, mon - 1))}>←</Btn>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#ccc", minWidth: 140, textAlign: "center" }}>{monthStr}</span>
            <Btn variant="ghost" size="sm" onClick={() => setMonth(new Date(year, mon + 1))}>→</Btn>
          </div>
        </div>

        <Card style={{ padding: 16 }}>
          {/* Weekday headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#444", padding: "4px 0" }}>{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(mon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayExams = examsByDate[dateStr] || [];
              const isToday = dateStr === new Date().toISOString().slice(0, 10);
              return (
                <div key={day} style={{
                  minHeight: 52, padding: 4, borderRadius: 6,
                  background: isToday ? "#2563EB11" : "#0a0a16",
                  border: isToday ? `1px solid ${ACCENT}44` : "1px solid #1a1a2e",
                  position: "relative"
                }}>
                  <div style={{ fontSize: 11, color: isToday ? ACCENT : "#555", fontWeight: isToday ? 700 : 400 }}>{day}</div>
                  {dayExams.map(ex => (
                    <div key={ex.id} style={{
                      fontSize: 10, color: ACCENT, marginTop: 2,
                      background: ACCENT + "22", borderRadius: 3, padding: "1px 3px",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                    }}>{ex.title}</div>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Upcoming sidebar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e2f0" }}>Upcoming</div>
          <Btn size="sm" onClick={() => setAddModal(true)}>+ Add</Btn>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {upcoming.map(ex => {
            const subject = subjects.find(s => s.id === ex.subjectId);
            const days = daysUntil(ex.date);
            return (
              <Card key={ex.id} style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e2f0" }}>{ex.title}</div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{subject?.name}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
                      <Badge color={days <= 3 ? "#ef4444" : days <= 7 ? "#f97316" : ACCENT}>
                        {days === 0 ? "Today" : `${days}d`}
                      </Badge>
                      <button onClick={() => onToggleReminder(ex.id)} style={{
                        background: "none", border: "none", cursor: "pointer", fontSize: 14,
                        opacity: ex.reminder ? 1 : 0.3, padding: 0
                      }}>🔔</button>
                    </div>
                  </div>
                  <Btn variant="danger" size="sm" onClick={() => onDeleteExam(ex.id)}>✕</Btn>
                </div>
              </Card>
            );
          })}
          {upcoming.length === 0 && (
            <Card style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🎉</div>
              <div style={{ fontSize: 13, color: "#555" }}>No upcoming exams</div>
            </Card>
          )}
        </div>
      </div>

      {/* Add exam modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Exam" width={400}>
        <Input label="Subject" value={form.subjectId} onChange={e => setForm(p => ({ ...p, subjectId: e.target.value }))} options={subjects.map(s => ({ value: s.id, label: s.name }))} />
        <Input label="Exam Title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Midterm Exam" autoFocus />
        <Input label="Date" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setAddModal(false)}>Cancel</Btn>
          <Btn onClick={submit} disabled={!form.title || !form.date}>Add Exam</Btn>
        </div>
      </Modal>
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [subjects, setSubjects] = useLocalStorage("gt_subjects", INITIAL_SUBJECTS);
  const [grades, setGrades] = useLocalStorage("gt_grades", INITIAL_GRADES);
  const [exams, setExams] = useLocalStorage("gt_exams", INITIAL_EXAMS);
  const [xp, setXp] = useLocalStorage("gt_xp", 0);
  const [achievements, setAchievements] = useLocalStorage("gt_achievements", []);
  const [page, setPage] = useState("dashboard");
  const [addGradeOpen, setAddGradeOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setTimeout(() => setLoading(false), 800); }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const level = Math.floor(xp / LEVEL_XP) + 1;

  const toast = (message, type = "success") => {
    const id = uid();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };

  const checkAchievements = useCallback((newGrades) => {
    const stats = {
      totalGrades: newGrades.length,
      avg: calcWeightedAvg(newGrades)
    };
    const unlocked = [];
    ACHIEVEMENTS.forEach(a => {
      if (!achievements.includes(a.id) && a.condition(stats)) {
        unlocked.push(a.id);
        toast(`Achievement unlocked: ${a.label} ${a.icon}`, "achievement");
      }
    });
    if (unlocked.length) setAchievements(prev => [...prev, ...unlocked]);
  }, [achievements]);

  const addGrade = (grade) => {
    const newGrade = { ...grade, id: `g${uid()}` };
    const newGrades = [...grades, newGrade];
    setGrades(newGrades);
    const newXp = xp + XP_PER_GRADE;
    setXp(newXp);
    if (Math.floor(newXp / LEVEL_XP) > Math.floor(xp / LEVEL_XP)) {
      toast(`Level up! You reached Level ${Math.floor(newXp / LEVEL_XP) + 1} 🎉`, "achievement");
    } else {
      toast(`Grade added (+${XP_PER_GRADE} XP)`);
    }
    checkAchievements(newGrades);
  };

  const addSubject = (data) => {
    setSubjects([...subjects, { ...data, id: `s${uid()}`, color: `hsl(${Math.random() * 360}, 70%, 55%)` }]);
    toast("Subject added");
  };

  const editSubject = (id, data) => {
    setSubjects(subjects.map(s => s.id === id ? { ...s, ...data } : s));
    toast("Subject updated");
  };

  const deleteSubject = (id) => {
    setSubjects(subjects.filter(s => s.id !== id));
    setGrades(grades.filter(g => g.subjectId !== id));
    toast("Subject deleted");
  };

  const addExam = (data) => {
    setExams([...exams, { ...data, id: `e${uid()}` }]);
    toast("Exam added");
  };

  const toggleReminder = (id) => {
    setExams(exams.map(e => e.id === id ? { ...e, reminder: !e.reminder } : e));
  };

  const deleteExam = (id) => {
    setExams(exams.filter(e => e.id !== id));
  };

  const pages = {
    dashboard: <Dashboard grades={grades} subjects={subjects} exams={exams} xp={xp} level={level} achievements={achievements} loading={loading} />,
    subjects: <SubjectsPage subjects={subjects} grades={grades} onAdd={addSubject} onEdit={editSubject} onDelete={deleteSubject} />,
    stats: <StatsPage grades={grades} subjects={subjects} />,
    planner: <PlannerPage exams={exams} subjects={subjects} onAddExam={addExam} onToggleReminder={toggleReminder} onDeleteExam={deleteExam} />,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #080812; color: #e2e2f0; font-family: 'Geist', -apple-system, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a16; }
        ::-webkit-scrollbar-thumb { background: #2a2a3e; border-radius: 3px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.96) translateY(-8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding-bottom: 80px !important; }
          .desktop-nav { display: none !important; }
          .mobile-nav { display: flex !important; }
          .responsive-grid { grid-template-columns: 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      <Nav page={page} setPage={setPage} />

      <main className="main-content" style={{ marginLeft: 220, padding: 32, minHeight: "100vh", maxWidth: 1100, boxSizing: "border-box" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#e2e2f0", letterSpacing: "-0.03em" }}>
              {page === "dashboard" ? "Dashboard" : page === "subjects" ? "Subjects" : page === "stats" ? "Statistics" : "Planner"}
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setCmdOpen(true)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
              background: "#0d0d1a", border: "1px solid #1e1e2e", borderRadius: 8,
              color: "#555", cursor: "pointer", fontSize: 13, transition: "all 0.15s"
            }}
              onMouseOver={e => e.currentTarget.style.borderColor = "#2a2a3e"}
              onMouseOut={e => e.currentTarget.style.borderColor = "#1e1e2e"}
            >
              <span>⌕ Search</span>
              <Kbd>⌘K</Kbd>
            </button>
            <Btn onClick={() => setAddGradeOpen(true)}>+ Add Grade</Btn>
          </div>
        </div>

        {pages[page]}
      </main>

      {/* FAB for mobile */}
      <button onClick={() => setAddGradeOpen(true)} style={{
        position: "fixed", bottom: 80, right: 20, width: 52, height: 52,
        borderRadius: "50%", background: ACCENT, border: "none", cursor: "pointer",
        fontSize: 24, color: "#fff", boxShadow: `0 8px 24px ${ACCENT_GLOW}`,
        display: "none", alignItems: "center", justifyContent: "center",
        zIndex: 99
      }} className="mobile-fab">+</button>

      <AddGradeModal open={addGradeOpen} onClose={() => setAddGradeOpen(false)} subjects={subjects} onAdd={addGrade} grades={grades} />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onNav={setPage} onAddGrade={() => setAddGradeOpen(true)} />
      <Toast toasts={toasts} remove={(id) => setToasts(p => p.filter(t => t.id !== id))} />
    </>
  );
}