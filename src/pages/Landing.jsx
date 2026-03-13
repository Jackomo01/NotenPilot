import { useState, useEffect, useRef, memo } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
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
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
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
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
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
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
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
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    ),
  },
];

const STATS = [
  { value: "100%", label: "Kostenlos" },
  { value: "0", label: "Tracking" },
  { value: "∞", label: "Fächer" },
  { value: "lokal", label: "Datenspeicherung" },
];

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
      initial={{ opacity: 0, y: 40 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: C.bg2,
        border: `1px solid ${C.line}`,
        borderRadius: R.xl,
        padding: "32px 36px",
        display: "flex",
        gap: 24,
        alignItems: "flex-start",
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.2s, transform 0.2s",
        cursor: "default",
      }}
      whileHover={{ borderColor: f.accent + "60", y: -4 }}
    >
      <div style={{ position: "absolute", top: 0, right: 0, width: 180, height: 180, background: `radial-gradient(circle at top right, ${f.accent}12, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ width: 48, height: 48, borderRadius: R.m, background: f.accent + "18", border: `1px solid ${f.accent}30`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: f.accent }}>
        {f.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.t0, marginBottom: 10, letterSpacing: "-0.02em" }}>{f.title}</div>
        <div style={{ fontSize: 14, color: C.t1, lineHeight: 1.75 }}>{f.body}</div>
      </div>
      <div style={{ fontSize: 52, fontWeight: 900, color: C.t3, letterSpacing: "-0.05em", alignSelf: "center", userSelect: "none", flexShrink: 0 }}>{f.n}</div>
    </motion.div>
  );
};

const StatCard = ({ stat, i }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={visible ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
      style={{ textAlign: "center", padding: "32px 24px", background: C.bg2, borderRadius: R.xl, border: `1px solid ${C.line}`, flex: 1 }}
      whileHover={{ borderColor: C.acc + "50", y: -3 }}
    >
      <div style={{ fontSize: 42, fontWeight: 900, color: C.acc, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 8 }}>{stat.value}</div>
      <div style={{ fontSize: 12, color: C.t2, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{stat.label}</div>
    </motion.div>
  );
};

const SparkLink = ({ children, onClick, variant = "primary", size = "lg" }) => (
  <ClickSpark sparkColor={variant === "primary" ? C.accH : C.acc} sparkCount={10} sparkRadius={28} sparkSize={9} duration={450}>
    <SparkBtn variant={variant} size={size} onClick={onClick}>{children}</SparkBtn>
  </ClickSpark>
);

const Landing = memo(({ onLogin, onRegister }) => {
  const [vis, setVis] = useState(false);
  const heroRef = useRef(null);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], [0, 60]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0.3]);

  useEffect(() => {
    const t = setTimeout(() => setVis(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ background: C.bg0, minHeight: "100vh", fontFamily: "inherit", overflowX: "hidden" }}>

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: C.bg0 + "e0", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${C.line}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 48px", height: 56,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 28, height: 28, borderRadius: R.s, background: C.acc, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.04em", color: C.t0 }}>Notenpilot</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <ClickSpark sparkColor={C.acc} sparkCount={8} sparkRadius={22} sparkSize={8} duration={380}>
            <SparkBtn variant="ghost" onClick={onLogin}>Anmelden</SparkBtn>
          </ClickSpark>
          <ClickSpark sparkColor={C.accH} sparkCount={10} sparkRadius={24} sparkSize={9} duration={420}>
            <SparkBtn onClick={onRegister}>Account erstellen</SparkBtn>
          </ClickSpark>
        </div>
      </nav>

      {/* HERO */}
      <div ref={heroRef} style={{ position: "relative", overflow: "hidden", minHeight: "92vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Background effects */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${C.line}88 1px,transparent 1px),linear-gradient(90deg,${C.line}88 1px,transparent 1px)`, backgroundSize: "60px 60px", opacity: 0.25, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 700, background: `radial-gradient(circle, ${C.acc}22 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-10%", left: "10%", width: 400, height: 400, background: `radial-gradient(circle, ${C.g1}12 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "10%", right: "10%", width: 300, height: 300, background: `radial-gradient(circle, ${C.accH}14 0%, transparent 70%)`, pointerEvents: "none" }} />

        <motion.div style={{ y: heroY, opacity: heroOpacity, position: "relative", zIndex: 1, textAlign: "center", padding: "0 24px", maxWidth: 900, width: "100%" }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: vis ? 1 : 0, y: vis ? 0 : 16 }}
            transition={{ duration: 0.5 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 16px", borderRadius: R.f, background: C.accDim, border: `1px solid ${C.acc}40`, fontSize: 11, fontWeight: 700, color: C.accH, letterSpacing: "0.08em", marginBottom: 36, textTransform: "uppercase" }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.acc, display: "inline-block" }} />
            Noten einfach verwalten
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: vis ? 1 : 0, y: vis ? 0 : 24 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{ fontSize: "clamp(42px,7vw,80px)", fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1.02, color: C.t0, marginBottom: 12 }}
          >
            Behalte deine
            <br />
            <span style={{ color: C.acc }}>Schulnoten</span> im Blick.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: vis ? 1 : 0, y: vis ? 0 : 18 }}
            transition={{ duration: 0.55, delay: 0.25 }}
            style={{ fontSize: 18, color: C.t1, maxWidth: 520, margin: "0 auto 40px", lineHeight: 1.7 }}
          >
            Analysiere deinen Schnitt, verstehe deine Leistung und behalte den Überblick über alle Fächer — modern und kostenlos.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: vis ? 1 : 0, y: vis ? 0 : 14 }}
            transition={{ duration: 0.5, delay: 0.38 }}
            style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}
          >
            <SparkLink onClick={onRegister}>Jetzt starten — kostenlos</SparkLink>
            <SparkLink variant="ghost" onClick={onLogin}>Anmelden</SparkLink>
          </motion.div>

          {/* Floating badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: vis ? 1 : 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 36, flexWrap: "wrap" }}
          >
            {["Kein Abo", "Kein Tracking", "Lokal gespeichert", "Open Source"].map((t, i) => (
              <span key={i} style={{ fontSize: 11, color: C.t2, padding: "4px 12px", borderRadius: R.f, border: `1px solid ${C.line}`, fontWeight: 500 }}>{t}</span>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: vis ? 1 : 0 }}
          transition={{ delay: 1.2 }}
          style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
        >
          <span style={{ fontSize: 10, color: C.t2, letterSpacing: "0.1em", textTransform: "uppercase" }}>Scroll</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            style={{ width: 1, height: 28, background: `linear-gradient(to bottom, ${C.acc}, transparent)` }}
          />
        </motion.div>
      </div>

      {/* MOCK PREVIEW */}
      <MockPreview vis={vis} />

      {/* STATS */}
      <div style={{ padding: "80px 48px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {STATS.map((s, i) => <StatCard key={i} stat={s} i={i} />)}
        </div>
      </div>

      {/* FEATURES */}
      <div id="features" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 48px 100px" }}>
        <FeaturesSection />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {FEATURES.map((f, i) => <FeatureCard key={i} f={f} i={i} />)}
        </div>
      </div>

      {/* CTA */}
      <CTASection onRegister={onRegister} onLogin={onLogin} />

      {/* FOOTER */}
      <div style={{ borderTop: `1px solid ${C.line}`, padding: "20px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: C.t2 }}>Notenpilot · Alle Daten lokal gespeichert</span>
        <span style={{ fontSize: 12, color: C.t2 }}>Kein Tracking · Kein Abo</span>
      </div>
    </div>
  );
});

const FeaturesSection = () => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ textAlign: "center", marginBottom: 64 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 900, letterSpacing: "-0.04em", color: C.t0, lineHeight: 1.1, marginBottom: 16 }}
      >
        Was Notenpilot bietet
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{ fontSize: 16, color: C.t1, maxWidth: 500, margin: "0 auto", lineHeight: 1.7 }}
      >
        Alles was du brauchst, um deine schulischen Leistungen wirklich zu verstehen und systematisch zu verbessern.
      </motion.p>
    </div>
  );
};

