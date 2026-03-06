/**
 * NOTENPILOT v4 — Vollständige deutsche Schulnoten-App
 * ─────────────────────────────────────────────────────
 * Neu in v4:
 *   ✦ Auth-Flow (Login, Register, Google OAuth mockup)
 *   ✦ Combobox Subject Input (tippen + Autocomplete)
 *   ✦ Pfeilfrei angepasste Zahleneingaben
 *   ✦ Vollständig editierbarer Kalender + manuelles Datum
 *   ✦ Überarbeitete Landing Page mit korrektem German Copy
 *   ✦ Bessere visuelle Hierarchie im Formular
 *   ✦ Supabase-ready Architektur (localDB als Drop-in)
 */

import {
  useState, useEffect, useCallback, useMemo, useRef,
  memo, createContext, useContext,
} from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg0: "#060609",
  bg1: "#09090e",
  bg2: "#0d0d14",
  bg3: "#111119",
  bg4: "#16161f",
  bg5: "#1b1b26",

  line:    "#1f2030",
  lineHov: "#282940",

  acc:      "#4f6ef2",
  accHov:   "#6a85f5",
  accDim:   "#4f6ef212",
  accGlow:  "#4f6ef228",

  t0: "#eeeef5",
  t1: "#8888a0",
  t2: "#44445a",
  t3: "#282838",

  g1: "#2dd4a0",  // ≤1.3 — sehr gut
  g2: "#60d970",  // ≤2.3 — gut
  g3: "#f5c842",  // ≤3.3 — befriedigend
  g4: "#f08040",  // ≤4.3 — ausreichend
  g5: "#e05555",  // ≤5.0 — mangelhaft
  g6: "#cc2222",  // >5.0 — ungenügend

  ok:  "#2dd4a0",
  err: "#e05555",
  wrn: "#f5c842",
};

const EASE = "cubic-bezier(0.4,0,0.2,1)";
const D = { f: "100ms", b: "180ms", s: "320ms", x: "500ms" };
const R = { xs: "3px", s: "6px", m: "10px", l: "14px", xl: "18px", full: "9999px" };

const gc = (g) => {
  if (!g) return C.t2;
  if (g <= 1.3) return C.g1;
  if (g <= 2.3) return C.g2;
  if (g <= 3.3) return C.g3;
  if (g <= 4.3) return C.g4;
  if (g <= 5.0) return C.g5;
  return C.g6;
};
const gl = (g) => {
  if (!g) return "";
  if (g <= 1.5) return "Sehr gut";
  if (g <= 2.5) return "Gut";
  if (g <= 3.5) return "Befriedigend";
  if (g <= 4.5) return "Ausreichend";
  return "Mangelhaft";
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────
const uid  = () => Math.random().toString(36).slice(2, 9);
const wAvg = (gs) => {
  if (!gs?.length) return null;
  const tw = gs.reduce((s, g) => s + (g.weight ?? 1), 0);
  const ts = gs.reduce((s, g) => s + g.grade * (g.weight ?? 1), 0);
  return tw ? +(ts / tw).toFixed(2) : null;
};
const today = () => new Date().toISOString().slice(0, 10);
const fDE   = (d) => new Date(d + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const MONTHS_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const DAYS_DE   = ["So","Mo","Di","Mi","Do","Fr","Sa"];

const LEISTUNGSARTEN = [
  "Schulaufgabe","Ausfrage","Kurztest","Stegreifaufgabe",
  "Kurzarbeit","Hausaufgabe","Mitarbeit","Jahrgangsstufentest","Sonstige",
];

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE (Supabase drop-in)
// ─────────────────────────────────────────────────────────────────────────────
const db = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────
const useLS = (key, init) => {
  const [v, sv] = useState(() => db.get(key, init));
  const set = useCallback((fn) => {
    sv(prev => { const next = typeof fn === "function" ? fn(prev) : fn; db.set(key, next); return next; });
  }, [key]);
  return [v, set];
};

const useCountUp = (target, ms = 900) => {
  const [val, setVal] = useState(0);
  const prev = useRef(target);
  useEffect(() => {
    if (target == null) return;
    const from = prev.current === target ? 0 : (prev.current ?? 0);
    prev.current = target;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / ms, 1);
      const e = 1 - (1 - p) ** 3;
      setVal(+(from + (target - from) * e).toFixed(2));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return val;
};

const useClickOutside = (ref, handler) => {
  useEffect(() => {
    const fn = (e) => { if (!ref.current?.contains(e.target)) handler(); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [handler]);
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
const AppCtx   = createContext(null);
const ToastCtx = createContext(null);
const useApp   = () => useContext(AppCtx);
const useToast = () => useContext(ToastCtx);

// ─────────────────────────────────────────────────────────────────────────────
// UI ATOMS
// ─────────────────────────────────────────────────────────────────────────────

/** Shimmer skeleton */
const Sk = ({ h = 20, r = R.m, w = "100%" }) => (
  <div style={{ width: w, height: h, borderRadius: r, background: `linear-gradient(90deg,${C.bg3} 25%,${C.bg5} 50%,${C.bg3} 75%)`, backgroundSize: "400%", animation: "sk 1.6s ease infinite" }} />
);

/** Primary/ghost/danger button */
const Btn = memo(({ children, onClick, variant = "primary", size = "md", disabled, type = "button", full, icon }) => {
  const sz = { sm: "6px 13px", md: "9px 18px", lg: "12px 26px" };
  const fs = { sm: 12, md: 13, lg: 14 };
  const v = {
    primary: { bg: C.acc,       color: "#fff",  border: C.acc,       hov: C.accHov },
    ghost:   { bg: "transparent", color: C.t1, border: C.line,      hov: C.lineHov },
    danger:  { bg: "#e0555518", color: C.err, border: C.err+"28",  hov: "#e0555528" },
    subtle:  { bg: C.bg4,       color: C.t1,  border: C.line,      hov: C.bg5 },
    google:  { bg: "#fff",      color: "#1a1a2a", border: "#e0e0e8", hov: "#f5f5f5" },
  }[variant];

  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      padding: sz[size], fontSize: fs[size], fontWeight: 600,
      borderRadius: R.s, background: v.bg, color: v.color,
      border: `1px solid ${v.border}`, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1, fontFamily: "inherit",
      transition: `all ${D.f} ${EASE}`, whiteSpace: "nowrap",
      width: full ? "100%" : undefined,
    }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.background = v.hov, e.currentTarget.style.borderColor = v.hov)}
      onMouseLeave={e => !disabled && (e.currentTarget.style.background = v.bg,  e.currentTarget.style.borderColor = v.border)}
      onMouseDown={e  => !disabled && (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={e    => !disabled && (e.currentTarget.style.transform = "scale(1)")}
    >
      {icon && icon}
      {children}
    </button>
  );
});

/** Surface card */
const Card = memo(({ children, style: s, pad = "20px 24px", hover, onClick }) => (
  <div onClick={onClick} style={{
    background: C.bg2, border: `1px solid ${C.line}`, borderRadius: R.xl,
    padding: pad, transition: `border-color ${D.b} ${EASE}`,
    cursor: onClick ? "pointer" : "default", ...s,
  }}
    onMouseEnter={e => (hover || onClick) && (e.currentTarget.style.borderColor = C.lineHov)}
    onMouseLeave={e => (hover || onClick) && (e.currentTarget.style.borderColor = C.line)}
  >{children}</div>
));

/** Label */
const Lbl = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: C.t2, marginBottom: 7 }}>{children}</div>
);

/** Divider */
const HR = () => <div style={{ height: 1, background: C.line, margin: "6px 0" }} />;

/** Badge */
const Bdg = memo(({ children, color = C.acc }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", padding: "2px 9px",
    borderRadius: R.full, fontSize: 11, fontWeight: 600,
    background: color + "1e", color, border: `1px solid ${color}30`,
  }}>{children}</span>
));

