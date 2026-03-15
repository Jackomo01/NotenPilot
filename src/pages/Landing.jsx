import { useState, useEffect, useRef, memo } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { C, R } from "../utils/tokens.jsx";
import { SparkBtn } from "../components/ui.jsx";
import { ClickSpark } from "../animations/index.jsx";

const FEATURES = [
  {
    n: "01",
    title: "Übersicht behalten",
    body: "Alle deine Fächer und Noten an einem Ort. Dein aktueller Notendurchschnitt wird automatisch und gewichtet berechnet.",
    accent: C.g1,
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    n: "02",
    title: "Entwicklungen erkennen",
    body: "Interaktive Diagramme zeigen dir, wie sich deine Leistungen im Laufe der Zeit verändern. Erkenne Muster und Trends früh.",
    accent: C.acc,
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
  },
  {
    n: "03",
    title: "Intelligent analysieren",
    body: "Notenpilot zeigt dir, welche Fächer deinen Gesamtdurchschnitt verbessern oder verschlechtern — und wo Handlungsbedarf besteht.",
    accent: C.g3,
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
      </svg>
    ),
  },
  {
    n: "04",
    title: "Modern & übersichtlich",
    body: "Ein klares, ablenkungsfreies Design sorgt dafür, dass du dich sofort zurechtfindest. Gebaut für Schüler, die es ernst nehmen.",
    accent: C.accH,
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    ),
  },
];

// ─── Custom cursor ────────────────────────────────────────────────────────────
const CustomCursor = () => {
  const ringRef = useRef(null);
  const dotRef  = useRef(null);
  const pos     = useRef({ x: 0, y: 0 });
  const target  = useRef({ x: 0, y: 0 });
  const raf     = useRef(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const onMove = e => {
      target.current = { x: e.clientX, y: e.clientY };
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 4}px)`;
      }
    };
    const onOver = e => {
      const el = e.target;
      if (el.closest("button, a, [role=button], input, select, textarea")) setHovered(true);
    };
    const onOut = () => setHovered(false);

    const animate = () => {
      pos.current.x += (target.current.x - pos.current.x) * 0.11;
      pos.current.y += (target.current.y - pos.current.y) * 0.11;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${pos.current.x - 20}px, ${pos.current.y - 20}px) scale(${hovered ? 1.6 : 1})`;
      }
      raf.current = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", onOver);
    window.addEventListener("mouseout", onOut);
    raf.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("mouseout", onOut);
      cancelAnimationFrame(raf.current);
    };
  }, [hovered]);

  return (
    <>
      <div ref={ringRef} style={{
        position:"fixed", top:0, left:0, width:40, height:40, borderRadius:"50%",
        border:`1.5px solid ${hovered ? C.accH : C.acc}90`,
        pointerEvents:"none", zIndex:99999,
        transition:"border-color 0.2s, transform 0.15s ease",
        willChange:"transform",
        mixBlendMode:"screen",
      }}/>
      <div ref={dotRef} style={{
        position:"fixed", top:0, left:0, width:8, height:8, borderRadius:"50%",
        background: hovered ? C.accH : C.acc,
        pointerEvents:"none", zIndex:99999,
        transition:"background 0.15s, width 0.15s, height 0.15s",
        willChange:"transform",
      }}/>
    </>
  );
};