const MockPreview = ({ vis }) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    animate={{ opacity: vis ? 1 : 0, y: vis ? 0 : 40 }}
    transition={{ duration: 0.7, delay: 0.5 }}
    style={{ maxWidth: 1000, margin: "0 auto 40px", padding: "0 48px" }}
  >
    <div style={{ background: C.bg2, border: `1px solid ${C.lineH}`, borderRadius: R.xl, overflow: "hidden", boxShadow: "0 64px 120px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.03)" }}>
      <div style={{ background: C.bg3, borderBottom: `1px solid ${C.line}`, padding: "12px 20px", display: "flex", gap: 7, alignItems: "center" }}>
        {["#d84040", "#f0c83a", "#26d49a"].map((c, i) => <div key={i} style={{ width: 11, height: 11, borderRadius: "50%", background: c + "99" }} />)}
        <div style={{ flex: 1, height: 18, background: C.bg4, borderRadius: R.f, marginLeft: 10, maxWidth: 260 }} />
      </div>
      <div style={{ padding: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
          {[["Schnitt", "1.87", C.g2], ["Noten", "8", C.t0], ["Bestes Fach", "Mathe", C.t0], ["Trend", "↑ besser", C.g1]].map(([l, v, cl], i) => (
            <div key={i} style={{ background: C.bg3, borderRadius: R.l, padding: "14px 16px", border: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 9, color: C.t2, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{l}</div>
              <div style={{ fontSize: i === 0 ? 26 : 18, fontWeight: 900, color: cl, letterSpacing: "-0.04em" }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ background: C.bg3, borderRadius: R.l, padding: "16px 18px", border: `1px solid ${C.line}`, height: 80, display: "flex", alignItems: "flex-end", gap: 5 }}>
          {[22, 38, 30, 55, 45, 70, 62, 82, 75, 90, 85, 96].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, background: `linear-gradient(to top, ${C.acc}, ${C.accH})`, borderRadius: "3px 3px 0 0", opacity: 0.5 + i * 0.04 }} />
          ))}
        </div>
      </div>
    </div>
  </motion.div>
);

const CTASection = ({ onRegister, onLogin }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", overflow: "hidden", borderTop: `1px solid ${C.line}`, padding: "100px 48px", textAlign: "center", background: C.bg1 }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 400, background: `radial-gradient(ellipse, ${C.acc}18, transparent 70%)`, pointerEvents: "none" }} />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55 }}
        style={{ position: "relative", zIndex: 1 }}
      >
        <div style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 900, letterSpacing: "-0.04em", color: C.t0, marginBottom: 16, lineHeight: 1.15 }}>
          Bereit für mehr Überblick?
        </div>
        <p style={{ fontSize: 16, color: C.t1, maxWidth: 400, margin: "0 auto 40px", lineHeight: 1.7 }}>
          Starte jetzt — kostenlos, ohne Abo, ohne versteckte Kosten.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <SparkLink onClick={onRegister}>Account erstellen</SparkLink>
          <SparkLink variant="ghost" onClick={onLogin}>Anmelden</SparkLink>
        </div>
      </motion.div>
    </div>
  );
};

export default Landing;