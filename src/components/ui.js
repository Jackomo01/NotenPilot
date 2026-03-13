import { useState, useRef, useMemo, memo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { C, R, E, WDAYS, MONTHS } from "../utils/tokens.js";
import { fDE, toStr } from "../utils/helpers.js";
import { useClickOutside } from "../hooks/index.js";
import { ClickSpark } from "../animations/index.js";

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export const Sk = ({ h=20, r=R.m, w="100%" }) => (
  <div style={{ width:w, height:h, borderRadius:r, background:`linear-gradient(90deg,${C.bg3} 25%,${C.bg5} 50%,${C.bg3} 75%)`, backgroundSize:"400%", animation:"sk 1.6s ease infinite" }} />
);

// ─── SparkBtn ─────────────────────────────────────────────────────────────────
export const SparkBtn = memo(({ children, onClick, variant="primary", size="md", disabled, type="button", full, icon }) => {
  const sz = { sm:"5px 12px", md:"9px 18px", lg:"13px 28px" };
  const fs = { sm:11, md:13, lg:14 };
  const v = {
    primary:{ bg:C.acc,       color:"#fff",   border:C.acc,      sc:C.accH    },
    ghost:  { bg:"transparent",color:C.t1,    border:C.line,     sc:C.acc     },
    danger: { bg:"#d8404018", color:C.err,    border:C.err+"30", sc:C.err     },
    subtle: { bg:C.bg4,       color:C.t1,     border:C.line,     sc:C.acc     },
    google: { bg:"#fff",      color:"#111",   border:"#e0e0e0",  sc:"#4285F4" },
  }[variant] ?? {};
  return (
    <ClickSpark sparkColor={v.sc} sparkCount={7} sparkRadius={20} sparkSize={8} duration={380}>
      <motion.button type={type} onClick={onClick} disabled={disabled} whileTap={{ scale:disabled?1:0.96 }}
        style={{
          display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8,
          padding:sz[size], fontSize:fs[size], fontWeight:600, borderRadius:R.s,
          background:v.bg, color:v.color, border:`1px solid ${v.border}`,
          cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1,
          fontFamily:"inherit", whiteSpace:"nowrap", width:full?"100%":undefined,
          transition:"background 0.12s, border-color 0.12s, filter 0.12s",
        }}
        whileHover={disabled?{}:{ filter:"brightness(1.14)" }}
      >{icon && icon}{children}</motion.button>
    </ClickSpark>
  );
});

// ─── Card ─────────────────────────────────────────────────────────────────────
export const Card = memo(({ children, style:s, pad="20px 24px", hover, onClick }) => (
  <motion.div onClick={onClick}
    style={{ background:C.bg2, border:`1px solid ${C.line}`, borderRadius:R.xl, padding:pad, ...s }}
    whileHover={hover||onClick ? { borderColor:C.lineH } : {}}
    transition={{ duration:0.15 }}
  >{children}</motion.div>
));

// ─── Label ────────────────────────────────────────────────────────────────────
export const Lbl = ({ children }) => (
  <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase", color:C.t2, marginBottom:7 }}>{children}</div>
);

// ─── Divider ──────────────────────────────────────────────────────────────────
export const HR = () => <div style={{ height:1, background:C.line, margin:"4px 0" }} />;

// ─── Badge ────────────────────────────────────────────────────────────────────
export const Bdg = memo(({ children, color=C.acc }) => (
  <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 9px", borderRadius:R.f, fontSize:11, fontWeight:600, background:color+"1e", color, border:`1px solid ${color}28` }}>{children}</span>
));

// ─── Base input style ─────────────────────────────────────────────────────────
export const baseInpStyle = focused => ({
  width:"100%", boxSizing:"border-box", background:C.bg4,
  border:`1px solid ${focused ? C.acc : C.line}`, borderRadius:R.s,
  padding:"10px 13px", color:C.t0, fontSize:14, outline:"none",
  fontFamily:"inherit", transition:`border-color 0.1s ${E}`,
  MozAppearance:"textfield", appearance:"none",
});

// ─── Text Input ───────────────────────────────────────────────────────────────
export const TxtInp = memo(({ value, onChange, placeholder, autoFocus, onKeyDown, readOnly, onClick }) => {
  const [f,sf] = useState(false);
  return <input value={value} onChange={onChange} placeholder={placeholder} autoFocus={autoFocus}
    onKeyDown={onKeyDown} readOnly={readOnly} onClick={onClick}
    style={{ ...baseInpStyle(f), cursor:readOnly?"pointer":"text" }}
    onFocus={() => sf(true)} onBlur={() => sf(false)} />;
});

// ─── Select Input ─────────────────────────────────────────────────────────────
export const SelInp = memo(({ value, onChange, options, placeholder }) => {
  const [f,sf] = useState(false);
  return <select value={value} onChange={onChange}
    style={{ ...baseInpStyle(f), cursor:"pointer" }}
    onFocus={() => sf(true)} onBlur={() => sf(false)}>
    {placeholder && <option value="" disabled>{placeholder}</option>}
    {options.map(o => <option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
  </select>;
});

// ─── Combobox ─────────────────────────────────────────────────────────────────
export const Combobox = memo(({ value, onChange, options, placeholder, autoFocus }) => {
  const [q,setQ]       = useState(value||"");
  const [open,setOpen] = useState(false);
  const [hi,setHi]     = useState(-1);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const filtered = useMemo(() => {
    if (!q.trim()) return options;
    const ql = q.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(ql));
  }, [q, options]);
  const sel = useCallback(opt => { setQ(opt); onChange(opt); setOpen(false); setHi(-1); }, [onChange]);
  const [f,sf] = useState(false);
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <input value={q} autoFocus={autoFocus} placeholder={placeholder}
        onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true); setHi(-1); }}
        onFocus={() => { sf(true); setOpen(true); }} onBlur={() => sf(false)}
        onKeyDown={e => {
          if (e.key==="ArrowDown") { e.preventDefault(); setHi(h=>Math.min(h+1,filtered.length-1)); }
          else if (e.key==="ArrowUp") { e.preventDefault(); setHi(h=>Math.max(h-1,0)); }
          else if (e.key==="Enter"&&hi>=0) { e.preventDefault(); sel(filtered[hi]); }
          else if (e.key==="Escape") setOpen(false);
        }}
        style={{ ...baseInpStyle(f||open) }}
      />
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
            transition={{ duration:0.12 }}
            style={{ position:"absolute", top:"calc(100% + 5px)", left:0, right:0, zIndex:400, background:C.bg3, border:`1px solid ${C.lineH}`, borderRadius:R.m, boxShadow:"0 16px 50px rgba(0,0,0,0.8)", overflow:"hidden", maxHeight:220, overflowY:"auto" }}
          >
            {filtered.length === 0 && q.trim() && (
              <button onMouseDown={() => sel(q.trim())}
                style={{ width:"100%", padding:"10px 14px", background:"none", border:"none", cursor:"pointer", color:C.acc, fontSize:13, textAlign:"left", fontFamily:"inherit" }}
                onMouseEnter={e=>(e.currentTarget.style.background=C.bg4)} onMouseLeave={e=>(e.currentTarget.style.background="none")}
              >+ „{q.trim()}" als neues Fach anlegen</button>
            )}
            {filtered.map((opt, i) => (
              <button key={opt} onMouseDown={() => sel(opt)}
                style={{ width:"100%", padding:"10px 14px", background:i===hi?C.bg4:"none", border:"none", cursor:"pointer", color:i===hi?C.t0:C.t1, fontSize:13, textAlign:"left", fontFamily:"inherit", transition:"background 0.1s" }}
                onMouseEnter={e=>(e.currentTarget.style.background=C.bg4)} onMouseLeave={e=>(e.currentTarget.style.background=i===hi?C.bg4:"none")}
              >{opt}</button>
            ))}
            {q.trim() && filtered.length > 0 && (<>
              <HR />
              <button onMouseDown={() => sel(q.trim())}
                style={{ width:"100%", padding:"9px 14px", background:"none", border:"none", cursor:"pointer", color:C.acc, fontSize:12, textAlign:"left", fontFamily:"inherit" }}
                onMouseEnter={e=>(e.currentTarget.style.background=C.bg4)} onMouseLeave={e=>(e.currentTarget.style.background="none")}
              >+ „{q.trim()}" als neues Fach anlegen</button>
            </>)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── Calendar ─────────────────────────────────────────────────────────────────
export const Calendar = memo(({ value, onChange, onClose }) => {
  const td = toStr();
  const init = value || td;
  const [yr,setYr]     = useState(parseInt(init.slice(0,4)));
  const [mo,setMo]     = useState(parseInt(init.slice(5,7))-1);
  const [manual,setManual] = useState(value ? fDE(value) : "");
  const [mErr,setMErr] = useState("");
  const fd = new Date(yr,mo,1).getDay(), dim = new Date(yr,mo+1,0).getDate();
  const sel = value ? new Date(value+"T12:00:00") : null;
  const pick = d => {
    const ds = `${yr}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    onChange(ds); setManual(fDE(ds)); setMErr(""); onClose?.();
  };
  const handleManual = e => {
    const v = e.target.value; setManual(v);
    const m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) {
      const [,d,m2,y2] = m, dt = new Date(+y2,+m2-1,+d);
      if (!isNaN(dt)) { const ds=`${y2}-${String(+m2).padStart(2,"0")}-${String(+d).padStart(2,"0")}`; onChange(ds);setYr(+y2);setMo(+m2-1);setMErr("");return; }
    }
    if (v.length>=8) setMErr("Format: TT.MM.JJJJ"); else setMErr("");
  };
  const prevMo = () => { if(mo===0){setMo(11);setYr(y=>y-1);}else setMo(m=>m-1); };
  const nextMo = () => { if(mo===11){setMo(0);setYr(y=>y+1);}else setMo(m=>m+1); };
  return (
    <motion.div initial={{ opacity:0, y:-8, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:-6, scale:0.97 }}
      transition={{ duration:0.15 }}
      style={{ background:C.bg2, border:`1px solid ${C.lineH}`, borderRadius:R.xl, padding:18, boxShadow:"0 24px 60px rgba(0,0,0,0.9)", width:282 }}
    >
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:10, color:C.t2, marginBottom:5, letterSpacing:"0.06em" }}>Datum (TT.MM.JJJJ)</div>
        <input value={manual} onChange={handleManual} placeholder="z.B. 15.03.2025" style={{ ...baseInpStyle(false), fontSize:13 }} />
        {mErr && <div style={{ fontSize:10, color:C.err, marginTop:4 }}>{mErr}</div>}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <button onClick={prevMo} style={{ background:"none", border:"none", cursor:"pointer", color:C.t1, fontSize:17, padding:"2px 7px", borderRadius:R.s }}
          onMouseEnter={e=>(e.currentTarget.style.color=C.t0)} onMouseLeave={e=>(e.currentTarget.style.color=C.t1)}>‹</button>
        <span style={{ fontSize:13, fontWeight:600, color:C.t0 }}>{MONTHS[mo]} {yr}</span>
        <button onClick={nextMo} style={{ background:"none", border:"none", cursor:"pointer", color:C.t1, fontSize:17, padding:"2px 7px", borderRadius:R.s }}
          onMouseEnter={e=>(e.currentTarget.style.color=C.t0)} onMouseLeave={e=>(e.currentTarget.style.color=C.t1)}>›</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:3 }}>
        {WDAYS.map(d=><div key={d} style={{ textAlign:"center", fontSize:9, fontWeight:700, color:C.t2, padding:"2px 0" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {Array.from({length:fd}).map((_,i)=><div key={`p${i}`}/>)}
        {Array.from({length:dim}).map((_,i)=>{
          const d=i+1, ds=`${yr}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const isSel=sel&&sel.getDate()===d&&sel.getMonth()===mo&&sel.getFullYear()===yr;
          const isTod=ds===td;
          return (
            <motion.button key={d} onClick={()=>pick(d)} whileHover={!isSel?{background:C.bg4}:{}} style={{
              padding:"6px 2px", textAlign:"center", fontSize:12, borderRadius:R.s,
              background:isSel?C.acc:"transparent", color:isSel?"#fff":isTod?C.accH:C.t1,
              border:isTod&&!isSel?`1px solid ${C.acc}50`:"1px solid transparent",
              cursor:"pointer", fontFamily:"inherit", fontWeight:isSel?700:400,
            }}>{d}</motion.button>
          );
        })}
      </div>
      <div style={{ marginTop:12, display:"flex", justifyContent:"flex-end" }}>
        <SparkBtn variant="ghost" size="sm" onClick={onClose}>Schließen</SparkBtn>
      </div>
    </motion.div>
  );
});

