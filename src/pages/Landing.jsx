import { useState, useEffect, useRef, memo } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { C, R } from "../utils/tokens.jsx";
import { SparkBtn } from "../components/ui.jsx";
import { ClickSpark } from "../animations/index.jsx";
import iphoneGlbUrl from "../assets/iphone_17_pro_max.glb?url";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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

// ─── Animated stat counter ────────────────────────────────────────────────────
// countDown: if true, animates from `from` down to `to`
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
      initial={{ opacity: 0, y: 32 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: C.bg2, border: `1px solid ${C.line}`, borderRadius: R.xl,
        padding: "32px 36px", display: "flex", gap: 24, alignItems: "flex-start",
        position: "relative", overflow: "hidden",
      }}
      whileHover={{ borderColor: f.accent + "55", y: -3, transition: { duration: 0.18 } }}
    >
      <div style={{ position: "absolute", top: 0, right: 0, width: 160, height: 160, background: `radial-gradient(circle at top right, ${f.accent}10, transparent 70%)`, pointerEvents: "none" }}/>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${f.accent}35, transparent)` }}/>
      <div style={{ width: 48, height: 48, borderRadius: R.m, background: f.accent + "18", border: `1px solid ${f.accent}28`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: f.accent }}>
        {f.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.t0, marginBottom: 10, letterSpacing: "-0.02em" }}>{f.title}</div>
        <div style={{ fontSize: 14, color: C.t1, lineHeight: 1.75 }}>{f.body}</div>
      </div>
      <div style={{ fontSize: 50, fontWeight: 900, color: C.t3, letterSpacing: "-0.05em", alignSelf: "center", userSelect: "none", flexShrink: 0 }}>{f.n}</div>
    </motion.div>
  );
};

const SparkLink = ({ children, onClick, variant = "primary", size = "lg" }) => (
  <ClickSpark sparkColor={variant === "primary" ? C.accH : C.acc} sparkCount={10} sparkRadius={28} sparkSize={9} duration={450}>
    <SparkBtn variant={variant} size={size} onClick={onClick}>{children}</SparkBtn>
  </ClickSpark>
);

// ─── Phone Mockup (Three.js) ──────────────────────────────────────────────────
const PhoneMockup = ({ vis }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let animId;
    let renderer;

    const setup = () => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(28, el.clientWidth / el.clientHeight, 0.1, 100);
      camera.position.set(0.6, 1.4, 5.8);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.9;
      renderer.setSize(el.clientWidth, el.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      el.appendChild(renderer.domElement);

      // ── Studio Lighting ──────────────────────────────────────────────────
      // Key light — warm, from top-left front
      const keyLight = new THREE.DirectionalLight(0xfff5e0, 1.8);
      keyLight.position.set(-3, 6, 4);
      scene.add(keyLight);

      // Fill light — cool blue, opposite side, soft
      const fillLight = new THREE.DirectionalLight(0xc8d8ff, 0.7);
      fillLight.position.set(4, 2, 3);
      scene.add(fillLight);

      // Rim light — bright backlight for metal edge glow
      const rimLight = new THREE.DirectionalLight(0xffffff, 2.2);
      rimLight.position.set(2, -1, -5);
      scene.add(rimLight);

      // Top light — subtle overhead
      const topLight = new THREE.DirectionalLight(0xffffff, 0.8);
      topLight.position.set(0, 8, 0);
      scene.add(topLight);

      // Ambient — very dark, let lights do the work
      scene.add(new THREE.AmbientLight(0x111122, 0.4));

      // Environment map via gradient CubeRenderTarget for reflections
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileCubemapShader();
      // Simple gradient env using a CubeCamera scene
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x1a1a2e);
      const envLight1 = new THREE.DirectionalLight(0xffffff, 2); envLight1.position.set(1,1,1); envScene.add(envLight1);
      const envLight2 = new THREE.DirectionalLight(0x4466ff, 1); envLight2.position.set(-1,0,-1); envScene.add(envLight2);
      const envTex = pmrem.fromScene(envScene).texture;
      scene.environment = envTex;
      pmrem.dispose();

      // Canvas-Textur: App Mockup
      const makeScreenTexture = () => {
        const W = 780, H = 1688, s = 2;
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const ctx = cv.getContext('2d');

        // Background
        ctx.fillStyle = '#07070c'; ctx.fillRect(0,0,W,H);

        // Status bar
        ctx.fillStyle = '#0b0b12'; ctx.fillRect(0,0,W,54*s);

        // Logo
        ctx.fillStyle = '#5b6ef0';
        ctx.beginPath(); ctx.roundRect(12*s,12*s,26*s,26*s,6*s); ctx.fill();
        ctx.fillStyle = '#ededf8'; ctx.font = `bold ${14*s}px system-ui`;
        ctx.fillText('Notenpilot', 46*s, 30*s);

        // Greeting
        ctx.fillStyle = '#ededf8'; ctx.font = `bold ${20*s}px system-ui`;
        ctx.fillText('Guten Tag.', 12*s, 76*s);
        ctx.fillStyle = '#8080a0'; ctx.font = `${11*s}px system-ui`;
        ctx.fillText('Dein aktueller Leistungsüberblick.', 12*s, 94*s);

        // 4 stat cards (2x2 grid)
        const cards = [
          ['Gesamtschnitt','1.87','#4ed468'],
          ['Noten gesamt','8','#ededf8'],
          ['Bestes Fach','Mathe','#ededf8'],
          ['Schwächstes','Deutsch','#e87830'],
        ];
        const cW=178*s, cH=82*s, gap=6*s, cx0=12*s, cy0=108*s;
        cards.forEach(([l,v,c],i) => {
          const col=i%2, row=Math.floor(i/2);
          const x=cx0+col*(cW+gap), y=cy0+row*(cH+gap);
          ctx.fillStyle='#0f0f18'; ctx.beginPath(); ctx.roundRect(x,y,cW,cH,10*s); ctx.fill();
          ctx.strokeStyle='#1c1c2e'; ctx.lineWidth=s; ctx.stroke();
          ctx.fillStyle='#404058'; ctx.font=`${8*s}px system-ui`; ctx.fillText(l.toUpperCase(),x+10*s,y+17*s);
          ctx.fillStyle=c; ctx.font=`bold ${i===0?22*s:16*s}px system-ui`; ctx.fillText(v,x+10*s,y+56*s);
        });

        // Chart card
        const chartY=cy0+2*(cH+gap)+8*s;
        ctx.fillStyle='#0b0b12'; ctx.beginPath(); ctx.roundRect(12*s,chartY,W-24*s,128*s,12*s); ctx.fill();
        ctx.strokeStyle='#1c1c2e'; ctx.lineWidth=s; ctx.stroke();
        ctx.fillStyle='#ededf8'; ctx.font=`bold ${11*s}px system-ui`; ctx.fillText('Notenverlauf',24*s,chartY+20*s);

        const pts=[0.15,0.32,0.22,0.52,0.45,0.70,0.63,0.82,0.76,0.91,0.87,0.96];
        const cL=34*s, cR=W-16*s, cB=chartY+118*s, cT=chartY+32*s;
        const gx=i=>cL+(i/(pts.length-1))*(cR-cL);
        const gy=v=>cB-v*(cB-cT);

        // Grid
        ctx.strokeStyle='#1c1c2e'; ctx.lineWidth=0.5*s;
        [0,0.25,0.5,0.75,1].forEach(v=>{ctx.beginPath();ctx.moveTo(cL,gy(v));ctx.lineTo(cR,gy(v));ctx.stroke();});

        // Gradient fill
        const grad=ctx.createLinearGradient(0,cT,0,cB);
        grad.addColorStop(0,'rgba(91,110,240,0.35)'); grad.addColorStop(1,'rgba(91,110,240,0)');
        ctx.fillStyle=grad; ctx.beginPath(); ctx.moveTo(gx(0),cB);
        pts.forEach((v,i)=>ctx.lineTo(gx(i),gy(v)));
        ctx.lineTo(gx(pts.length-1),cB); ctx.closePath(); ctx.fill();

        // Line
        ctx.beginPath(); ctx.strokeStyle='#5b6ef0'; ctx.lineWidth=2.5*s; ctx.lineJoin='round';
        pts.forEach((v,i)=>i===0?ctx.moveTo(gx(i),gy(v)):ctx.lineTo(gx(i),gy(v))); ctx.stroke();

        // Dots
        pts.forEach((v,i)=>{
          ctx.beginPath(); ctx.arc(gx(i),gy(v),3*s,0,Math.PI*2);
          ctx.fillStyle='#5b6ef0'; ctx.fill();
          ctx.strokeStyle='#07070c'; ctx.lineWidth=1.5*s; ctx.stroke();
        });

        // Recent grades list
        const listY=chartY+138*s;
        ctx.fillStyle='#0b0b12'; ctx.beginPath(); ctx.roundRect(12*s,listY,W-24*s,196*s,12*s); ctx.fill();
        ctx.strokeStyle='#1c1c2e'; ctx.lineWidth=s; ctx.stroke();
        ctx.fillStyle='#ededf8'; ctx.font=`bold ${11*s}px system-ui`; ctx.fillText('Zuletzt eingetragen',24*s,listY+20*s);

        [['Mathematik','1.0','#26d49a','Schulaufgabe'],
         ['Deutsch','2.5','#4ed468','Ausfrage'],
         ['Physik','1.5','#26d49a','Kurztest'],
         ['Englisch','2.0','#4ed468','Kurztest']].forEach(([s2,g,c,t],i)=>{
          const ry=listY+38*s+i*38*s;
          if(i>0){ctx.strokeStyle='#1c1c2e';ctx.lineWidth=0.5*s;ctx.beginPath();ctx.moveTo(24*s,ry-8*s);ctx.lineTo(W-24*s,ry-8*s);ctx.stroke();}
          ctx.fillStyle='#ededf8'; ctx.font=`bold ${12*s}px system-ui`; ctx.fillText(s2,24*s,ry+8*s);
          ctx.fillStyle='#8080a0'; ctx.font=`${9*s}px system-ui`; ctx.fillText(t,24*s,ry+22*s);
          ctx.fillStyle=c; ctx.font=`bold ${20*s}px system-ui`; ctx.fillText(g,W-72*s,ry+14*s);
        });

        return new THREE.CanvasTexture(cv);
      };



      let phone;
      const loader = new GLTFLoader();
      loader.load(iphoneGlbUrl, (gltf) => {
        phone = gltf.scene;
        const box = new THREE.Box3().setFromObject(phone);
        const size = box.getSize(new THREE.Vector3()).length();
        phone.scale.setScalar(2.7 / size);
        const center = box.getCenter(new THREE.Vector3());
        phone.position.sub(center);
        phone.rotation.y = Math.PI * 0.5;
        scene.add(phone);

        // Try flipY=true (standard for canvas textures)
        const tex = makeScreenTexture();
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = true;
        tex.needsUpdate = true;

        phone.traverse((child) => {
          if (!child.isMesh) return;
          const n = child.name.toLowerCase();

          if (child.name === 'Cube010_screen001_0') {
            // Screen faces X-axis (BB: x tiny, y=height, z=width)
            // Plane must be in Y-Z plane, rotated 90° around Y
            child.geometry.computeBoundingBox();
            const bb = child.geometry.boundingBox;

            const w = bb.max.z - bb.min.z; // width along Z
            const h = bb.max.y - bb.min.y; // height along Y
            const cx = (bb.min.x + bb.max.x) / 2;
            const cy = (bb.min.y + bb.max.y) / 2;
            const cz = (bb.min.z + bb.max.z) / 2;

            const planeGeo = new THREE.PlaneGeometry(w, h);
            const planeMat = new THREE.MeshBasicMaterial({
              map: tex,
              side: THREE.DoubleSide,
              toneMapped: false,
              color: 0xffffff,
              depthTest: false,
              depthWrite: false,
            });
            const plane = new THREE.Mesh(planeGeo, planeMat);
            // Position at screen center, rotate to face X axis
            plane.position.set(cx, cy, cz);
            plane.rotation.y = -Math.PI / 2; // rotate to face X (negative)
            plane.renderOrder = 1000;
            child.add(plane);
            console.log('Plane added: w=' + w.toFixed(3) + ' h=' + h.toFixed(3));

          } else if (n.includes('metalframe') || n.includes('metal')) {
            child.material.roughness = 0.05;
            child.material.metalness = 1.0;
            child.material.needsUpdate = true;

          } else if (n.includes('black') || n.includes('basecolor')) {
            child.material.roughness = 0.3;
            child.material.metalness = 0.8;
            child.material.needsUpdate = true;

          } else {
            // Hide EVERYTHING else — glass, screen cover, any overlay
            child.visible = false;
          }
        });
      });

      // Startwert: nach dem Laden wird baseY gesetzt (welcher Winkel zeigt Vorderseite)
      // Sway: ±10° um diesen Startwert
      const MAX_SWAY = Math.PI / 18; // ±10°
      const animate = () => {
        animId = requestAnimationFrame(animate);
        if (phone) {

          // Smooth interpolate toward mouse target
          currentX += (targetX - currentX) * 0.05;
          currentY += (targetY - currentY) * 0.05;
          const sway = Math.sin(Date.now() * 0.0008) * MAX_SWAY;
          phone.rotation.y = Math.PI * 0.5 + sway + currentX;
          phone.rotation.x = currentY;
          phone.position.y = Math.sin(Date.now() * 0.0015) * 0.08;
        }
        renderer.render(scene, camera);
      };
      animate();

      // Mouse hover tilt
      let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
      const onMouseMove = (e) => {
        const rect = el.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        targetX = nx * 0.35;
        targetY = ny * 0.25;
      };
      const onMouseLeave = () => { targetX = 0; targetY = 0; };
      el.addEventListener('mousemove', onMouseMove);
      el.addEventListener('mouseleave', onMouseLeave);

      const onResize = () => {
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(el.clientWidth, el.clientHeight);
      };
      window.addEventListener('resize', onResize);


      return () => {
        window.removeEventListener('resize', onResize);
        el.removeEventListener('mousemove', onMouseMove);
        el.removeEventListener('mouseleave', onMouseLeave);
        cancelAnimationFrame(animId);
        renderer.dispose();
        if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      };
    };

    const cleanup = setup();
    return () => { cleanup?.(); };
  }, []);

  return (
    <motion.div
      initial={{ opacity:0, y:40 }}
      animate={{ opacity:vis ? 1 : 0, y:vis ? 0 : 40 }}
      transition={{ duration:0.7, delay:0.5 }}
      style={{ maxWidth:900, margin:"0 auto 0", display:"flex", justifyContent:"center", position:"relative" }}
    >
      <div ref={containerRef} style={{ width:"100%", height:"550px" }}/>


    </motion.div>
  );
};

// ─── Hero Background ──────────────────────────────────────────────────────────
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
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ position:"relative", overflow:"hidden", borderTop:`1px solid ${C.line}`, padding:"100px 48px", textAlign:"center", background:C.bg1 }}>
      <motion.div style={{ y: bgY, position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:700, height:400, background:`radial-gradient(ellipse, ${C.acc}16, transparent 70%)`, pointerEvents:"none" }}/>
      <motion.div
        initial={{ opacity:0, y:24 }}
        animate={visible ? { opacity:1, y:0 } : {}}
        transition={{ duration:0.55 }}
        style={{ position:"relative", zIndex:1 }}
      >
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
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ textAlign:"center", marginBottom:56 }}>
      <motion.div
        initial={{ opacity:0, y:20 }}
        animate={visible ? { opacity:1, y:0 } : {}}
        transition={{ duration:0.5 }}
        style={{ fontSize:"clamp(28px,4vw,44px)", fontWeight:900, letterSpacing:"-0.04em", color:C.t0, lineHeight:1.1, marginBottom:14 }}
      >
        Was Notenpilot bietet
      </motion.div>
      <motion.p
        initial={{ opacity:0, y:12 }}
        animate={visible ? { opacity:1, y:0 } : {}}
        transition={{ duration:0.5, delay:0.1 }}
        style={{ fontSize:16, color:C.t1, maxWidth:500, margin:"0 auto", lineHeight:1.7 }}
      >
        Alles was du brauchst, um deine schulischen Leistungen wirklich zu verstehen und systematisch zu verbessern.
      </motion.p>
    </div>
  );
};

// ─── Main Landing component ───────────────────────────────────────────────────
const Landing = memo(({ onLogin, onRegister }) => {
  const [vis, setVis] = useState(false);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], [0, 70]);
  const heroOpacity = useTransform(scrollY, [0, 280], [1, 0.25]);

  useEffect(() => {
    const t = setTimeout(() => setVis(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ background:C.bg0, minHeight:"100vh", fontFamily:"inherit", overflowX:"hidden" }}>

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
          padding:"0 48px", height:56,
        }}
      >
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:28, height:28, borderRadius:R.s, background:C.acc, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <span style={{ fontSize:15, fontWeight:900, letterSpacing:"-0.04em", color:C.t0 }}>Notenpilot</span>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <ClickSpark sparkColor={C.acc} sparkCount={8} sparkRadius={22} sparkSize={8} duration={380}>
            <SparkBtn variant="ghost" onClick={onLogin}>Anmelden</SparkBtn>
          </ClickSpark>
          <ClickSpark sparkColor={C.accH} sparkCount={10} sparkRadius={24} sparkSize={9} duration={420}>
            <SparkBtn onClick={onRegister}>Account erstellen</SparkBtn>
          </ClickSpark>
        </div>
      </motion.nav>

      {/* HERO */}
      <div style={{ position:"relative", overflow:"hidden", minHeight:"92vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <HeroBackground />

        {/* ── Floating Cards — left ── */}
        <motion.div
          initial={{ opacity:0, x:-30 }} animate={{ opacity:vis?1:0, x:vis?0:-30 }}
          transition={{ duration:0.7, delay:0.9 }}
          style={{ position:"absolute", left:"4%", top:"18%", zIndex:2, pointerEvents:"none" }}
        >
          <motion.div
            animate={{ y:[0,-12,0], rotate:[-1,1,-1] }}
            transition={{ duration:4.2, repeat:Infinity, ease:"easeInOut" }}
            style={{ width:172, background:C.bg2, border:`1px solid ${C.lineH}`, borderRadius:R.l, padding:"15px 17px", boxShadow:`0 20px 48px rgba(0,0,0,0.65), 0 0 24px ${C.acc}12` }}
          >
            <div style={{ fontSize:10, color:C.t2, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>Gesamtschnitt</div>
            <div style={{ fontSize:32, fontWeight:900, color:"#4ed468", letterSpacing:"-0.05em", lineHeight:1 }}>1.87</div>
            <div style={{ fontSize:11, color:C.t2, marginTop:5 }}>Sehr gut ↑</div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity:0, x:-30 }} animate={{ opacity:vis?1:0, x:vis?0:-30 }}
          transition={{ duration:0.7, delay:1.05 }}
          style={{ position:"absolute", left:"5%", top:"57%", zIndex:2, pointerEvents:"none" }}
        >
          <motion.div
            animate={{ y:[0,9,0], x:[0,5,0] }}
            transition={{ duration:5, repeat:Infinity, ease:"easeInOut", delay:0.8 }}
            style={{ width:158, background:C.bg2, border:`1px solid ${C.lineH}`, borderRadius:R.l, padding:"13px 16px", boxShadow:`0 14px 36px rgba(0,0,0,0.6)` }}
          >
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:C.g1 }}/>
              <div style={{ fontSize:11, fontWeight:700, color:C.t0 }}>Neue Note</div>
            </div>
            <div style={{ fontSize:13, color:C.t1, lineHeight:1.5 }}>Mathe SA<br/><span style={{ color:C.g1, fontWeight:700 }}>1.0</span> · ×2 Gewicht</div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity:0, x:-20 }} animate={{ opacity:vis?1:0, x:vis?0:-20 }}
          transition={{ duration:0.7, delay:1.2 }}
          style={{ position:"absolute", left:"2%", top:"39%", zIndex:2, pointerEvents:"none" }}
        >
          <motion.div
            animate={{ y:[0,-7,0] }}
            transition={{ duration:3.6, repeat:Infinity, ease:"easeInOut", delay:1.4 }}
            style={{ width:138, background:`${C.acc}14`, border:`1px solid ${C.acc}32`, borderRadius:R.l, padding:"11px 14px", boxShadow:`0 10px 28px rgba(0,0,0,0.45)` }}
          >
            <div style={{ fontSize:10, color:C.accH, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:6 }}>Trend</div>
            <div style={{ fontSize:14, fontWeight:800, color:C.t0 }}>↑ Verbessert</div>
            <div style={{ fontSize:11, color:C.t1, marginTop:3 }}>2.3 → 1.87</div>
          </motion.div>
        </motion.div>

        {/* 7th card: Schnitt verbessert — same style, left group bottom */}
        <motion.div
          initial={{ opacity:0, x:-25 }} animate={{ opacity:vis?1:0, x:vis?0:-25 }}
          transition={{ duration:0.7, delay:1.35 }}
          style={{ position:"absolute", left:"4%", top:"74%", zIndex:2, pointerEvents:"none" }}
        >
          <motion.div
            animate={{ y:[0,8,0], x:[0,3,0] }}
            transition={{ duration:3.8, repeat:Infinity, ease:"easeInOut", delay:0.6 }}
            style={{ width:158, background:C.bg2, border:`1px solid ${C.lineH}`, borderRadius:R.l, padding:"12px 15px", boxShadow:`0 12px 32px rgba(0,0,0,0.55), 0 0 18px ${C.g1}0c`, display:"flex", alignItems:"center", gap:12 }}
          >
            <div style={{ width:34, height:34, borderRadius:R.s, background:`${C.g1}20`, border:`1px solid ${C.g1}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:900, color:C.g1, flexShrink:0 }}>↑</div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:C.t0 }}>Schnitt verbessert</div>
              <div style={{ fontSize:10, color:C.t2, marginTop:2 }}>2.3 → 1.87</div>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Floating Cards — right ── */}
        <motion.div
          initial={{ opacity:0, x:30 }} animate={{ opacity:vis?1:0, x:vis?0:30 }}
          transition={{ duration:0.7, delay:0.95 }}
          style={{ position:"absolute", right:"4%", top:"18%", zIndex:2, pointerEvents:"none" }}
        >
          <motion.div
            animate={{ y:[0,-13,0], rotate:[1,-1,1] }}
            transition={{ duration:4.8, repeat:Infinity, ease:"easeInOut", delay:0.4 }}
            style={{ width:175, background:C.bg2, border:`1px solid ${C.lineH}`, borderRadius:R.l, padding:"14px 16px", boxShadow:`0 20px 48px rgba(0,0,0,0.65), 0 0 24px ${C.accH}0e` }}
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
          initial={{ opacity:0, x:30 }} animate={{ opacity:vis?1:0, x:vis?0:30 }}
          transition={{ duration:0.7, delay:1.1 }}
          style={{ position:"absolute", right:"5%", top:"56%", zIndex:2, pointerEvents:"none" }}
        >
          <motion.div
            animate={{ y:[0,10,0], x:[0,-5,0] }}
            transition={{ duration:4.4, repeat:Infinity, ease:"easeInOut", delay:1.1 }}
            style={{ width:158, background:C.bg2, border:`1px solid ${C.lineH}`, borderRadius:R.l, padding:"13px 15px", boxShadow:`0 14px 34px rgba(0,0,0,0.55)` }}
          >
            <div style={{ fontSize:10, color:C.t2, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:9 }}>Fächer</div>
            {[["Physik","1.0",C.g1],["Mathe","1.87",C.g2],["Deutsch","2.5",C.g2]].map(([fach,note,col])=>(
              <div key={fach} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0" }}>
                <span style={{ fontSize:12, color:C.t1 }}>{fach}</span>
                <span style={{ fontSize:13, fontWeight:800, color:col }}>{note}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity:0, x:20 }} animate={{ opacity:vis?1:0, x:vis?0:20 }}
          transition={{ duration:0.7, delay:1.3 }}
          style={{ position:"absolute", right:"3%", top:"38%", zIndex:2, pointerEvents:"none" }}
        >
          <motion.div
            animate={{ y:[0,-8,0] }}
            transition={{ duration:3.2, repeat:Infinity, ease:"easeInOut", delay:2 }}
            style={{ width:128, background:`${C.g1}12`, border:`1px solid ${C.g1}28`, borderRadius:R.l, padding:"11px 13px", boxShadow:`0 10px 24px rgba(0,0,0,0.45)` }}
          >
            <div style={{ fontSize:10, color:C.g1, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:6 }}>Streak</div>
            <div style={{ fontSize:22, fontWeight:900, color:C.t0, letterSpacing:"-0.03em" }}>12 🔥</div>
            <div style={{ fontSize:11, color:C.t1, marginTop:3 }}>Tage aktiv</div>
          </motion.div>
        </motion.div>

        <motion.div style={{ y: heroY, opacity: heroOpacity, position:"relative", zIndex:1, textAlign:"center", padding:"0 24px", maxWidth:920, width:"100%" }}>
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
            style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}
          >
            <SparkLink onClick={onRegister}>Jetzt starten — kostenlos</SparkLink>
            <SparkLink variant="ghost" onClick={onLogin}>Anmelden</SparkLink>
          </motion.div>
        </motion.div>
      </div>

      {/* MOCK PREVIEW */}
      <PhoneMockup vis={vis} />

      {/* STATS ROW */}
      <div style={{ maxWidth:900, margin:"-120px auto 90px", padding:"0 60px", position:"relative", zIndex:10 }}>
        <div style={{ display:"flex", background:C.bg2, border:`1px solid ${C.line}`, borderRadius:R.xl, overflow:"hidden" }}>
          {/* ∞ Notentypen — static symbol, no count animation */}
          <div style={{ textAlign:"center", flex:1, padding:"32px 24px", borderRight:`1px solid ${C.line}` }}>
            <div style={{ fontSize:44, fontWeight:900, color:C.t0, letterSpacing:"-0.04em", lineHeight:1, marginBottom:6 }}>∞</div>
            <div style={{ fontSize:11, color:C.t2, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>Notentypen</div>
          </div>
          {/* 100% Datenschutz — counts 0→100 */}
          <StatCounter from={0} to={100} suffix="%" label="Datenschutz" delay={150} />
          {/* 0€ — counts DOWN 100→0 */}
          <StatCounter from={100} to={0} suffix="€" label="Für immer kostenlos" delay={300} last />
        </div>
      </div>

      {/* FEATURES */}
      <div id="features" style={{ maxWidth:1100, margin:"0 auto", padding:"40px 48px 100px" }}>
        <FeaturesHeading />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          {FEATURES.map((f, i) => <FeatureCard key={i} f={f} i={i} />)}
        </div>
      </div>

      {/* CTA */}
      <CTASection onRegister={onRegister} onLogin={onLogin} />

      {/* FOOTER */}
      <div style={{ borderTop:`1px solid ${C.line}`, padding:"20px 48px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:18, height:18, borderRadius:4, background:C.acc, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          </div>
          <span style={{ fontSize:12, color:C.t2, fontWeight:600 }}>Notenpilot</span>
        </div>
        <span style={{ fontSize:12, color:C.t2 }}>Kein Tracking · Kein Abo · Open Source</span>
      </div>
    </div>
  );
});

export default Landing;