// ─── Animated stat counter ────────────────────────────────────────────────────
// Supports counting up (from→to) or down (from→to where from > to)
const StatCounter = ({ to, from = 0, suffix = "", label, delay = 0, last = false }) => {
  const [count, setCount] = useState(from);
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const startTime = Date.now() + delay;
    const duration = 1300;
    const tick = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < 0) { requestAnimationFrame(tick); return; }
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - p) ** 3;
      setCount(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView]);

  return (
    <div ref={ref} style={{ textAlign:"center", flex:1, padding:"32px 24px", borderRight: last ? "none" : `1px solid ${C.line}` }}>
      <div style={{ fontSize:40, fontWeight:900, color:C.t0, letterSpacing:"-0.05em", lineHeight:1, marginBottom:6 }}>
        {count}{suffix}
      </div>
      <div style={{ fontSize:11, color:C.t2, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>{label}</div>
    </div>
  );
};

// ─── Feature card ─────────────────────────────────────────────────────────────
const FeatureCard = ({ f, i }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity:0, y:32 }}
      animate={visible ? { opacity:1, y:0 } : {}}
      transition={{ duration:0.5, delay: i * 0.09, ease:[0.22,1,0.36,1] }}
      style={{
        background:C.bg2, border:`1px solid ${C.line}`, borderRadius:R.xl,
        padding:"36px 40px", display:"flex", gap:28, alignItems:"flex-start",
        position:"relative", overflow:"hidden",
      }}
      whileHover={{ borderColor: f.accent + "55", y:-3, transition:{ duration:0.18 } }}
    >
      <div style={{ position:"absolute", top:0, right:0, width:180, height:180, background:`radial-gradient(circle at top right, ${f.accent}10, transparent 70%)`, pointerEvents:"none" }}/>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:1, background:`linear-gradient(90deg, transparent, ${f.accent}35, transparent)` }}/>
      <div style={{ width:54, height:54, borderRadius:R.m, background: f.accent+"18", border:`1px solid ${f.accent}28`, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", color:f.accent }}>
        {f.icon}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:18, fontWeight:700, color:C.t0, marginBottom:10, letterSpacing:"-0.02em" }}>{f.title}</div>
        <div style={{ fontSize:14, color:C.t1, lineHeight:1.75 }}>{f.body}</div>
      </div>
      <div style={{ fontSize:52, fontWeight:900, color:C.t3, letterSpacing:"-0.05em", alignSelf:"center", userSelect:"none", flexShrink:0 }}>{f.n}</div>
    </motion.div>
  );
};

const SparkLink = ({ children, onClick, variant = "primary", size = "lg" }) => (
  <ClickSpark sparkColor={variant === "primary" ? C.accH : C.acc} sparkCount={10} sparkRadius={28} sparkSize={9} duration={450}>
    <SparkBtn variant={variant} size={size} onClick={onClick}>{children}</SparkBtn>
  </ClickSpark>
);

