import { useState, useEffect, useRef, memo } from "react";
import { motion } from "framer-motion";
import { C, R } from "../utils/tokens.js";
import { SparkBtn } from "../components/ui.js";
import { VariableProximity, BlurText, ScrollReveal, ScrollFloat, ScrollStack, ScrollStackItem, ClickSpark } from "../animations/index.js";

const FEATURES = [
  { n:"01", title:"Übersicht behalten",       body:"Alle deine Fächer und Noten an einem Ort. Dein aktueller Notendurchschnitt wird automatisch und gewichtet berechnet.", accent:C.g1 },
  { n:"02", title:"Entwicklungen erkennen",   body:"Interaktive Diagramme zeigen dir, wie sich deine Leistungen im Laufe der Zeit verändern. Erkenne Muster und Trends früh.", accent:C.acc },
  { n:"03", title:"Intelligent analysieren",  body:"Notenpilot zeigt dir, welche Fächer deinen Gesamtdurchschnitt verbessern oder verschlechtern — und wo Handlungsbedarf besteht.", accent:C.g3 },
  { n:"04", title:"Modern und übersichtlich", body:"Ein klares, ablenkungsfreies Design sorgt dafür, dass du dich sofort zurechtfindest. Gebaut für Schüler, die es ernst nehmen.", accent:C.accH },
];

