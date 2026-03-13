import { useState, useRef, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "../context/index.jsx";
import { useClickOutside } from "../hooks/index.jsx";
import { fDE, gc } from "../utils/helpers.jsx";
import { C, R } from "../utils/tokens.jsx";

const SearchBar = memo(() => {
  const { grades } = useApp();
  const [q, setQ] = useState("");
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
      String(g.grade).includes(ql)
    ).slice(0, 7);
  }, [q, grades]);

  return (
    <div ref={ref} style={{ position:"relative", width:260 }}>
      <div style={{ position:"relative" }}>
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setIsOpen(true); }}
          onFocus={() => { setFocused(true); setIsOpen(true); }}
          onBlur={() => setFocused(false)}
          placeholder="Suche..."
          style={{
            width:"100%", boxSizing:"border-box", background:C.bg3,
            border:`1px solid ${focused ? C.acc : C.line}`,
            borderRadius:R.f, padding:"7px 12px 7px 30px",
            fontSize:13, color:C.t0, outline:"none",
            fontFamily:"inherit", transition:"border-color 0.1s"
          }}
        />
      </div>
      <AnimatePresence>
        {isOpen && q.trim() && hits.length > 0 && (
          <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:0.12}}
            style={{ position:"absolute", top:"calc(100% + 5px)", left:0, right:0, zIndex:200, background:C.bg3, border:`1px solid ${C.lineH}`, borderRadius:R.l, boxShadow:"0 16px 48px rgba(0,0,0,0.8)", overflow:"hidden" }}>
            {hits.map(g => (
              <button key={g.id} onMouseDown={() => { setQ(""); setIsOpen(false); }}
                style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}
                onMouseEnter={e => (e.currentTarget.style.background = C.bg4)}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                <div>
                  <div style={{fontSize:13, fontWeight:500, color:C.t0}}>{g.subject}</div>
                  <div style={{fontSize:10, color:C.t2, marginTop:1}}>{g.type} - {fDE(g.date)}</div>
                </div>
                <span style={{fontSize:20, fontWeight:800, color:gc(g.grade)}}>{g.grade.toFixed(1)}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default SearchBar;
