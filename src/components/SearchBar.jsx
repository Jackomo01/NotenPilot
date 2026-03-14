import { useState, useRef, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "../context/index.jsx";
import { useClickOutside } from "../hooks/index.jsx";
import { fDE, gc } from "../utils/helpers.jsx";
import { C, R } from "../utils/tokens.jsx";

const SearchBar = memo(({ onSelect }) => {
  const { grades } = useApp();
  const [q, setQ]         = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setIsOpen(false));

  const hits = useMemo(() => {
    if (!q.trim()) return [];
    const ql = q.toLowerCase();
    return grades.filter(g =>
      g.subject.toLowerCase().includes(ql) ||
      g.type.toLowerCase().includes(ql) ||
      String(g.grade).includes(ql) ||
      fDE(g.date).includes(ql)
    ).slice(0, 7);
  }, [q, grades]);

  const handleSelect = (grade) => {
    setQ("");
    setIsOpen(false);
    onSelect?.(grade.id);
  };

  return (
    <div ref={ref} style={{ position:"relative", width:280 }}>
      <div style={{ position:"relative" }}>
        {/* Search icon */}
        <svg
          style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", transition:"stroke 0.15s" }}
          width={13} height={13} viewBox="0 0 24 24" fill="none"
          stroke={focused ? C.accH : C.t2} strokeWidth={2} strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>

        <input
          value={q}
          onChange={e => { setQ(e.target.value); setIsOpen(true); }}
          onFocus={() => { setFocused(true); setIsOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={e => { if (e.key === "Escape") { setQ(""); setIsOpen(false); } }}
          placeholder="Suche nach Fach, Art, Note…"
          style={{
            width:"100%", boxSizing:"border-box",
            background: C.bg3,
            border:`1px solid ${focused ? C.acc : C.line}`,
            borderRadius: R.f,
            padding:"7px 28px 7px 30px",
            fontSize:13, color:C.t0, outline:"none",
            fontFamily:"inherit",
            transition:"border-color 0.15s, box-shadow 0.15s",
            boxShadow: focused ? `0 0 0 3px ${C.acc}18` : "none",
          }}
        />

        {q && (
          <button
            onClick={() => { setQ(""); setIsOpen(false); }}
            style={{ position:"absolute", right:9, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:C.t2, fontSize:13, lineHeight:1, padding:"2px 4px" }}
          >✕</button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && q.trim() && (
          <motion.div
            initial={{ opacity:0, y:-6, scale:0.98 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:-4, scale:0.98 }}
            transition={{ duration:0.13 }}
            style={{
              position:"absolute", top:"calc(100% + 6px)", left:0, right:0, zIndex:300,
              background:C.bg2, border:`1px solid ${C.lineH}`, borderRadius:R.l,
              boxShadow:"0 20px 56px rgba(0,0,0,0.85)", overflow:"hidden",
            }}
          >
            {hits.length === 0 ? (
              <div style={{ padding:"14px 14px", fontSize:13, color:C.t2, textAlign:"center" }}>
                Keine Ergebnisse für „{q}"
              </div>
            ) : (
              <>
                <div style={{ padding:"8px 14px 4px", fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:C.t2 }}>
                  {hits.length} Ergebnis{hits.length !== 1 ? "se" : ""}
                </div>
                {hits.map((g, i) => (
                  <button
                    key={g.id}
                    onMouseDown={() => handleSelect(g)}
                    style={{
                      width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
                      padding:"9px 14px", background:"none", border:"none", cursor:"pointer",
                      fontFamily:"inherit", borderTop:`1px solid ${C.line}`,
                      transition:"background 0.1s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.bg3)}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:0 }}>
                      <div style={{
                        width:32, height:32, borderRadius:R.m, flexShrink:0,
                        background:`${gc(g.grade)}18`, border:`1px solid ${gc(g.grade)}30`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:12, fontWeight:800, color:gc(g.grade),
                      }}>
                        {g.grade.toFixed(1)}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:C.t0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.subject}</div>
                        <div style={{ fontSize:10, color:C.t2, marginTop:1 }}>{g.type} · {fDE(g.date)}</div>
                      </div>
                    </div>
                    <span style={{ fontSize:10, color:C.acc, fontWeight:600, padding:"2px 7px", background:`${C.acc}15`, borderRadius:R.f, flexShrink:0, marginLeft:8 }}>→ Noten</span>
                  </button>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default SearchBar;