const Landing = memo(({ onLogin, onRegister }) => {
  const [vis,setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), 60); return () => clearTimeout(t); }, []);
  const navRef = useRef(null);

  return (
    <div style={{ background:C.bg0, minHeight:"100vh", fontFamily:"inherit", overflowX:"hidden" }}>
      {/* NAV */}
      <nav ref={navRef} style={{ position:"sticky", top:0, zIndex:100, background:C.bg0+"d8", backdropFilter:"blur(18px)", borderBottom:`1px solid ${C.line}`, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0 48px", height:54 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:26, height:26, borderRadius:R.s, background:C.acc, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          </div>
          <span style={{ fontSize:14, fontWeight:900, letterSpacing:"-0.04em", color:C.t0 }}>
            <VariableProximity label="Notenpilot" containerRef={navRef} radius={90}/>
          </span>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <SparkBtn variant="ghost" onClick={onLogin}>Anmelden</SparkBtn>
          <SparkBtn onClick={onRegister}>Account erstellen</SparkBtn>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ maxWidth:"100%", margin:"0 auto", padding:"96px 48px 72px", textAlign:"center" }}>
        <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:vis?1:0, y:vis?0:10 }} transition={{ duration:0.5 }}
          style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"4px 14px", borderRadius:R.f, background:C.accDim, border:`1px solid ${C.acc}30`, fontSize:11, fontWeight:700, color:C.accH, letterSpacing:"0.06em", marginBottom:30, textTransform:"uppercase" }}
        >Noten einfach verwalten</motion.div>

        <div style={{ fontSize:"clamp(36px,7vw,68px)", fontWeight:900, letterSpacing:"-0.05em", lineHeight:1.04, color:C.t0, marginBottom:8 }}>
          <BlurText text="Behalte deine Schulnoten" delay={100} animateBy="words" direction="top" stepDuration={0.3}/>
        </div>
        <div style={{ fontSize:"clamp(32px,6vw,62px)", fontWeight:900, letterSpacing:"-0.05em", lineHeight:1.04, marginBottom:28 }}>
          <BlurText text="im Blick." delay={130} animateBy="words" direction="top" stepDuration={0.34}/>
        </div>

        <motion.p initial={{ opacity:0, y:14 }} animate={{ opacity:vis?1:0, y:vis?0:14 }} transition={{ duration:0.55, delay:0.45 }}
          style={{ fontSize:17, color:C.t1, maxWidth:460, margin:"0 auto 14px", lineHeight:1.65 }}>
          Analysiere deinen Schnitt. Verstehe deine Leistung.
        </motion.p>
        <motion.p initial={{ opacity:0 }} animate={{ opacity:vis?1:0 }} transition={{ duration:0.5, delay:0.65 }}
          style={{ fontSize:14, color:C.t2, maxWidth:430, margin:"0 auto 42px", lineHeight:1.7 }}>
          Notenpilot ist eine moderne Web-App für Schüler, um Noten übersichtlich zu verwalten,
          Entwicklungen zu erkennen und den eigenen Notendurchschnitt zu analysieren.
        </motion.p>
        <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:vis?1:0, y:vis?0:10 }} transition={{ duration:0.5, delay:0.75 }}
          style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <SparkBtn size="lg" onClick={onRegister}>Account erstellen</SparkBtn>
          <SparkBtn variant="ghost" size="lg" onClick={onLogin}>App starten</SparkBtn>
        </motion.div>
      </div>

      {/* MOCK PREVIEW */}
      <motion.div initial={{ opacity:0, y:28 }} animate={{ opacity:vis?1:0, y:vis?0:28 }} transition={{ duration:0.65, delay:0.55 }}
        style={{ maxWidth:860, margin:"0 auto 96px", padding:"0 48px" }}>
        <div style={{ background:C.bg2, border:`1px solid ${C.lineH}`, borderRadius:R.xl, overflow:"hidden", boxShadow:"0 48px 100px rgba(0,0,0,0.8)" }}>
          <div style={{ background:C.bg3, borderBottom:`1px solid ${C.line}`, padding:"11px 18px", display:"flex", gap:7, alignItems:"center" }}>
            {[C.err,C.wrn,C.ok].map((c,i)=><div key={i} style={{width:10,height:10,borderRadius:"50%",background:c+"88"}}/>)}
            <div style={{ flex:1, height:18, background:C.bg4, borderRadius:R.f, marginLeft:8 }}/>
          </div>
          <div style={{ padding:22 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:12 }}>
              {[["Schnitt","1.87",C.g2],["Noten","8",C.t0],["Bestes","Mathe",C.t0],["Level","4",C.acc]].map(([l,v,cl],i)=>(
                <div key={i} style={{background:C.bg3,borderRadius:R.l,padding:"12px 14px",border:`1px solid ${C.line}`}}>
                  <div style={{fontSize:9,color:C.t2,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:5}}>{l}</div>
                  <div style={{fontSize:i===0?24:18,fontWeight:900,color:cl,letterSpacing:"-0.04em"}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ background:C.bg3, borderRadius:R.l, padding:"14px 16px", border:`1px solid ${C.line}`, height:64, display:"flex", alignItems:"flex-end", gap:4 }}>
              {[28,45,38,62,52,78,68,88,82,96].map((h,i)=>(
                <div key={i} style={{flex:1,height:`${h}%`,background:C.acc,borderRadius:"2px 2px 0 0",opacity:0.4+i*0.06}}/>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* FEATURES */}
      <div id="features" style={{ maxWidth:780, margin:"0 auto 100px", padding:"0 48px" }}>
        <div style={{ textAlign:"center", marginBottom:64 }}>
          <div style={{ fontSize:"clamp(26px,5vw,42px)", fontWeight:900, letterSpacing:"-0.04em", color:C.t0, lineHeight:1.1, marginBottom:20 }}>
            <ScrollFloat>Was Notenpilot bietet</ScrollFloat>
          </div>
          <div style={{ fontSize:16, color:C.t1, maxWidth:440, margin:"0 auto", lineHeight:1.7 }}>
            <ScrollReveal baseOpacity={0.06} baseRotation={2} blurStrength={4} wordAnimationEnd="bottom center">
              Alles was du brauchst, um deine schulischen Leistungen wirklich zu verstehen und systematisch zu verbessern.
            </ScrollReveal>
          </div>
        </div>
        <ScrollStack itemDistance={80} itemScale={0.03} itemStackDistance={28} stackPosition="18%" scaleEndPosition="8%" baseScale={0.86}>
          {FEATURES.map((f, i) => (
            <ScrollStackItem key={i}>
              <div style={{ background:C.bg2, border:`1px solid ${C.line}`, borderRadius:R.xl, padding:"32px 36px", display:"flex", gap:24, alignItems:"flex-start" }}>
                <div style={{ width:44, height:44, borderRadius:R.m, background:f.accent+"18", border:`1px solid ${f.accent}28`, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <div style={{ width:16, height:16, borderRadius:3, background:f.accent, opacity:0.9 }}/>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:17, fontWeight:700, color:C.t0, marginBottom:10, letterSpacing:"-0.02em" }}>{f.title}</div>
                  <div style={{ fontSize:14, color:C.t1, lineHeight:1.7 }}>{f.body}</div>
                </div>
                <div style={{ fontSize:44, fontWeight:900, color:C.t3, letterSpacing:"-0.05em", alignSelf:"center", userSelect:"none" }}>{f.n}</div>
              </div>
            </ScrollStackItem>
          ))}
        </ScrollStack>
      </div>

      {/* CTA */}
      <div style={{ borderTop:`1px solid ${C.line}`, padding:"72px 48px", textAlign:"center", background:C.bg1 }}>
        <div style={{ fontSize:"clamp(24px,4vw,36px)", fontWeight:800, letterSpacing:"-0.03em", color:C.t0, marginBottom:14 }}>
          <ScrollFloat>Bereit für mehr Überblick?</ScrollFloat>
        </div>
        <p style={{ fontSize:15, color:C.t1, maxWidth:380, margin:"0 auto 36px" }}>
          Starte jetzt — kostenlos, ohne Abo, ohne versteckte Kosten.
        </p>
        <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
          <SparkBtn size="lg" onClick={onRegister}>Account erstellen</SparkBtn>
          <SparkBtn variant="ghost" size="lg" onClick={onLogin}>Anmelden</SparkBtn>
        </div>
      </div>

      <div style={{ borderTop:`1px solid ${C.line}`, padding:"18px 48px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:11, color:C.t2 }}>Notenpilot · Alle Daten lokal gespeichert</span>
        <span style={{ fontSize:11, color:C.t2 }}>Kein Tracking · Kein Abo</span>
      </div>
    </div>
  );
});

export default Landing;