// ─────────────────────────────────────────────────────────────────────────────
// BASE INPUT (no arrows, fully styled)
// ─────────────────────────────────────────────────────────────────────────────
const baseInputStyle = (focused) => ({
  width: "100%", boxSizing: "border-box",
  background: C.bg4, border: `1px solid ${focused ? C.acc : C.line}`,
  borderRadius: R.s, padding: "10px 13px",
  color: C.t0, fontSize: 14, outline: "none",
  fontFamily: "inherit",
  transition: `border-color ${D.f} ${EASE}`,
  // Remove number spinners
  MozAppearance: "textfield", appearance: "none",
});

const TextInput = memo(({ value, onChange, placeholder, autoFocus, onKeyDown, readOnly, onClick }) => {
  const [f, setF] = useState(false);
  return (
    <input value={value} onChange={onChange} placeholder={placeholder}
      autoFocus={autoFocus} onKeyDown={onKeyDown} readOnly={readOnly} onClick={onClick}
      style={{ ...baseInputStyle(f), cursor: readOnly ? "pointer" : "text" }}
      onFocus={() => setF(true)} onBlur={() => setF(false)}
    />
  );
});

const NumInput = memo(({ value, onChange, min = 1, max = 6, step = 0.5, placeholder }) => {
  const [f, setF] = useState(false);
  return (
    <input type="number" value={value} onChange={onChange} min={min} max={max} step={step}
      placeholder={placeholder}
      style={{ ...baseInputStyle(f) }}
      onFocus={() => setF(true)} onBlur={() => setF(false)}
    />
  );
});