// ─── Mock preview ─────────────────────────────────────────────────────────────
const MockPreview = ({ vis }) => {
  const { scrollY } = useScroll();
  const rawY = useTransform(scrollY, [0, 600], [0, 50]);
  const y = useSpring(rawY, { stiffness:70, damping:18 });
  const rawScale = useTransform(scrollY, [0, 400], [1, 0.97]);
  const scale = useSpring(rawScale, { stiffness:70, damping:18 });

  return (
    <motion.div
      initial={{ opacity:0, y:40 }}
      animate={{ opacity:vis?1:0, y:vis?0:40 }}
      transition={{ duration:0.7, delay:0.5 }}
      style={{ maxWidth:1000, margin:"0 auto 40px", padding:"0 60px" }}
    >
      <motion.div style={{ y, scale, position:"relative" }}>
        <div style={{ background:C.bg2, border:`1px solid ${C.lineH}`, borderRadius:R.xl, overflow:"hidden", boxShadow:`0 64px 120px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.03), 0 0 80px ${C.acc}0a` }}>
          <div style={{ background:C.bg3, borderBottom:`1px solid ${C.line}`, padding:"12px 20px", display:"flex", gap:7, alignItems:"center" }}>
            {["#d84040","#f0c83a","#26d49a"].map((c,i) => <div key={i} style={{ width:11, height:11, borderRadius:"50%", background:c+"99" }}/>)}
            <div style={{ flex:1, height:18, background:C.bg4, borderRadius:R.f, marginLeft:10, maxWidth:260, display:"flex", alignItems:"center", paddingLeft:10 }}>
              <span style={{ fontSize:9, color:C.t2 }}>notenpilot.app</span>
            </div>
          </div>
          <div style={{ padding:28 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
              {[["Schnitt","1.87",C.g2],["Noten","8",C.t0],["Bestes Fach","Mathe",C.t0],["Trend","↑ besser",C.g1]].map(([l,v,cl],i)=>(
                <div key={i} style={{ background:C.bg3, borderRadius:R.l, padding:"14px 16px", border:`1px solid ${C.line}` }}>
                  <div style={{ fontSize:9, color:C.t2, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>{l}</div>
                  <div style={{ fontSize:i===0?26:18, fontWeight:900, color:cl, letterSpacing:"-0.04em" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 220px", gap:12 }}>
              <div style={{ background:C.bg3, borderRadius:R.l, padding:"14px 16px", border:`1px solid ${C.line}` }}>
                <div style={{ fontSize:10, color:C.t0, fontWeight:600, marginBottom:10 }}>Notenentwicklung</div>
                <div style={{ height:64, display:"flex", alignItems:"flex-end", gap:4, position:"relative" }}>
                  <div style={{ position:"absolute", inset:0, borderBottom:`1px solid ${C.line}`, borderLeft:`1px solid ${C.line}` }}/>
                  {[22,38,30,55,45,70,62,82,75,90,85,96].map((h,i) => (
                    <div key={i} style={{ flex:1, height:`${h}%`, background:`linear-gradient(to top, ${C.acc}, ${C.accH}80)`, borderRadius:"3px 3px 0 0", opacity:0.45+i*0.045 }}/>
                  ))}
                </div>
              </div>
              <div style={{ background:C.bg3, borderRadius:R.l, padding:"14px 16px", border:`1px solid ${C.line}` }}>
                <div style={{ fontSize:10, color:C.t0, fontWeight:600, marginBottom:10 }}>Zuletzt eingetragen</div>
                {[["Mathematik","1.0",C.g1,"Schulaufgabe"],["Deutsch","2.5",C.g2,"Ausfrage"],["Physik","1.5",C.g1,"Kurztest"]].map(([s,g,c,t],i)=>(
                  <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:i<2?`1px solid ${C.line}`:"none" }}>
                    <div>
                      <div style={{ fontSize:10,fontWeight:600,color:C.t0 }}>{s}</div>
                      <div style={{ fontSize:8,color:C.t2 }}>{t}</div>
                    </div>
                    <span style={{ fontSize:16,fontWeight:900,color:c }}>{g}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Hero parallax background ─────────────────────────────────────────────────
const HeroBackground = () => {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, -80]);
  const y2 = useTransform(scrollY, [0, 500], [0, -40]);
  const y3 = useTransform(scrollY, [0, 500], [0, -130]);
  return (
    <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
      <div style={{ position:"absolute", inset:0, backgroundImage:`linear-gradient(${C.line}80 1px,transparent 1px),linear-gradient(90deg,${C.line}80 1px,transparent 1px)`, backgroundSize:"60px 60px", opacity:0.22, maskImage:"radial-gradient(ellipse 80% 60% at 50% 30%,#000 20%,transparent 80%)" }}/>
      <motion.div style={{ y:y1, position:"absolute", top:"5%", left:"12%", width:520, height:520, borderRadius:"50%", background:`radial-gradient(ellipse, ${C.acc}20 0%, transparent 70%)`, filter:"blur(50px)" }}/>
      <motion.div style={{ y:y2, position:"absolute", top:"15%", right:"8%", width:360, height:360, borderRadius:"50%", background:`radial-gradient(ellipse, ${C.g1}14 0%, transparent 70%)`, filter:"blur(55px)" }}/>
      <motion.div style={{ y:y3, position:"absolute", top:"55%", left:"48%", width:260, height:260, borderRadius:"50%", background:`radial-gradient(ellipse, ${C.accH}10 0%, transparent 70%)`, filter:"blur(60px)", transform:"translateX(-50%)" }}/>
    </div>
  );
};

// ─── CTA Section ──────────────────────────────────────────────────────────────
const CTASection = ({ onRegister, onLogin }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 2000], [0, -60]);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold:0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ position:"relative", overflow:"hidden", borderTop:`1px solid ${C.line}`, padding:"100px 60px", textAlign:"center", background:C.bg1 }}>
      <motion.div style={{ y:bgY, position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:700, height:400, background:`radial-gradient(ellipse, ${C.acc}16, transparent 70%)`, pointerEvents:"none" }}/>
      <motion.div initial={{ opacity:0, y:24 }} animate={visible ? { opacity:1, y:0 } : {}} transition={{ duration:0.55 }} style={{ position:"relative", zIndex:1 }}>
        <div style={{ fontSize:"clamp(26px,4vw,42px)", fontWeight:900, letterSpacing:"-0.04em", color:C.t0, marginBottom:16, lineHeight:1.15 }}>
          Bereit für mehr Überblick?
        </div>
        <p style={{ fontSize:16, color:C.t1, maxWidth:400, margin:"0 auto 40px", lineHeight:1.7 }}>
          Starte jetzt — kostenlos, ohne Abo, ohne versteckte Kosten.
        </p>
        <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
          <SparkLink onClick={onRegister}>Account erstellen</SparkLink>
          <SparkLink variant="ghost" onClick={onLogin}>Anmelden</SparkLink>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Features heading ─────────────────────────────────────────────────────────
const FeaturesHeading = () => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold:0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ textAlign:"center", marginBottom:56 }}>
      <motion.div initial={{ opacity:0, y:20 }} animate={visible ? { opacity:1, y:0 } : {}} transition={{ duration:0.5 }}
        style={{ fontSize:"clamp(28px,4vw,44px)", fontWeight:900, letterSpacing:"-0.04em", color:C.t0, lineHeight:1.1, marginBottom:14 }}>
        Was Notenpilot bietet
      </motion.div>
      <motion.p initial={{ opacity:0, y:12 }} animate={visible ? { opacity:1, y:0 } : {}} transition={{ duration:0.5, delay:0.1 }}
        style={{ fontSize:16, color:C.t1, maxWidth:500, margin:"0 auto", lineHeight:1.7 }}>
        Alles was du brauchst, um deine schulischen Leistungen wirklich zu verstehen und systematisch zu verbessern.
      </motion.p>
    </div>
  );
};

// ─── Main Landing ─────────────────────────────────────────────────────────────
const Landing = memo(({ onLogin, onRegister }) => {
  const [vis, setVis] = useState(false);
  const { scrollY } = useScroll();
  const heroY       = useTransform(scrollY, [0, 400], [0, 70]);
  const heroOpacity = useTransform(scrollY, [0, 280], [1, 0.25]);

  useEffect(() => {
    const t = setTimeout(() => setVis(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ background:C.bg0, minHeight:"100vh", fontFamily:"inherit", overflowX:"hidden", cursor:"none" }}>
      <CustomCursor />

      {/* NAV */}
      <motion.nav
        initial={{ opacity:0, y:-14 }}
        animate={{ opacity:1, y:0 }}
        transition={{ duration:0.4 }}
        style={{
          position:"sticky", top:0, zIndex:100,
          background:C.bg0+"e0", backdropFilter:"blur(20px)",
          borderBottom:`1px solid ${C.line}`,
          display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"0 60px", height:60,
        }}
      >
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:R.m, background:C.acc, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <span style={{ fontSize:16, fontWeight:900, letterSpacing:"-0.04em", color:C.t0 }}>Notenpilot</span>
        </div>
        <div style={{ display:"flex", gap:12 }}>
          <ClickSpark sparkColor={C.acc} sparkCount={8} sparkRadius={22} sparkSize={8} duration={380}>
            <SparkBtn variant="ghost" size="md" onClick={onLogin}>Anmelden</SparkBtn>
          </ClickSpark>
          <ClickSpark sparkColor={C.accH} sparkCount={10} sparkRadius={24} sparkSize={9} duration={420}>
            <SparkBtn size="md" onClick={onRegister}>Account erstellen</SparkBtn>
          </ClickSpark>
        </div>
      </motion.nav>

      {/* HERO */}
      <div style={{ position:"relative", overflow:"hidden", minHeight:"94vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <HeroBackground />

        {/* ── Floating Cards — left ── */}
        <motion.div
          initial={{ opacity:0, x:-40 }} animate={{ opacity:vis?1:0, x:vis?0:-40 }}
          transition={{ duration:0.7, delay:0.9 }}
          style={{ position:"absolute", left:"6%", top:"20%", zIndex:2, pointerEvents:"none" }}
        >
          <motion.div
            animate={{ y:[0,-12,0], rotate:[-1,1,-1] }}
            transition={{ duration:4.2, repeat:Infinity, ease:"easeInOut" }}
            style={{ width:160, background:C.bg2, border:`1px solid ${C.lineH}`, borderRadius:R.l, padding:"14px 16px", boxShadow:`0 20px 48px rgba(0,0,0,0.65), 0 0 24px ${C.acc}12` }}
          >
            <div style={{ fontSize:9, color:C.t2, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>Gesamtschnitt</div>
            <div style={{ fontSize:30, fontWeight:900, color:"#4ed468", letterSpacing:"-0.05em", lineHeight:1 }}>1.87</div>
            <div style={{ fontSize:11, color:C.t2, marginTop:5 }}>Sehr gut ↑</div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity:0, x:-40 }} animate={{ opacity:vis?1:0, x:vis?0:-40 }}
          transition={{ duration:0.7, delay:1.05 }}
          style={{ position:"absolute", left:"7%", top:"60%", zIndex:2, pointerEvents:"none" }}
        >
          <motion.div
            animate={{ y:[0,9,0], x:[0,5,0] }}
            transition={{ duration:5, repeat:Infinity, ease:"easeInOut", delay:0.8 }}
            style={{ width:148, background:C.bg2, border:`1px solid ${C.lineH}`, borderRadius:R.l, padding:"12px 15px", boxShadow:`0 14px 36px rgba(0,0,0,0.6)` }}
          >
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:C.g1 }}/>
              <div style={{ fontSize:11, fontWeight:700, color:C.t0 }}>Neue Note</div>
            </div>
            <div style={{ fontSize:13, color:C.t1, lineHeight:1.5 }}>Mathe SA<br/><span style={{ color:C.g1, fontWeight:700 }}>1.0</span> · ×2 Gewicht</div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity:0, x:-30 }} animate={{ opacity:vis?1:0, x:vis?0:-30 }}
          transition={{ duration:0.7, delay:1.2 }}
          style={{ position:"absolute", left:"3%", top:"43%", zIndex:2, pointerEvents:"none" }}
        >
          <motion.div
            animate={{ y:[0,-7,0] }}
            transition={{ duration:3.6, repeat:Infinity, ease:"easeInOut", delay:1.4 }}
            style={{ width:128, background:`${C.acc}14`, border:`1px solid ${C.acc}32`, borderRadius:R.l, padding:"10px 13px", boxShadow:`0 10px 28px rgba(0,0,0,0.45)` }}
          >
            <div style={{ fontSize:9, color:C.accH, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:6 }}>Trend</div>
            <div style={{ fontSize:14, fontWeight:800, color:C.t0 }}>↑ Verbessert</div>
            <div style={{ fontSize:11, color:C.t1, marginTop:3 }}>2.3 → 1.87</div>
          </motion.div>
        </motion.div>

        {/* ── Floating Cards — right ── */}
        <motion.div
          initial={{ opacity:0, x:40 }} animate={{ opacity:vis?1:0, x:vis?0:40 }}
          transition={{ duration:0.7, delay:0.95 }}
          style={{ position:"absolute", right:"6%", top:"18%", zIndex:2, pointerEvents:"none" }}
        >
          <motion.div
            animate={{ y:[0,-13,0], rotate:[1,-1,1] }}
            transition={{ duration:4.8, repeat:Infinity, ease:"easeInOut", delay:0.4 }}
            style={{ width:168, background:C.bg2, border:`1px solid ${C.lineH}`, borderRadius:R.l, padding:"14px 15px", boxShadow:`0 20px 48px rgba(0,0,0,0.65), 0 0 24px ${C.accH}0e` }}
          >
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:9 }}>
              <div style={{ width:24, height:24, borderRadius:7, background:`${C.acc}22`, border:`1px solid ${C.acc}30`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={C.accH} strokeWidth={2.2} strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12"/></svg>
              </div>
              <div style={{ fontSize:12, fontWeight:700, color:C.t0 }}>KI-Assistent</div>
            </div>
            <div style={{ fontSize:11, color:C.t1, lineHeight:1.55, marginBottom:8 }}>
              „Welche Note brauche ich für 1,5 in Mathe?"
            </div>
            <div style={{ fontSize:10, color:C.accH, fontWeight:600, padding:"3px 9px", background:`${C.acc}18`, borderRadius:R.f, display:"inline-block" }}>Antwort berechnen →</div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity:0, x:40 }} animate={{ opacity:vis?1:0, x:vis?0:40 }}
          transition={{ duration:0.7, delay:1.1 }}
          style={{ position:"absolute", right:"6%", top:"57%", zIndex:2, pointerEvents:"none" }}
        >
          <motion.div
            animate={{ y:[0,10,0], x:[0,-6,0] }}
            transition={{ duration:4.4, repeat:Infinity, ease:"easeInOut", delay:1.1 }}
            style={{ width:150, background:C.bg2, border:`1px solid ${C.lineH}`, borderRadius:R.l, padding:"12px 14px", boxShadow:`0 14px 34px rgba(0,0,0,0.55)` }}
          >
            <div style={{ fontSize:9, color:C.t2, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:9 }}>Fächer</div>
            {[["Physik","1.0",C.g1],["Mathe","1.87",C.g2],["Deutsch","2.5",C.g2]].map(([fach,note,col])=>(
              <div key={fach} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0" }}>
                <span style={{ fontSize:12, color:C.t1 }}>{fach}</span>
                <span style={{ fontSize:13, fontWeight:800, color:col }}>{note}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity:0, x:30 }} animate={{ opacity:vis?1:0, x:vis?0:30 }}
          transition={{ duration:0.7, delay:1.3 }}
          style={{ position:"absolute", right:"3%", top:"39%", zIndex:2, pointerEvents:"none" }}
        >
          <motion.div
            animate={{ y:[0,-8,0] }}
            transition={{ duration:3.2, repeat:Infinity, ease:"easeInOut", delay:2 }}
            style={{ width:120, background:`${C.g1}12`, border:`1px solid ${C.g1}28`, borderRadius:R.l, padding:"10px 12px", boxShadow:`0 10px 24px rgba(0,0,0,0.45)` }}
          >
            <div style={{ fontSize:9, color:C.g1, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:6 }}>Streak</div>
            <div style={{ fontSize:22, fontWeight:900, color:C.t0, letterSpacing:"-0.03em" }}>12 🔥</div>
            <div style={{ fontSize:11, color:C.t1, marginTop:3 }}>Tage aktiv</div>
          </motion.div>
        </motion.div>

        {/* Hero text */}
        <motion.div style={{ y:heroY, opacity:heroOpacity, position:"relative", zIndex:1, textAlign:"center", padding:"0 24px", maxWidth:920, width:"100%" }}>
          <motion.h1
            initial={{ opacity:0, y:28 }}
            animate={{ opacity:vis?1:0, y:vis?0:28 }}
            transition={{ duration:0.62, delay:0.1 }}
            style={{ fontSize:"clamp(44px,7.5vw,82px)", fontWeight:900, letterSpacing:"-0.055em", lineHeight:1.02, color:C.t0, marginBottom:14 }}
          >
            Behalte deine
            <br />
            <span style={{ color:C.acc }}>Schulnoten</span> im Blick.
          </motion.h1>

          <motion.p
            initial={{ opacity:0, y:18 }}
            animate={{ opacity:vis?1:0, y:vis?0:18 }}
            transition={{ duration:0.55, delay:0.25 }}
            style={{ fontSize:18, color:C.t1, maxWidth:520, margin:"0 auto 42px", lineHeight:1.7 }}
          >
            Analysiere deinen Schnitt, verstehe deine Leistung und behalte den Überblick über alle Fächer — modern und kostenlos.
          </motion.p>

          <motion.div
            initial={{ opacity:0, y:14 }}
            animate={{ opacity:vis?1:0, y:vis?0:14 }}
            transition={{ duration:0.5, delay:0.38 }}
            style={{ display:"flex", gap:16, justifyContent:"center", flexWrap:"wrap" }}
          >
            <SparkLink onClick={onRegister}>Jetzt starten — kostenlos</SparkLink>
            <SparkLink variant="ghost" onClick={onLogin}>Anmelden</SparkLink>
          </motion.div>
        </motion.div>
      </div>

      {/* MOCK PREVIEW */}
      <MockPreview vis={vis} />

      {/* STATS ROW — drei neue Kästen */}
      <div style={{ maxWidth:900, margin:"0 auto 90px", padding:"0 60px" }}>
        <div style={{ display:"flex", background:C.bg2, border:`1px solid ${C.line}`, borderRadius:R.xl, overflow:"hidden" }}>
          {/* Karte 1: ∞ Notentypen — statisches Symbol */}
          <div style={{ textAlign:"center", flex:1, padding:"32px 24px", borderRight:`1px solid ${C.line}` }}>
            <div style={{ fontSize:44, fontWeight:900, color:C.t0, letterSpacing:"-0.04em", lineHeight:1, marginBottom:6 }}>∞</div>
            <div style={{ fontSize:11, color:C.t2, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>Notentypen</div>
          </div>
          {/* Karte 2: 100% Datenschutz — zählt von 0 auf 100 */}
          <StatCounter from={0} to={100} suffix="%" label="Datenschutz" delay={150} />
          {/* Karte 3: 0€ für immer kostenlos — zählt von 100 auf 0 */}
          <StatCounter from={100} to={0} suffix="€" label="Für immer kostenlos" delay={300} last />
        </div>
      </div>

      {/* FEATURES */}
      <div id="features" style={{ maxWidth:1100, margin:"0 auto", padding:"40px 60px 100px" }}>
        <FeaturesHeading />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          {FEATURES.map((f, i) => <FeatureCard key={i} f={f} i={i} />)}
        </div>
      </div>

      {/* CTA */}
      <CTASection onRegister={onRegister} onLogin={onLogin} />

      {/* FOOTER */}
      <div style={{ borderTop:`1px solid ${C.line}`, padding:"22px 60px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:20, height:20, borderRadius:5, background:C.acc, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          </div>
          <span style={{ fontSize:12, color:C.t2, fontWeight:600 }}>Notenpilot</span>
        </div>
        <span style={{ fontSize:12, color:C.t2 }}>Kein Tracking · Kein Abo · Open Source</span>
      </div>
    </div>
  );
});

export default Landing;