// ─── Modal ────────────────────────────────────────────────────────────────────
export const Modal = memo(({ open, onClose, title, children, width=520 }) => {
  useEffect(() => {
    if (!open) return;
    const h = e => e.key==="Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.15 }}
          onClick={onClose}
          style={{ position:"fixed", inset:0, zIndex:500, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(14px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
        >
          <motion.div initial={{ opacity:0, y:14, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:8, scale:0.97 }}
            transition={{ duration:0.22, ease:[0.22,1,0.36,1] }}
            onClick={e => e.stopPropagation()}
            style={{ width:"100%", maxWidth:width, background:C.bg2, border:`1px solid ${C.lineH}`, borderRadius:R.xl, padding:"28px 32px", boxShadow:"0 48px 100px rgba(0,0,0,0.9)" }}
          >
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <h3 style={{ margin:0, fontSize:17, fontWeight:700, color:C.t0, letterSpacing:"-0.02em" }}>{title}</h3>
              <motion.button onClick={onClose} whileHover={{ color:C.t0 }}
                style={{ background:"none", border:"none", cursor:"pointer", color:C.t2, fontSize:17, padding:"3px 7px", borderRadius:R.s, lineHeight:1, fontFamily:"inherit" }}>✕</motion.button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ─── Chart Tooltip ────────────────────────────────────────────────────────────
export const ChartTip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null;
  return <div style={{ background:C.bg3, border:`1px solid ${C.lineH}`, borderRadius:R.m, padding:"9px 13px", fontSize:12 }}>
    <div style={{ color:C.t2, marginBottom:4 }}>{label}</div>
    {payload.map(p => <div key={p.name} style={{ color:p.color||C.t0, fontWeight:600, marginTop:2 }}>{p.name}: {typeof p.value==="number"?p.value.toFixed(2):p.value}</div>)}
  </div>;
};