const SelectInput = memo(({ value, onChange, options, placeholder }) => {
  const [f, setF] = useState(false);
  return (
    <select value={value} onChange={onChange} style={{ ...baseInputStyle(f), cursor: "pointer" }}
      onFocus={() => setF(true)} onBlur={() => setF(false)}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// COMBOBOX — type or pick from suggestions
// ─────────────────────────────────────────────────────────────────────────────
const Combobox = memo(({ value, onChange, options, placeholder, autoFocus }) => {
  const [query, setQuery]   = useState(value || "");
  const [open,  setOpen]    = useState(false);
  const [hi,    setHi]      = useState(-1);
  const ref  = useRef(null);
  const inRef = useRef(null);

  useClickOutside(ref, () => setOpen(false));

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q));
  }, [query, options]);

  const select = useCallback((opt) => {
    setQuery(opt); onChange(opt); setOpen(false); setHi(-1);
  }, [onChange]);

  const handleKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && hi >= 0) { e.preventDefault(); select(filtered[hi]); }
    else if (e.key === "Escape") setOpen(false);
  };

  const [f, setF] = useState(false);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        ref={inRef}
        value={query}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); setHi(-1); }}
        onFocus={() => { setF(true); setOpen(true); }}
        onBlur={() => setF(false)}
        onKeyDown={handleKey}
        style={{ ...baseInputStyle(f || open) }}
      />
      {/* dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, zIndex: 300,
          background: C.bg3, border: `1px solid ${C.lineHov}`, borderRadius: R.m,
          boxShadow: "0 16px 48px #00000099", overflow: "hidden", maxHeight: 220, overflowY: "auto",
          animation: "su 0.12s ease",
        }}>
          {filtered.length === 0 && query.trim() && (
            <button onClick={() => select(query.trim())} style={{
              width: "100%", padding: "10px 14px", background: "none", border: "none",
              cursor: "pointer", color: C.accHov, fontSize: 13, textAlign: "left", fontFamily: "inherit",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = C.bg4)}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <span style={{ color: C.t2, marginRight: 6 }}>+</span> „{query.trim()}" als neues Fach anlegen
            </button>
          )}
          {filtered.map((opt, i) => (
            <button key={opt} onMouseDown={() => select(opt)} style={{
              width: "100%", padding: "10px 14px", background: i === hi ? C.bg4 : "none",
              border: "none", cursor: "pointer", color: i === hi ? C.t0 : C.t1,
              fontSize: 13, textAlign: "left", fontFamily: "inherit",
              transition: `background ${D.f}`,
            }}
              onMouseEnter={e => (e.currentTarget.style.background = C.bg4)}
              onMouseLeave={e => (e.currentTarget.style.background = i === hi ? C.bg4 : "none")}
            >{opt}</button>
          ))}
          {query.trim() && filtered.length > 0 && (
            <div>
              <HR />
              <button onClick={() => select(query.trim())} style={{
                width: "100%", padding: "9px 14px", background: "none", border: "none",
                cursor: "pointer", color: C.acc, fontSize: 12, textAlign: "left", fontFamily: "inherit",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = C.bg4)}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                + „{query.trim()}" als neues Fach anlegen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR — fully custom, no browser defaults
// ─────────────────────────────────────────────────────────────────────────────
const Calendar = memo(({ value, onChange, onClose }) => {
  const today_s = today();
  const init = value || today_s;
  const [yr, setYr] = useState(parseInt(init.slice(0, 4)));
  const [mo, setMo] = useState(parseInt(init.slice(5, 7)) - 1);
  const [manualVal, setManualVal] = useState(value ? fDE(value) : "");
  const [manualErr, setManualErr] = useState("");

  const firstDow = new Date(yr, mo, 1).getDay();
  const dInM     = new Date(yr, mo + 1, 0).getDate();
  const selDate  = value ? new Date(value + "T12:00:00") : null;

  const pick = (d) => {
    const ds = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    onChange(ds);
    setManualVal(fDE(ds));
    setManualErr("");
  };

  const handleManual = (e) => {
    const v = e.target.value;
    setManualVal(v);
    // parse DD.MM.YYYY
    const m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) {
      const [, d, mo_, yr_] = m;
      const dt = new Date(+yr_, +mo_ - 1, +d);
      if (!isNaN(dt)) {
        const ds = `${yr_}-${String(+mo_).padStart(2, "0")}-${String(+d).padStart(2, "0")}`;
        onChange(ds);
        setYr(+yr_); setMo(+mo_ - 1);
        setManualErr("");
        return;
      }
    }
    if (v.length >= 8) setManualErr("Format: TT.MM.JJJJ");
    else setManualErr("");
  };

  const prevMo = () => { if (mo === 0) { setMo(11); setYr(y => y - 1); } else setMo(m => m - 1); };
  const nextMo = () => { if (mo === 11) { setMo(0); setYr(y => y + 1); } else setMo(m => m + 1); };

  return (
    <div style={{
      background: C.bg2, border: `1px solid ${C.lineHov}`, borderRadius: R.xl,
      padding: 18, boxShadow: "0 24px 60px #00000099", width: 280,
      animation: "su 0.15s ease",
    }}>
      {/* Manual entry */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: C.t2, marginBottom: 5, letterSpacing: "0.06em" }}>Datum (TT.MM.JJJJ)</div>
        <input value={manualVal} onChange={handleManual} placeholder="z.B. 15.03.2025"
          style={{ ...baseInputStyle(false), fontSize: 13 }} />
        {manualErr && <div style={{ fontSize: 10, color: C.err, marginTop: 4 }}>{manualErr}</div>}
      </div>

      {/* Month nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button onClick={prevMo} style={{ background: "none", border: "none", cursor: "pointer", color: C.t1, fontSize: 16, padding: "2px 7px", borderRadius: R.s, transition: `color ${D.f}` }}
          onMouseEnter={e => (e.currentTarget.style.color = C.t0)} onMouseLeave={e => (e.currentTarget.style.color = C.t1)}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.t0 }}>{MONTHS_DE[mo]} {yr}</span>
        <button onClick={nextMo} style={{ background: "none", border: "none", cursor: "pointer", color: C.t1, fontSize: 16, padding: "2px 7px", borderRadius: R.s, transition: `color ${D.f}` }}
          onMouseEnter={e => (e.currentTarget.style.color = C.t0)} onMouseLeave={e => (e.currentTarget.style.color = C.t1)}>›</button>
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 3 }}>
        {DAYS_DE.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: C.t2, padding: "2px 0" }}>{d}</div>)}
      </div>

      {/* Days */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {Array.from({ length: firstDow }).map((_, i) => <div key={`p${i}`} />)}
        {Array.from({ length: dInM }).map((_, i) => {
          const d = i + 1;
          const ds = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const isSel = selDate && selDate.getDate() === d && selDate.getMonth() === mo && selDate.getFullYear() === yr;
          const isTod = ds === today_s;
          return (
            <button key={d} onClick={() => { pick(d); onClose?.(); }} style={{
              padding: "6px 2px", textAlign: "center", fontSize: 12, borderRadius: R.s,
              background: isSel ? C.acc : "transparent",
              color: isSel ? "#fff" : isTod ? C.accHov : C.t1,
              border: isTod && !isSel ? `1px solid ${C.acc}50` : "1px solid transparent",
              cursor: "pointer", fontFamily: "inherit", fontWeight: isSel ? 700 : 400,
              transition: `all ${D.f} ${EASE}`,
            }}
              onMouseEnter={e => !isSel && (e.currentTarget.style.background = C.bg4)}
              onMouseLeave={e => !isSel && (e.currentTarget.style.background = "transparent")}
            >{d}</button>
          );
        })}
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
        <Btn variant="ghost" size="sm" onClick={onClose}>Schließen</Btn>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────────────────────
const Modal = memo(({ open, onClose, title, children, width = 520 }) => {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "#000000a8", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, animation: "fi .15s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: width,
        background: C.bg2, border: `1px solid ${C.lineHov}`, borderRadius: R.xl,
        padding: "28px 32px",
        boxShadow: "0 48px 96px #00000099",
        animation: "su .2s cubic-bezier(.4,0,.2,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.t0, letterSpacing: "-0.02em" }}>{title}</h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer", color: C.t2,
            fontSize: 17, padding: "3px 7px", borderRadius: R.s, lineHeight: 1,
            transition: `color ${D.f} ${EASE}`,
          }}
            onMouseEnter={e => (e.currentTarget.style.color = C.t0)}
            onMouseLeave={e => (e.currentTarget.style.color = C.t2)}
          >✕</button>
        </div>
        {children}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────
const ToastProvider = ({ children }) => {
  const [ts, setTs] = useState([]);
  const push = useCallback((msg, type = "ok") => {
    const id = uid();
    setTs(p => [...p, { id, msg, type }]);
    setTimeout(() => setTs(p => p.filter(t => t.id !== id)), 3400);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 1000, display: "flex", flexDirection: "column", gap: 8 }}>
        {ts.map(t => (
          <div key={t.id} onClick={() => setTs(p => p.filter(x => x.id !== t.id))} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "11px 16px",
            background: C.bg3, border: `1px solid ${t.type === "err" ? C.err + "40" : C.acc + "40"}`,
            borderRadius: R.m, cursor: "pointer",
            boxShadow: "0 8px 32px #00000066",
            animation: "si .18s ease", fontSize: 13, color: C.t0, maxWidth: 320,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
              background: t.type === "err" ? C.err : C.ok }} />
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH PAGE
// ─────────────────────────────────────────────────────────────────────────────
const AuthPage = memo(({ onAuth }) => {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail]   = useState("");
  const [pass,  setPass]    = useState("");
  const [name,  setName]    = useState("");
  const [err,   setErr]     = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const validate = () => {
    if (!email.includes("@")) { setErr("Bitte gib eine gültige E-Mail ein."); return false; }
    if (pass.length < 6)       { setErr("Das Passwort muss mindestens 6 Zeichen haben."); return false; }
    if (mode === "register" && !name.trim()) { setErr("Bitte gib deinen Namen ein."); return false; }
    return true;
  };

  const submit = async () => {
    if (!validate()) return;
    setLoading(true); setErr("");
    await new Promise(r => setTimeout(r, 900)); // simulate Supabase call
    toast(mode === "login" ? "Willkommen zurück!" : "Konto erstellt. Willkommen!");
    onAuth({ email, name: name || email.split("@")[0] });
    setLoading(false);
  };

  const googleAuth = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    toast("Mit Google angemeldet!");
    onAuth({ email: "nutzer@gmail.com", name: "Schüler", google: true });
    setLoading(false);
  };

  const GoogleIcon = () => (
    <svg width={16} height={16} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );

  return (
    <div style={{
      minHeight: "100vh", background: C.bg0,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      {/* Background grid decoration */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
        backgroundSize: "40px 40px", opacity: 0.4,
        maskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 100%)",
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400 }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: R.m, background: C.acc, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: C.t0, letterSpacing: "-0.03em" }}>Notenpilot</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.t0, letterSpacing: "-0.02em", marginBottom: 6 }}>
            {mode === "login" ? "Willkommen zurück" : "Konto erstellen"}
          </h1>
          <p style={{ fontSize: 13, color: C.t1 }}>
            {mode === "login"
              ? "Melde dich an, um deine Noten zu verwalten."
              : "Erstelle deinen Account und starte jetzt."}
          </p>
        </div>

        <Card pad="28px 32px">
          {/* Google Sign In */}
          <Btn variant="google" full onClick={googleAuth} disabled={loading}
            icon={<GoogleIcon />}
          >
            Mit Google {mode === "login" ? "anmelden" : "registrieren"}
          </Btn>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
            <HR /> <span style={{ fontSize: 11, color: C.t2, flexShrink: 0, letterSpacing: "0.06em" }}>ODER</span> <HR />
          </div>

          {/* Fields */}
          {mode === "register" && (
            <div style={{ marginBottom: 14 }}>
              <Lbl>Name</Lbl>
              <TextInput value={name} onChange={e => setName(e.target.value)} placeholder="Dein Name" autoFocus={mode === "register"} />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <Lbl>E-Mail-Adresse</Lbl>
            <TextInput value={email} onChange={e => setEmail(e.target.value)}
              placeholder="name@schule.de" autoFocus={mode === "login"} />
          </div>

          <div style={{ marginBottom: 6 }}>
            <Lbl>Passwort</Lbl>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)}
              placeholder={mode === "register" ? "Mindestens 6 Zeichen" : "Passwort"}
              onKeyDown={e => e.key === "Enter" && submit()}
              style={{ ...baseInputStyle(false) }}
            />
          </div>

          {err && <div style={{ fontSize: 12, color: C.err, margin: "8px 0 2px" }}>{err}</div>}

          <div style={{ marginTop: 18 }}>
            <Btn full disabled={loading} onClick={submit}>
              {loading
                ? <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ width: 12, height: 12, border: `2px solid #ffffff60`, borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                    Bitte warten…
                  </span>
                : mode === "login" ? "Anmelden" : "Konto erstellen"
              }
            </Btn>
          </div>

          <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: C.t1 }}>
            {mode === "login" ? "Noch kein Konto? " : "Bereits registriert? "}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }} style={{
              background: "none", border: "none", cursor: "pointer", color: C.acc,
              fontSize: 13, fontFamily: "inherit", fontWeight: 600,
              transition: `color ${D.f}`,
            }}
              onMouseEnter={e => (e.currentTarget.style.color = C.accHov)}
              onMouseLeave={e => (e.currentTarget.style.color = C.acc)}
            >
              {mode === "login" ? "Registrieren" : "Anmelden"}
            </button>
          </div>
        </Card>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: C.t2 }}>
          Alle Daten sicher gespeichert · Kein Tracking
        </p>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GRADE FORM — completely redesigned
// ─────────────────────────────────────────────────────────────────────────────
const GradeForm = memo(({ onClose, editItem }) => {
  const { grades, setGrades, subjects, setSubjects } = useApp();
  const toast = useToast();

  const [form, setForm] = useState(() => editItem
    ? { ...editItem, grade: String(editItem.grade), weight: String(editItem.weight ?? 1) }
    : { subject: "", grade: "", weight: "1", date: today(), type: "" }
  );
  const [showCal, setShowCal] = useState(false);
  const [errors, setErrors] = useState({});
  const calRef = useRef(null);

  useClickOutside(calRef, () => setShowCal(false));

  const set = (k) => (v) => setForm(p => {
    const next = { ...p, [k]: v };
    if (k === "type" && v === "Schulaufgabe" && p.weight === "1") next.weight = "2";
    return next;
  });
  const setE = (k) => (e) => set(k)(e.target.value);

  const validate = () => {
    const e = {};
    if (!form.subject.trim()) e.subject = "Pflichtfeld";
    const g = parseFloat(form.grade);
    if (!form.grade || isNaN(g) || g < 1 || g > 6) e.grade = "Note zwischen 1,0 und 6,0";
    if (!form.type) e.type = "Pflichtfeld";
    if (!form.date) e.date = "Pflichtfeld";
    setErrors(e); return !Object.keys(e).length;
  };

  const submit = () => {
    if (!validate()) return;
    const subj = form.subject.trim();
    if (subj && !subjects.includes(subj)) setSubjects(p => [...p, subj]);
    const entry = { ...form, subject: subj, grade: parseFloat(form.grade), weight: parseFloat(form.weight) || 1 };
    if (editItem) {
      setGrades(p => p.map(g => g.id === editItem.id ? { ...entry, id: editItem.id } : g));
      toast("Note aktualisiert.");
    } else {
      setGrades(p => [...p, { ...entry, id: `g${uid()}` }]);
      toast("Note gespeichert.");
    }
    onClose();
  };

  const gradeNum = parseFloat(form.grade);
  const gradeOk  = !isNaN(gradeNum) && gradeNum >= 1 && gradeNum <= 6;

  return (
    <div style={{ display: "grid", gap: 0 }}>
      {/* Subject — Combobox */}
      <div style={{ marginBottom: 18 }}>
        <Lbl>Fach</Lbl>
        <Combobox
          value={form.subject} onChange={set("subject")}
          options={subjects} placeholder="Fach eingeben oder wählen…"
          autoFocus
        />
        {errors.subject && <div style={{ fontSize: 11, color: C.err, marginTop: 4 }}>{errors.subject}</div>}
      </div>

      {/* Grade + weight side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        <div>
          <Lbl>Note (1 – 6)</Lbl>
          <div style={{ position: "relative" }}>
            <NumInput value={form.grade} onChange={setE("grade")} min={1} max={6} step={0.5} placeholder="z.B. 2,0" />
            {gradeOk && (
              <span style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                fontSize: 11, fontWeight: 700, color: gc(gradeNum), pointerEvents: "none",
              }}>{gl(gradeNum)}</span>
            )}
          </div>
          {errors.grade && <div style={{ fontSize: 11, color: C.err, marginTop: 4 }}>{errors.grade}</div>}
        </div>
        <div>
          <Lbl>Gewichtung</Lbl>
          <NumInput value={form.weight} onChange={setE("weight")} min={0.5} max={4} step={0.5} placeholder="1" />
          {form.type === "Schulaufgabe" && (
            <div style={{ fontSize: 10, color: C.acc, marginTop: 4 }}>Schulaufgabe → automatisch 2</div>
          )}
        </div>
      </div>

      {/* Leistungsart */}
      <div style={{ marginBottom: 18 }}>
        <Lbl>Art der Leistung</Lbl>
        <SelectInput value={form.type} onChange={setE("type")}
          options={LEISTUNGSARTEN} placeholder="Art wählen…" />
        {errors.type && <div style={{ fontSize: 11, color: C.err, marginTop: 4 }}>{errors.type}</div>}
      </div>

      {/* Date with floating calendar */}
      <div style={{ marginBottom: 24 }}>
        <Lbl>Datum</Lbl>
        <div ref={calRef} style={{ position: "relative" }}>
          <div style={{ position: "relative" }}>
            <TextInput
              value={form.date ? fDE(form.date) : ""}
              placeholder="Datum wählen…"
              readOnly
              onClick={() => setShowCal(v => !v)}
            />
            <svg style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth={2} strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          {showCal && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 400 }}>
              <Calendar value={form.date} onChange={set("date")} onClose={() => setShowCal(false)} />
            </div>
          )}
        </div>
        {errors.date && <div style={{ fontSize: 11, color: C.err, marginTop: 4 }}>{errors.date}</div>}
      </div>

      <HR />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Abbrechen</Btn>
        <Btn onClick={submit}>{editItem ? "Änderungen speichern" : "Note speichern"}</Btn>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH BAR
// ─────────────────────────────────────────────────────────────────────────────
const SearchBar = memo(({ onSelect }) => {
  const { grades } = useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const hits = useMemo(() => {
    if (!q.trim()) return [];
    const ql = q.toLowerCase();
    return grades.filter(g =>
      g.subject.toLowerCase().includes(ql) ||
      g.type.toLowerCase().includes(ql) ||
      String(g.grade).includes(ql)
    ).slice(0, 7);
  }, [q, grades]);

  return (
    <div ref={ref} style={{ position: "relative", width: 280 }}>
      <div style={{ position: "relative" }}>
        <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth={2} strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Fach, Note, Art suchen…"
          style={{
            width: "100%", boxSizing: "border-box",
            background: C.bg3, border: `1px solid ${C.line}`, borderRadius: R.full,
            padding: "8px 14px 8px 32px", fontSize: 13, color: C.t0,
            outline: "none", fontFamily: "inherit",
            transition: `border-color ${D.f} ${EASE}`,
          }}
          onFocus={e  => (e.target.style.borderColor = C.acc)}
          onBlur={e   => (e.target.style.borderColor = C.line)}
        />
        {q && (
          <button onClick={() => { setQ(""); setOpen(false); }} style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: C.t2, fontSize: 13,
          }}>✕</button>
        )}
      </div>
      {open && q.trim() && (
        <div style={{
          position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, zIndex: 200,
          background: C.bg3, border: `1px solid ${C.lineHov}`, borderRadius: R.l,
          boxShadow: "0 16px 48px #00000099", overflow: "hidden", animation: "su .12s ease",
        }}>
          {hits.length === 0
            ? <div style={{ padding: "13px 16px", fontSize: 13, color: C.t2 }}>Keine Ergebnisse</div>
            : hits.map(g => (
              <button key={g.id} onMouseDown={() => { onSelect?.(g); setQ(""); setOpen(false); }} style={{
                width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
                fontFamily: "inherit", transition: `background ${D.f}`,
              }}
                onMouseEnter={e => (e.currentTarget.style.background = C.bg4)}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.t0 }}>{g.subject}</div>
                  <div style={{ fontSize: 11, color: C.t2, marginTop: 1 }}>{g.type} · {fDE(g.date)}</div>
                </div>
                <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: gc(g.grade) }}>{g.grade.toFixed(1)}</span>
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TOP NAV
// ─────────────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", label: "Dashboard"    },
  { id: "grades",    label: "Noten"        },
  { id: "stats",     label: "Statistiken"  },
  { id: "settings",  label: "Einstellungen"},
];

const TopNav = memo(({ page, setPage, onAdd, user, onLogout }) => (
  <nav style={{
    position: "sticky", top: 0, zIndex: 100,
    background: C.bg1 + "f0", backdropFilter: "blur(20px)",
    borderBottom: `1px solid ${C.line}`,
    display: "flex", alignItems: "center", gap: 0,
    padding: "0 28px", height: 54,
  }}>
    {/* Brand */}
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginRight: 28 }}>
      <div style={{ width: 26, height: 26, borderRadius: R.s, background: C.acc, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
        </svg>
      </div>
      <span style={{ fontSize: 14, fontWeight: 800, color: C.t0, letterSpacing: "-0.03em" }}>Notenpilot</span>
    </div>

    {/* Nav tabs */}
    <div style={{ display: "flex", gap: 1, flex: 1 }}>
      {NAV.map(n => {
        const active = page === n.id;
        return (
          <button key={n.id} onClick={() => setPage(n.id)} style={{
            padding: "6px 13px", borderRadius: R.s, border: "none", cursor: "pointer",
            background: active ? C.bg4 : "transparent",
            color: active ? C.t0 : C.t1,
            fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: "inherit",
            transition: `all ${D.f} ${EASE}`,
          }}
            onMouseEnter={e => !active && (e.currentTarget.style.color = C.t0)}
            onMouseLeave={e => !active && (e.currentTarget.style.color = C.t1)}
          >{n.label}</button>
        );
      })}
    </div>

    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <SearchBar />
      <Btn onClick={onAdd}>+ Note hinzufügen</Btn>
      {user && (
        <button onClick={onLogout} title="Abmelden" style={{
          width: 32, height: 32, borderRadius: R.full,
          background: C.acc + "25", border: `1px solid ${C.acc}40`,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color: C.accHov, fontFamily: "inherit",
          transition: `all ${D.f}`,
        }}
          onMouseEnter={e => (e.currentTarget.style.background = C.acc + "40")}
          onMouseLeave={e => (e.currentTarget.style.background = C.acc + "25")}
          title="Abmelden"
        >{(user.name || "?")[0].toUpperCase()}</button>
      )}
    </div>
  </nav>
));

// ─────────────────────────────────────────────────────────────────────────────
// CHART TOOLTIP
// ─────────────────────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.bg3, border: `1px solid ${C.lineHov}`, borderRadius: R.m, padding: "9px 13px", fontSize: 12 }}>
      <div style={{ color: C.t2, marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color || C.t0, fontWeight: 600, marginTop: 2 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
const AnimNum = ({ to, dec = 0 }) => {
  const v = useCountUp(to ?? 0);
  return <span>{v.toFixed(dec)}</span>;
};

const Dashboard = memo(({ loading, user }) => {
  const { grades, subjects } = useApp();
  const avg = wAvg(grades);
  const animAvg = useCountUp(avg);

  const subjStats = useMemo(() =>
    subjects.map(s => {
      const sg = grades.filter(g => g.subject === s);
      return { name: s, avg: wAvg(sg), count: sg.length };
    }).filter(s => s.avg != null).sort((a, b) => a.avg - b.avg),
    [grades, subjects]
  );

  const trend = useMemo(() => {
    const sorted = [...grades].sort((a, b) => new Date(a.date) - new Date(b.date));
    return sorted.map((g, i) => ({
      idx: i + 1, datum: g.date.slice(5),
      Note: g.grade, Schnitt: wAvg(sorted.slice(0, i + 1)),
    }));
  }, [grades]);

  const recent = useMemo(() =>
    [...grades].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 7),
    [grades]
  );

  const best  = subjStats[0];
  const worst = subjStats.length > 1 ? subjStats[subjStats.length - 1] : null;

  if (loading) return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[1,2,3,4].map(i => <Sk key={i} h={110} r={R.xl} />)}
      </div>
      <Sk h={240} r={R.xl} />
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 18, animation: "fi .3s ease" }}>
      {/* Greeting */}
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.t0, letterSpacing: "-0.03em", marginBottom: 4 }}>
          Guten Tag{user?.name ? `, ${user.name}` : ""}.
        </h2>
        <p style={{ fontSize: 13, color: C.t1 }}>Hier ist dein aktueller Leistungsüberblick.</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
        <Card pad="22px 24px" style={{ position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at top right, ${avg ? gc(avg) : C.acc}12 0%, transparent 70%)`, pointerEvents: "none" }} />
          <Lbl>Gesamtdurchschnitt</Lbl>
          <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.06em", color: avg ? gc(avg) : C.t2, lineHeight: 1, marginBottom: 4 }}>
            {avg ? animAvg.toFixed(2) : "–"}
          </div>
          <div style={{ fontSize: 12, color: C.t1 }}>{avg ? gl(avg) : "Noch keine Noten"}</div>
        </Card>

        <Card pad="22px 24px">
          <Lbl>Noten gesamt</Lbl>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.05em", color: C.t0, lineHeight: 1, marginBottom: 4 }}>
            <AnimNum to={grades.length} />
          </div>
          <div style={{ fontSize: 12, color: C.t1 }}>{subjects.length} Fächer</div>
        </Card>

        <Card pad="22px 24px">
          <Lbl>Bestes Fach</Lbl>
          {best
            ? <>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.t0, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{best.name}</div>
                <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.05em", color: gc(best.avg), lineHeight: 1 }}>{best.avg.toFixed(2)}</div>
              </>
            : <div style={{ fontSize: 13, color: C.t2, marginTop: 8 }}>Keine Daten</div>
          }
        </Card>

        <Card pad="22px 24px">
          <Lbl>Schwächstes Fach</Lbl>
          {worst
            ? <>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.t0, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{worst.name}</div>
                <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.05em", color: gc(worst.avg), lineHeight: 1 }}>{worst.avg.toFixed(2)}</div>
              </>
            : <div style={{ fontSize: 13, color: C.t2, marginTop: 8 }}>Keine Daten</div>
          }
        </Card>
      </div>

      {/* Chart + Recent */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>
        <Card pad="24px">
          <div style={{ fontSize: 14, fontWeight: 600, color: C.t0, marginBottom: 18 }}>Notenentwicklung</div>
          {trend.length >= 2 ? (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                <defs>
                  <linearGradient id="agrd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.acc} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={C.acc} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.line} strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="datum" tick={{ fill: C.t2, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[1,6]} reversed tick={{ fill: C.t2, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="Schnitt" stroke={C.acc} strokeWidth={2.5} fill="url(#agrd)" dot={false} name="Durchschnitt" />
                <Line type="monotone" dataKey="Note" stroke={C.lineHov} strokeWidth={1} dot={{ fill: C.acc, r: 3.5, strokeWidth: 0 }} name="Note" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 210, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: R.m, background: C.bg4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth={1.5}>
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <div style={{ fontSize: 13, color: C.t2 }}>Mindestens 2 Noten für den Verlauf</div>
            </div>
          )}
        </Card>

        <Card pad="22px 24px">
          <div style={{ fontSize: 13, fontWeight: 600, color: C.t0, marginBottom: 14 }}>Zuletzt eingetragen</div>
          {recent.length === 0
            ? <div style={{ fontSize: 13, color: C.t2 }}>Noch keine Noten.</div>
            : recent.map((g, i) => (
              <div key={g.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "9px 0",
                borderBottom: i < recent.length - 1 ? `1px solid ${C.line}` : "none",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.t0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.subject}</div>
                  <div style={{ fontSize: 10, color: C.t2, marginTop: 1 }}>{g.type} · {fDE(g.date)}</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: gc(g.grade), letterSpacing: "-0.03em", flexShrink: 0, marginLeft: 8 }}>{g.grade.toFixed(1)}</div>
              </div>
            ))
          }
        </Card>
      </div>

      {/* Subject bar */}
      {subjStats.length > 0 && (
        <Card pad="24px">
          <div style={{ fontSize: 14, fontWeight: 600, color: C.t0, marginBottom: 18 }}>Schnitt nach Fach</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={subjStats} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={C.line} strokeDasharray="4 4" horizontal={false} />
              <XAxis type="number" domain={[1,6]} reversed tick={{ fill: C.t2, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: C.t1, fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="avg" name="Schnitt" radius={[0,3,3,0]} fill={C.acc} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GRADES PAGE
// ─────────────────────────────────────────────────────────────────────────────
const GradesPage = memo(({ onAdd }) => {
  const { grades, setGrades, subjects } = useApp();
  const [fSubj, setFSubj] = useState("");
  const [fType, setFType] = useState("");
  const [editItem, setEditItem] = useState(null);
  const toast = useToast();

  const rows = useMemo(() =>
    [...grades]
      .filter(g => (!fSubj || g.subject === fSubj) && (!fType || g.type === fType))
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [grades, fSubj, fType]
  );

  const del = (id) => { setGrades(p => p.filter(g => g.id !== id)); toast("Note gelöscht."); };

  return (
    <div style={{ display: "grid", gap: 18, animation: "fi .25s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.t0, letterSpacing: "-0.02em", marginBottom: 3 }}>Alle Noten</h2>
          <p style={{ fontSize: 12, color: C.t1 }}>{rows.length} Einträge{fSubj || fType ? " (gefiltert)" : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 180 }}>
            <SelectInput value={fSubj} onChange={e => setFSubj(e.target.value)}
              options={[{ value: "", label: "Alle Fächer" }, ...subjects.map(s => ({ value: s, label: s }))]} />
          </div>
          <div style={{ width: 180 }}>
            <SelectInput value={fType} onChange={e => setFType(e.target.value)}
              options={[{ value: "", label: "Alle Arten" }, ...LEISTUNGSARTEN.map(t => ({ value: t, label: t }))]} />
          </div>
          <Btn onClick={onAdd}>+ Hinzufügen</Btn>
        </div>
      </div>

      <Card pad="0">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.line}` }}>
              {["Fach","Note","Art","Gewichtung","Datum",""].map((h, i) => (
                <th key={i} style={{
                  padding: "12px 20px", textAlign: h === "Note" ? "center" : "left",
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: C.t2,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={6} style={{ padding: "40px 20px", textAlign: "center", color: C.t2, fontSize: 14 }}>
                  Noch keine Noten vorhanden.
                </td></tr>
              : rows.map(g => (
                <tr key={g.id} style={{ borderBottom: `1px solid ${C.line}`, transition: `background ${D.f}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.bg3)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "12px 20px", fontWeight: 500, color: C.t0 }}>{g.subject}</td>
                  <td style={{ padding: "12px 20px", textAlign: "center" }}>
                    <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em", color: gc(g.grade) }}>{g.grade.toFixed(1)}</span>
                  </td>
                  <td style={{ padding: "12px 20px" }}><Bdg>{g.type}</Bdg></td>
                  <td style={{ padding: "12px 20px", color: C.t1 }}>×{g.weight}</td>
                  <td style={{ padding: "12px 20px", color: C.t1 }}>{fDE(g.date)}</td>
                  <td style={{ padding: "12px 20px" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <Btn variant="ghost" size="sm" onClick={() => setEditItem(g)}>Bearbeiten</Btn>
                      <Btn variant="danger" size="sm" onClick={() => del(g.id)}>Löschen</Btn>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </Card>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Note bearbeiten">
        {editItem && <GradeForm onClose={() => setEditItem(null)} editItem={editItem} />}
      </Modal>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICS PAGE
// ─────────────────────────────────────────────────────────────────────────────
const StatsPage = memo(() => {
  const { grades, subjects } = useApp();
  const [period, setPeriod] = useState("all");

  const filtered = useMemo(() => {
    const d = { "7d": 7, "30d": 30, "90d": 90, "all": Infinity }[period];
    return grades.filter(g => (Date.now() - new Date(g.date)) / 86400000 <= d);
  }, [grades, period]);

  const subjStats = useMemo(() =>
    subjects.map(s => {
      const sg = filtered.filter(g => g.subject === s);
      return { name: s, avg: wAvg(sg), count: sg.length };
    }).filter(s => s.avg != null),
    [filtered, subjects]
  );

  const lineData = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
    return sorted.map((g, i) => ({ datum: g.date.slice(5), Note: g.grade, Schnitt: wAvg(sorted.slice(0, i + 1)) }));
  }, [filtered]);

  const avgV   = wAvg(filtered);
  const bestV  = filtered.length ? Math.min(...filtered.map(g => g.grade)) : null;
  const worstV = filtered.length ? Math.max(...filtered.map(g => g.grade)) : null;

  return (
    <div style={{ display: "grid", gap: 18, animation: "fi .25s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.t0, letterSpacing: "-0.02em", marginBottom: 3 }}>Statistiken</h2>
          <p style={{ fontSize: 12, color: C.t1 }}>{filtered.length} Noten im gewählten Zeitraum</p>
        </div>
        <div style={{ display: "flex", gap: 3, background: C.bg3, border: `1px solid ${C.line}`, borderRadius: R.m, padding: 4 }}>
          {[["7d","7 Tage"],["30d","30 Tage"],["90d","Quartal"],["all","Gesamt"]].map(([v,l]) => (
            <button key={v} onClick={() => setPeriod(v)} style={{
              padding: "5px 13px", borderRadius: R.s, border: "none", cursor: "pointer",
              background: period === v ? C.bg5 : "transparent",
              color: period === v ? C.t0 : C.t1,
              fontSize: 12, fontWeight: period === v ? 600 : 400, fontFamily: "inherit",
              transition: `all ${D.f} ${EASE}`,
            }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[
          ["Durchschnitt",  avgV?.toFixed(2) ?? "–",         avgV ? gc(avgV) : C.t2   ],
          ["Beste Note",    bestV?.toFixed(1) ?? "–",         C.g1                     ],
          ["Schlechteste",  worstV?.toFixed(1) ?? "–",        C.g5                     ],
          ["Anzahl Noten",  filtered.length,                   C.t0                    ],
        ].map(([label, value, color]) => (
          <Card key={label} pad="20px 22px">
            <Lbl>{label}</Lbl>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.04em", color, lineHeight: 1 }}>{value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card pad="22px">
          <div style={{ fontSize: 13, fontWeight: 600, color: C.t0, marginBottom: 16 }}>Notenverlauf</div>
          {lineData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={lineData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                <CartesianGrid stroke={C.line} strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="datum" tick={{ fill: C.t2, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[1,6]} reversed tick={{ fill: C.t2, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey="Note" stroke={C.lineHov} strokeWidth={1} dot={{ fill: C.acc, r: 3, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="Schnitt" stroke={C.acc} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 190, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: C.t2 }}>Nicht genug Daten</div>
          )}
        </Card>

        <Card pad="22px">
          <div style={{ fontSize: 13, fontWeight: 600, color: C.t0, marginBottom: 16 }}>Fachvergleich</div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={subjStats} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <CartesianGrid stroke={C.line} strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: C.t2, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[1,6]} reversed tick={{ fill: C.t2, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="avg" name="Schnitt" radius={[3,3,0,0]} fill={C.acc} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card pad="0">
        <div style={{ padding: "18px 22px 14px", fontSize: 13, fontWeight: 600, color: C.t0 }}>Fachübersicht</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.line}` }}>
              {["Fach","Schnitt","Bewertung","Noten"].map(h => (
                <th key={h} style={{ padding: "10px 22px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.t2 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjStats.length === 0
              ? <tr><td colSpan={4} style={{ padding: "32px 22px", textAlign: "center", fontSize: 13, color: C.t2 }}>Keine Daten im Zeitraum.</td></tr>
              : subjStats.map(s => (
                <tr key={s.name} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <td style={{ padding: "12px 22px", fontWeight: 500, color: C.t0 }}>{s.name}</td>
                  <td style={{ padding: "12px 22px" }}><span style={{ fontSize: 22, fontWeight: 800, color: gc(s.avg), letterSpacing: "-0.03em" }}>{s.avg.toFixed(2)}</span></td>
                  <td style={{ padding: "12px 22px" }}><Bdg color={gc(s.avg)}>{gl(s.avg)}</Bdg></td>
                  <td style={{ padding: "12px 22px", color: C.t1 }}>{s.count}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </Card>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SettingsPage = memo(({ user, onLogout }) => {
  const { grades, setGrades, subjects, setSubjects } = useApp();
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();

  const exportData = () => {
    const data = JSON.stringify({ grades, subjects, exportedAt: new Date().toISOString() }, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = `notenpilot-${today()}.json`; a.click();
    toast("Daten exportiert.");
  };

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 560, animation: "fi .25s ease" }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.t0, letterSpacing: "-0.02em", marginBottom: 3 }}>Einstellungen</h2>
        {user && <p style={{ fontSize: 12, color: C.t1 }}>Angemeldet als {user.email}</p>}
      </div>

      {/* Subjects */}
      <Card pad="22px">
        <div style={{ fontSize: 14, fontWeight: 600, color: C.t0, marginBottom: 4 }}>Fächer verwalten</div>
        <div style={{ fontSize: 12, color: C.t1, marginBottom: 14 }}>{subjects.length} Fächer angelegt</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {subjects.map(s => (
            <div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 13px", background: C.bg3, borderRadius: R.s }}>
              <span style={{ fontSize: 13, color: C.t0 }}>{s}</span>
              <Btn variant="danger" size="sm" onClick={() => { setSubjects(p => p.filter(x => x !== s)); toast(`„${s}" gelöscht.`); }}>Löschen</Btn>
            </div>
          ))}
          {subjects.length === 0 && <div style={{ fontSize: 12, color: C.t2 }}>Noch keine Fächer vorhanden.</div>}
        </div>
      </Card>

      {/* Export */}
      <Card pad="22px">
        <div style={{ fontSize: 14, fontWeight: 600, color: C.t0, marginBottom: 4 }}>Daten exportieren</div>
        <div style={{ fontSize: 12, color: C.t1, marginBottom: 14 }}>Alle Noten als JSON herunterladen.</div>
        <Btn variant="subtle" onClick={exportData}>Exportieren</Btn>
      </Card>

      {/* Account */}
      <Card pad="22px">
        <div style={{ fontSize: 14, fontWeight: 600, color: C.t0, marginBottom: 4 }}>Konto</div>
        <div style={{ fontSize: 12, color: C.t1, marginBottom: 14 }}>Du bist angemeldet als <strong style={{ color: C.t0 }}>{user?.email}</strong>.</div>
        <Btn variant="ghost" onClick={onLogout}>Abmelden</Btn>
      </Card>

      {/* Danger zone */}
      <Card pad="22px" style={{ borderColor: C.err + "30" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.err, marginBottom: 4 }}>Gefahrenzone</div>
        <div style={{ fontSize: 12, color: C.t1, marginBottom: 14 }}>Alle Noten und Fächer unwiderruflich löschen.</div>
        {!confirm
          ? <Btn variant="danger" onClick={() => setConfirm(true)}>Alle Daten löschen</Btn>
          : (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.t1 }}>Wirklich alles löschen?</span>
              <Btn variant="danger" onClick={() => { setGrades([]); setSubjects([]); setConfirm(false); toast("Alle Daten gelöscht."); }}>Ja, löschen</Btn>
              <Btn variant="ghost" onClick={() => setConfirm(false)}>Abbrechen</Btn>
            </div>
          )
        }
      </Card>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────
const Landing = memo(({ onLogin, onRegister }) => {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), 80); return () => clearTimeout(t); }, []);

  const features = [
    {
      title: "Übersicht behalten",
      body: "Alle deine Fächer und Noten an einem Ort. Dein aktueller Notendurchschnitt wird automatisch und gewichtet berechnet.",
      icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
    },
    {
      title: "Entwicklungen erkennen",
      body: "Interaktive Diagramme zeigen dir, wie sich deine Leistungen im Laufe der Zeit verändern. Erkenne Muster und Trends früh.",
      icon: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z",
    },
    {
      title: "Intelligent analysieren",
      body: "Notenpilot zeigt dir, welche Fächer deinen Gesamtdurchschnitt verbessern oder verschlechtern — und wo Handlungsbedarf besteht.",
      icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    },
    {
      title: "Modern und übersichtlich",
      body: "Ein klares, ablenkungsfreies Design sorgt dafür, dass du dich sofort zurechtfindest. Gebaut für Schüler, die es ernst nehmen.",
      icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
    },
  ];

  const screenshots = [
    { title: "Dashboard", body: "Dein aktueller Notendurchschnitt und wichtige Statistiken auf einen Blick." },
    { title: "Notenverwaltung", body: "Trage neue Noten schnell ein und behalte alle Leistungen im Überblick." },
    { title: "Statistiken", body: "Analysiere deine Entwicklung mit modernen, interaktiven Diagrammen." },
  ];

  return (
    <div style={{ background: C.bg0, minHeight: "100vh", fontFamily: "inherit" }}>
      {/* Sticky nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: C.bg0 + "d8", backdropFilter: "blur(18px)",
        borderBottom: `1px solid ${C.line}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 48px", height: 54,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: R.s, background: C.acc, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.t0, letterSpacing: "-0.03em" }}>Notenpilot</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="ghost" onClick={onLogin}>Anmelden</Btn>
          <Btn onClick={onRegister}>Account erstellen</Btn>
        </div>
      </nav>

      {/* Hero */}
      <div style={{
        maxWidth: 840, margin: "0 auto", padding: "96px 48px 80px",
        textAlign: "center",
        opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(20px)",
        transition: `all ${D.x} ${EASE}`,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "4px 14px", borderRadius: R.full,
          background: C.accDim, border: `1px solid ${C.acc}30`,
          fontSize: 11, fontWeight: 700, color: C.accHov, letterSpacing: "0.06em",
          marginBottom: 32, textTransform: "uppercase",
        }}>
          Noten einfach verwalten
        </div>

        <h1 style={{
          fontSize: "clamp(38px,7vw,68px)", fontWeight: 900,
          letterSpacing: "-0.045em", color: C.t0, lineHeight: 1.06, margin: "0 0 10px",
        }}>Notenpilot</h1>

        <p style={{
          fontSize: "clamp(18px,2.5vw,22px)", fontWeight: 400, color: C.t1,
          lineHeight: 1.5, margin: "0 auto 16px", maxWidth: 500,
        }}>
          Behalte deine Schulnoten im Blick.<br />
          Analysiere deinen Schnitt.<br />
          Verstehe deine Leistung.
        </p>

        <p style={{ fontSize: 15, color: C.t2, maxWidth: 480, margin: "0 auto 40px", lineHeight: 1.7 }}>
          Notenpilot ist eine moderne Web-App für Schüler, um Noten übersichtlich zu verwalten,
          Entwicklungen zu erkennen und den eigenen Notendurchschnitt zu analysieren.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn size="lg" onClick={onRegister}>Account erstellen</Btn>
          <Btn variant="ghost" size="lg" onClick={onLogin}>App starten</Btn>
          <Btn variant="subtle" size="lg" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>Mehr erfahren</Btn>
        </div>
      </div>

      {/* Mock app preview */}
      <div style={{
        maxWidth: 880, margin: "0 auto 88px", padding: "0 48px",
        opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(28px)",
        transition: `all ${D.x} ${EASE} 0.12s`,
      }}>
        <div style={{
          background: C.bg2, border: `1px solid ${C.lineHov}`,
          borderRadius: R.xl, overflow: "hidden",
          boxShadow: `0 48px 96px #00000088, 0 0 0 1px ${C.line}`,
        }}>
          <div style={{ background: C.bg3, borderBottom: `1px solid ${C.line}`, padding: "11px 18px", display: "flex", gap: 7, alignItems: "center" }}>
            {[C.err, C.wrn, C.ok].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c + "80" }} />)}
            <div style={{ flex: 1, height: 20, background: C.bg4, borderRadius: R.full, marginLeft: 8 }} />
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
              {[
                ["Gesamtdurchschnitt", "1.87", C.g2],
                ["Noten gesamt", "8",    C.t0],
                ["Bestes Fach",  "Mathe", C.t0],
                ["Schwächstes",  "Gesch.", C.t0],
              ].map(([l,v,c], i) => (
                <div key={i} style={{ background: C.bg3, borderRadius: R.l, padding: "14px 16px", border: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 9, color: C.t2, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{l}</div>
                  <div style={{ fontSize: i === 0 ? 28 : 20, fontWeight: 900, color: c, letterSpacing: "-0.04em" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ background: C.bg3, borderRadius: R.l, padding: "16px 18px", border: `1px solid ${C.line}`, height: 80, display: "flex", alignItems: "center", gap: 8 }}>
              {[18,35,28,52,42,68,58,80,74].map((h,i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, background: C.acc, borderRadius: "2px 2px 0 0", opacity: 0.6 + i * 0.04 }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div id="features" style={{ maxWidth: 880, margin: "0 auto 88px", padding: "0 48px" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", color: C.t0, marginBottom: 12 }}>Was Notenpilot bietet</h2>
          <p style={{ fontSize: 15, color: C.t1, maxWidth: 420, margin: "0 auto" }}>
            Alles, was du brauchst, um deine schulischen Leistungen wirklich zu verstehen.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {features.map((f, i) => (
            <div key={i} style={{
              background: C.bg2, border: `1px solid ${C.line}`, borderRadius: R.xl,
              padding: "26px 28px",
              transition: `border-color ${D.b} ${EASE}`,
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = C.lineHov)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = C.line)}
            >
              <div style={{ width: 36, height: 36, borderRadius: R.m, background: C.accDim, border: `1px solid ${C.acc}30`, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.acc} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d={f.icon} />
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.t0, marginBottom: 8, letterSpacing: "-0.01em" }}>{f.title}</div>
              <div style={{ fontSize: 13, color: C.t1, lineHeight: 1.65 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Screenshots section */}
      <div style={{ background: C.bg1, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: "72px 0", marginBottom: 72 }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 48px" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: C.t0, marginBottom: 10 }}>Alle wichtigen Funktionen</h2>
            <p style={{ fontSize: 14, color: C.t1 }}>Drei Bereiche, alles was du brauchst.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {screenshots.map((s, i) => (
              <div key={i} style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: R.xl, overflow: "hidden" }}>
                <div style={{ height: 100, background: C.bg3, borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 48, height: 48, borderRadius: R.m, background: C.accDim, border: `1px solid ${C.acc}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 16, height: 16, borderRadius: 3, background: C.acc, opacity: 0.8 }} />
                  </div>
                </div>
                <div style={{ padding: "18px 20px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t0, marginBottom: 6 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: C.t1, lineHeight: 1.6 }}>{s.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ maxWidth: 880, margin: "0 auto 80px", padding: "0 48px", textAlign: "center" }}>
        <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", color: C.t0, marginBottom: 14 }}>
          Bereit für mehr Überblick?
        </h2>
        <p style={{ fontSize: 15, color: C.t1, marginBottom: 36, maxWidth: 380, margin: "0 auto 36px" }}>
          Starte jetzt – kostenlos, ohne Abo, ohne versteckte Kosten.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Btn size="lg" onClick={onRegister}>Account erstellen</Btn>
          <Btn variant="ghost" size="lg" onClick={onLogin}>Anmelden</Btn>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${C.line}`, padding: "20px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.t2 }}>Notenpilot · Alle Daten lokal gespeichert</span>
        <span style={{ fontSize: 11, color: C.t2 }}>Kein Tracking · Kein Abo</span>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
const SEED_G = [
  { id:"g1", subject:"Mathematik", grade:2.0, weight:2, date:"2025-01-15", type:"Schulaufgabe" },
  { id:"g2", subject:"Mathematik", grade:1.5, weight:1, date:"2025-01-28", type:"Ausfrage"    },
  { id:"g3", subject:"Deutsch",    grade:3.0, weight:2, date:"2025-01-20", type:"Schulaufgabe" },
  { id:"g4", subject:"Englisch",   grade:2.0, weight:1, date:"2025-02-03", type:"Kurztest"    },
  { id:"g5", subject:"Physik",     grade:1.0, weight:2, date:"2025-02-10", type:"Schulaufgabe" },
  { id:"g6", subject:"Geschichte", grade:3.5, weight:1, date:"2025-02-14", type:"Ausfrage"    },
  { id:"g7", subject:"Mathematik", grade:1.0, weight:2, date:"2025-02-20", type:"Kurzarbeit"  },
  { id:"g8", subject:"Deutsch",    grade:2.5, weight:1, date:"2025-03-01", type:"Ausfrage"    },
];
const SEED_S = ["Mathematik","Deutsch","Englisch","Physik","Geschichte"];

export default function App() {
  const [grades,   setGrades]   = useLS("np4_grades",   SEED_G);
  const [subjects, setSubjects] = useLS("np4_subjects", SEED_S);
  const [user,     setUser]     = useLS("np4_user",     null);
  const [page,     setPage]     = useState("dashboard");
  const [view,     setView]     = useState("landing"); // landing | auth | app
  const [addOpen,  setAddOpen]  = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (user) setView("app");
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  const ctx = useMemo(() => ({ grades, setGrades, subjects, setSubjects }), [grades, setGrades, subjects, setSubjects]);

  const handleAuth = (u) => { setUser(u); setView("app"); };
  const handleLogout = () => { setUser(null); setView("landing"); };

  const renderPage = () => {
    switch (page) {
      case "dashboard": return <Dashboard loading={loading} user={user} />;
      case "grades":    return <GradesPage onAdd={() => setAddOpen(true)} />;
      case "stats":     return <StatsPage />;
      case "settings":  return <SettingsPage user={user} onLogout={handleLogout} />;
    }
  };

  return (
    <ToastProvider>
      <AppCtx.Provider value={ctx}>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800;900&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { background: ${C.bg1}; color: ${C.t0}; font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }
          ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 9px; }
          input[type=number]::-webkit-inner-spin-button,
          input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          input[type=number] { -moz-appearance: textfield; }
          ::selection { background: ${C.acc}30; }
          @keyframes fi   { from { opacity:0 }                                     to { opacity:1 } }
          @keyframes su   { from { opacity:0; transform: translateY(8px) scale(0.98) } to { opacity:1; transform: none } }
          @keyframes si   { from { opacity:0; transform: translateX(10px) }         to { opacity:1; transform: none } }
          @keyframes sk   { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
          @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
          }
        `}</style>

        {view === "landing" && (
          <Landing
            onLogin={() => setView("auth")}
            onRegister={() => setView("auth")}
          />
        )}

        {view === "auth" && (
          <AuthPage onAuth={handleAuth} />
        )}

        {view === "app" && (
          <>
            <TopNav page={page} setPage={setPage} onAdd={() => setAddOpen(true)} user={user} onLogout={handleLogout} />
            <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 28px 64px" }}>
              <div key={page}>{renderPage()}</div>
            </div>
            <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Neue Note hinzufügen">
              <GradeForm onClose={() => setAddOpen(false)} />
            </Modal>
          </>
        )}

      </AppCtx.Provider>
    </ToastProvider>
  );
}
