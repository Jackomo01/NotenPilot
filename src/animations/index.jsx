import { useState, useEffect, useRef, useCallback, useMemo, forwardRef, Children, cloneElement } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useMotionValueEvent, animate as motionAnimate } from "framer-motion";
import { C } from "../utils/tokens.jsx";
import { loadGsap, onGsapReady } from "../utils/gsap.jsx";

// ─── ① BLUR TEXT ─────────────────────────────────────────────────────────────
const buildKeyframes = (from, steps) => {
  const keys = new Set([...Object.keys(from), ...steps.flatMap(s => Object.keys(s))]);
  const keyframes = {};
  keys.forEach(k => { keyframes[k] = [from[k], ...steps.map(s => s[k])]; });
  return keyframes;
};

export const BlurText = ({
  text = "", delay = 200, className = "", animateBy = "words",
  direction = "top", threshold = 0.1, rootMargin = "0px",
  animationFrom, animationTo, easing = t => t,
  onAnimationComplete, stepDuration = 0.35,
}) => {
  const elements = animateBy === "words" ? text.split(" ") : text.split("");
  const [inView, setInView] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); observer.unobserve(ref.current); }
    }, { threshold, rootMargin });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);
  const defaultFrom = useMemo(() =>
    direction === "top" ? { filter:"blur(10px)", opacity:0, y:-50 } : { filter:"blur(10px)", opacity:0, y:50 }
  , [direction]);
  const defaultTo = useMemo(() => [
    { filter:"blur(5px)", opacity:0.5, y: direction === "top" ? 5 : -5 },
    { filter:"blur(0px)", opacity:1, y:0 },
  ], [direction]);
  const fromSnapshot = animationFrom ?? defaultFrom;
  const toSnapshots  = animationTo   ?? defaultTo;
  const stepCount    = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) => stepCount === 1 ? 0 : i / (stepCount - 1));
  return (
    <p ref={ref} className={className} style={{ display:"flex", flexWrap:"wrap" }}>
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);
        const spanTransition = { duration: totalDuration, times, delay: (index * delay) / 1000, ease: easing };
        return (
          <motion.span key={index} className="inline-block"
            initial={fromSnapshot}
            animate={inView ? animateKeyframes : fromSnapshot}
            transition={spanTransition}
            onAnimationComplete={index === elements.length - 1 ? onAnimationComplete : undefined}
          >
            {segment === " " ? "\u00A0" : segment}
            {animateBy === "words" && index < elements.length - 1 && "\u00A0"}
          </motion.span>
        );
      })}
    </p>
  );
};

// ─── ② SCROLL REVEAL ─────────────────────────────────────────────────────────
export const ScrollReveal = ({
  children, scrollContainerRef, enableBlur = true,
  baseOpacity = 0.1, baseRotation = 3, blurStrength = 4,
  containerClassName = "", textClassName = "",
  rotationEnd = "bottom bottom", wordAnimationEnd = "bottom bottom",
}) => {
  const containerRef = useRef(null);
  const [gsapLoaded, setGsapLoaded] = useState(false);
  const splitText = useMemo(() => {
    const text = typeof children === "string" ? children : "";
    return text.split(/(\s+)/).map((word, index) => {
      if (word.match(/^\s+$/)) return word;
      return <span className="sr-word" key={index} style={{ display:"inline-block" }}>{word}</span>;
    });
  }, [children]);
  useEffect(() => { loadGsap(); onGsapReady(() => setGsapLoaded(true)); }, []);
  useEffect(() => {
    if (!gsapLoaded) return;
    const el = containerRef.current; if (!el) return;
    const g = window.gsap, ST = window.ScrollTrigger;
    const scroller = scrollContainerRef?.current ?? window;
    g.fromTo(el, { transformOrigin:"0% 50%", rotate: baseRotation }, {
      ease:"none", rotate:0,
      scrollTrigger:{ trigger:el, scroller, start:"top bottom", end:rotationEnd, scrub:true },
    });
    const wordElements = el.querySelectorAll(".sr-word");
    g.fromTo(wordElements, { opacity: baseOpacity }, {
      ease:"none", opacity:1, stagger:0.05,
      scrollTrigger:{ trigger:el, scroller, start:"top bottom-=20%", end:wordAnimationEnd, scrub:true },
    });
    if (enableBlur) {
      g.fromTo(wordElements, { filter:`blur(${blurStrength}px)` }, {
        ease:"none", filter:"blur(0px)", stagger:0.05,
        scrollTrigger:{ trigger:el, scroller, start:"top bottom-=20%", end:wordAnimationEnd, scrub:true },
      });
    }
    return () => ST.getAll().forEach(t => t.kill());
  }, [gsapLoaded, scrollContainerRef, enableBlur, baseOpacity, baseRotation, blurStrength, rotationEnd, wordAnimationEnd]);
  return (
    <h2 ref={containerRef} className={containerClassName}>
      <p className={textClassName} style={{ display:"flex", flexWrap:"wrap", gap:"0.3em" }}>{splitText}</p>
    </h2>
  );
};

// ─── ③ SCROLL FLOAT ──────────────────────────────────────────────────────────
export const ScrollFloat = ({ children, className = "" }) => {
  const containerRef = useRef(null);
  const [gsapLoaded, setGsapLoaded] = useState(false);
  const splitText = useMemo(() => {
    const text = typeof children === "string" ? children : "";
    return text.split("").map((char, i) => (
      <span key={i} className="sf-char" style={{ display:"inline-block", overflow:"hidden", lineHeight:1.15 }}>
        <span className="sf-inner" style={{ display:"inline-block", whiteSpace:"pre" }}>
          {char === " " ? "\u00A0" : char}
        </span>
      </span>
    ));
  }, [children]);
  useEffect(() => { loadGsap(); onGsapReady(() => setGsapLoaded(true)); }, []);
  useEffect(() => {
    if (!gsapLoaded) return;
    const el = containerRef.current; if (!el) return;
    const g = window.gsap, ST = window.ScrollTrigger;
    const chars = el.querySelectorAll(".sf-inner");
    g.fromTo(chars, { opacity:0, yPercent:110 }, {
      opacity:1, yPercent:0, stagger:0.03,
      scrollTrigger:{ trigger:el, start:"center bottom+=50%", end:"bottom bottom-=40%", scrub:true },
    });
    return () => ST.getAll().forEach(t => t.kill());
  }, [gsapLoaded]);
  return (
    <h2 ref={containerRef} className={className} style={{ display:"flex", flexWrap:"wrap" }}>
      {splitText}
    </h2>
  );
};

// ─── ④ VARIABLE PROXIMITY ────────────────────────────────────────────────────
export const VariableProximity = forwardRef(({ label, containerRef, radius = 50, style: s }, ref) => {
  const letters = useRef([]);
  useEffect(() => {
    const move = e => {
      if (!containerRef?.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      letters.current.forEach(el => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2 - rect.left;
        const cy = r.top + r.height / 2 - rect.top;
        const d = Math.hypot(cx - x, cy - y);
        if (d < radius) { el.style.transform = "scale(1.4)"; el.style.color = C.accH; }
        else { el.style.transform = "scale(1)"; el.style.color = ""; }
      });
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [radius, containerRef]);
  return (
    <span ref={ref} style={s}>
      {label.split("").map((l, i) => (
        <motion.span key={i} ref={el => letters.current[i] = el}
          style={{ display:"inline-block", transition:"transform 0.12s ease, color 0.12s ease" }}
        >{l}</motion.span>
      ))}
    </span>
  );
});

// ─── ⑤ SCROLL STACK ──────────────────────────────────────────────────────────
export const ScrollStackItem = ({ children, itemClassName = "" }) => (
  <div className={`scroll-stack-card ${itemClassName}`.trim()}>{children}</div>
);

export const ScrollStack = ({
  children, className = "",
  itemDistance = 100, itemScale = 0.03,
  itemStackDistance = 30, stackPosition = "20%",
  scaleEndPosition = "10%", baseScale = 0.85,
  rotationAmount = 0, blurAmount = 0,
}) => {
  const scrollerRef = useRef(null);
  const cardsRef    = useRef([]);
  const lastTRef    = useRef(new Map());
  const rafRef      = useRef(null);

  const parseP = (val, h) => {
    if (typeof val === "string" && val.includes("%")) return (parseFloat(val) / 100) * h;
    return parseFloat(val);
  };

  const update = useCallback(() => {
    const scrollTop = window.scrollY;
    const ch = window.innerHeight;
    const stackPx = parseP(stackPosition, ch);
    const scalePx = parseP(scaleEndPosition, ch);
    const endEl = document.querySelector(".scroll-stack-end");
    const endTop = endEl ? endEl.getBoundingClientRect().top + scrollTop : 0;
    cardsRef.current.forEach((card, i) => {
      if (!card) return;
      const cardTop = card.getBoundingClientRect().top + scrollTop;
      const triggerStart = cardTop - stackPx - itemStackDistance * i;
      const triggerEnd   = cardTop - scalePx;
      const pinStart     = triggerStart;
      const pinEnd       = endTop - ch / 2;
      const scaleProgress = Math.max(0, Math.min(1, (scrollTop - triggerStart) / Math.max(1, triggerEnd - triggerStart)));
      const targetScale = baseScale + i * itemScale;
      const scale = 1 - scaleProgress * (1 - targetScale);
      const rotation = rotationAmount ? i * rotationAmount * scaleProgress : 0;
      let blur = 0;
      if (blurAmount) {
        let topIdx = 0;
        cardsRef.current.forEach((c, j) => {
          const cTop = c?.getBoundingClientRect().top + scrollTop || 0;
          const jTs = cTop - stackPx - itemStackDistance * j;
          if (scrollTop >= jTs) topIdx = j;
        });
        if (i < topIdx) blur = Math.max(0, (topIdx - i) * blurAmount);
      }
      let translateY = 0;
      if (scrollTop >= pinStart && scrollTop <= pinEnd)
        translateY = scrollTop - cardTop + stackPx + itemStackDistance * i;
      else if (scrollTop > pinEnd)
        translateY = pinEnd - cardTop + stackPx + itemStackDistance * i;
      const tY = Math.round(translateY * 100) / 100;
      const sc = Math.round(scale * 1000) / 1000;
      const last = lastTRef.current.get(i);
      if (!last || Math.abs(last.tY - tY) > 0.05 || Math.abs(last.sc - sc) > 0.0005) {
        card.style.transform = `translate3d(0,${tY}px,0) scale(${sc}) rotate(${rotation}deg)`;
        if (blur > 0) card.style.filter = `blur(${blur}px)`; else card.style.filter = "";
        lastTRef.current.set(i, { tY, sc });
      }
    });
  }, [itemScale, itemStackDistance, stackPosition, scaleEndPosition, baseScale, rotationAmount, blurAmount]);

  useEffect(() => {
    const el = scrollerRef.current; if (!el) return;
    const cards = Array.from(document.querySelectorAll(".scroll-stack-card"));
    cardsRef.current = cards;
    cards.forEach((card, i) => {
      if (i < cards.length - 1) card.style.marginBottom = `${itemDistance}px`;
      card.style.willChange = "transform, filter";
      card.style.transformOrigin = "top center";
      card.style.backfaceVisibility = "hidden";
    });
    const onScroll = () => { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive:true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
      lastTRef.current.clear();
    };
  }, [update, itemDistance]);

  return (
    <div ref={scrollerRef} className={`scroll-stack-scroller ${className}`.trim()}>
      <div className="scroll-stack-inner">
        {children}
        <div className="scroll-stack-end" />
      </div>
    </div>
  );
};

// ─── ⑦ ELASTIC SLIDER ────────────────────────────────────────────────────────
const MAX_OVERFLOW = 50;
const decay = (value, max) => {
  if (max === 0) return 0;
  const entry = value / max;
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);
  return sigmoid * max;
};

function ElasticSliderInner({ value, onChange, startingValue, maxValue, isStepped, stepSize, leftIcon, rightIcon }) {
  const sliderRef = useRef(null);
  const [region, setRegion] = useState("middle");
  const clientX  = useMotionValue(0);
  const overflow = useMotionValue(0);
  const scale    = useMotionValue(1);
  useMotionValueEvent(clientX, "change", latest => {
    if (!sliderRef.current) return;
    const { left, right } = sliderRef.current.getBoundingClientRect();
    let newVal;
    if (latest < left) { setRegion("left"); newVal = left - latest; }
    else if (latest > right) { setRegion("right"); newVal = latest - right; }
    else { setRegion("middle"); newVal = 0; }
    overflow.jump(decay(newVal, MAX_OVERFLOW));
  });
  const handlePointerMove = e => {
    if (e.buttons > 0 && sliderRef.current) {
      const { left, width } = sliderRef.current.getBoundingClientRect();
      let nv = startingValue + ((e.clientX - left) / width) * (maxValue - startingValue);
      if (isStepped) nv = Math.round(nv / stepSize) * stepSize;
      nv = Math.min(Math.max(nv, startingValue), maxValue);
      onChange(nv);
      clientX.jump(e.clientX);
    }
  };
  const handlePointerDown = e => { handlePointerMove(e); e.currentTarget.setPointerCapture(e.pointerId); };
  const handlePointerUp   = () => motionAnimate(overflow, 0, { type:"spring", bounce:0.5 });
  const pct = ((value - startingValue) / Math.max(1, maxValue - startingValue)) * 100;
  return (
    <motion.div
      onHoverStart={() => motionAnimate(scale, 1.2)}
      onHoverEnd={()   => motionAnimate(scale, 1)}
      style={{ scale, opacity: useTransform(scale, [1, 1.2], [0.75, 1]), display:"flex", alignItems:"center", gap:10 }}
    >
      <motion.div
        animate={{ scale: region === "left" ? [1, 1.4, 1] : 1, transition:{ duration:0.25 } }}
        style={{ x: useTransform(() => region === "left" ? -overflow.get() / scale.get() : 0), color:C.t2, fontSize:13, minWidth:20, textAlign:"right" }}
      >{leftIcon}</motion.div>
      <div ref={sliderRef} onPointerMove={handlePointerMove} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}
        style={{ flex:1, cursor:"pointer", padding:"10px 0", userSelect:"none" }}
      >
        <motion.div style={{
          scaleX: useTransform(() => sliderRef.current ? 1 + overflow.get() / sliderRef.current.getBoundingClientRect().width : 1),
          scaleY: useTransform(overflow, [0, MAX_OVERFLOW], [1, 0.78]),
          transformOrigin: useTransform(() => {
            if (!sliderRef.current) return "right";
            const { left, width } = sliderRef.current.getBoundingClientRect();
            return clientX.get() < left + width / 2 ? "right" : "left";
          }),
          height: useTransform(scale, [1, 1.2], [6, 10]),
          borderRadius:"9999px", background:C.bg5, position:"relative", overflow:"hidden",
        }}>
          <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${pct}%`, background:C.acc, borderRadius:"9999px", transition:"width 0.05s" }} />
        </motion.div>
      </div>
      <motion.div
        animate={{ scale: region === "right" ? [1, 1.4, 1] : 1, transition:{ duration:0.25 } }}
        style={{ x: useTransform(() => region === "right" ? overflow.get() / scale.get() : 0), color:C.t2, fontSize:13, minWidth:20 }}
      >{rightIcon}</motion.div>
      <div style={{ minWidth:38, height:32, borderRadius:"6px", background:C.bg4, border:`1px solid ${C.lineH}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:C.acc }}>
        ×{value}
      </div>
    </motion.div>
  );
}

export const ElasticSlider = ({ value, onChange, startingValue = 0.5, maxValue = 4, isStepped = true, stepSize = 0.5, label }) => (
  <div>
    {label && <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase", color:C.t2, marginBottom:8 }}>{label}</div>}
    <ElasticSliderInner value={value} onChange={onChange} startingValue={startingValue} maxValue={maxValue}
      isStepped={isStepped} stepSize={stepSize} leftIcon={`×${startingValue}`} rightIcon={`×${maxValue}`} />
  </div>
);

// ─── ⑧ CLICK SPARK ───────────────────────────────────────────────────────────
export const ClickSpark = ({
  sparkColor = "#fff", sparkSize = 10, sparkRadius = 15,
  sparkCount = 8, duration = 400, easing = "ease-out", extraScale = 1.0, children,
}) => {
  const canvasRef    = useRef(null);
  const sparksRef    = useRef([]);
  const startTimeRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const parent = canvas.parentElement; if (!parent) return;
    let rt;
    const resize = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    };
    const handleResize = () => { clearTimeout(rt); rt = setTimeout(resize, 100); };
    const ro = new ResizeObserver(handleResize);
    ro.observe(parent); resize();
    return () => { ro.disconnect(); clearTimeout(rt); };
  }, []);
  const easeFunc = useCallback(t => {
    switch (easing) {
      case "linear":      return t;
      case "ease-in":     return t * t;
      case "ease-in-out": return t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      default: return t * (2 - t);
    }
  }, [easing]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    const draw = ts => {
      if (!startTimeRef.current) startTimeRef.current = ts;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparksRef.current = sparksRef.current.filter(spark => {
        const elapsed = ts - spark.startTime;
        if (elapsed >= duration) return false;
        const progress = elapsed / duration;
        const eased    = easeFunc(progress);
        const dist     = eased * sparkRadius * extraScale;
        const lineLen  = sparkSize * (1 - eased);
        const x1 = spark.x + dist * Math.cos(spark.angle);
        const y1 = spark.y + dist * Math.sin(spark.angle);
        const x2 = spark.x + (dist + lineLen) * Math.cos(spark.angle);
        const y2 = spark.y + (dist + lineLen) * Math.sin(spark.angle);
        ctx.strokeStyle = sparkColor; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        return true;
      });
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [sparkColor, sparkSize, sparkRadius, sparkCount, duration, easeFunc, extraScale]);
  const handleClick = e => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const now = performance.now();
    sparksRef.current.push(...Array.from({ length: sparkCount }, (_, i) => ({
      x, y, angle: (2 * Math.PI * i) / sparkCount, startTime: now,
    })));
  };
  return (
    <div style={{ position:"relative", display:"inline-flex" }} onClick={handleClick}>
      <canvas ref={canvasRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", display:"block", userSelect:"none", pointerEvents:"none", zIndex:10 }} />
      {children}
    </div>
  );
};

// ─── ⑥ DOCK ──────────────────────────────────────────────────────────────────
function DockItem({ children, onClick, mouseX, spring, distance, magnification, baseItemSize, isActiveItem }) {
  const ref = useRef(null);
  const isHovered = useMotionValue(0);
  const mouseDistance = useTransform(mouseX, val => {
    const rect = ref.current?.getBoundingClientRect() ?? { x:0, width:baseItemSize };
    return val - rect.x - baseItemSize / 2;
  });
  const targetSize = useTransform(mouseDistance, [-distance, 0, distance], [baseItemSize, magnification, baseItemSize]);
  const size = useSpring(targetSize, spring);

  return (
    <motion.div
      ref={ref}
      style={{
        width: size,
        height: size,
        position: "relative",
        flexShrink: 0,
        cursor: "pointer",
        overflow: "visible",
      }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={()   => isHovered.set(0)}
      onFocus={()      => isHovered.set(1)}
      onBlur={()       => isHovered.set(0)}
      onClick={onClick}
      tabIndex={0}
      role="button"
    >
      {Children.map(children, child => cloneElement(child, { isHovered, isActiveItem }))}
    </motion.div>
  );
}

function DockLabel({ children, isHovered }) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    if (!isHovered) return;
    const unsub = isHovered.on("change", v => setIsVisible(v === 1));
    return () => unsub();
  }, [isHovered]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity:0, y:4 }}
          animate={{ opacity:1, y:0 }}
          exit={{ opacity:0, y:4 }}
          transition={{ duration:0.15 }}
          style={{
            // FIX: use inset:0 + flex centering instead of left:50%/translateX(-50%)
            // This centers the label relative to the full item width regardless of spring animation
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 400,
          }}
        >
          <div style={{
            background: C.bg4,
            border: `1px solid ${C.lineH}`,
            borderRadius: "6px",
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            color: C.t0,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.7)",
          }}>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DockIcon({ children, isHovered, isActiveItem }) {
  return (
    <div style={{
      width: "100%",
      height: "100%",
      borderRadius: "14px",
      background: isActiveItem ? C.acc : C.bg4,
      border: `1px solid ${isActiveItem ? C.acc : C.line}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background 0.15s, border-color 0.15s",
      boxShadow: isActiveItem ? `0 0 18px ${C.accGlow}` : "none",
      color: isActiveItem ? "#fff" : C.t1,
    }}>
      {children}
      {isActiveItem && (
        <div style={{
          position: "absolute",
          bottom: -8,
          left: "50%",
          transform: "translateX(-50%)",
          width: 4, height: 4,
          borderRadius: "50%",
          background: C.acc,
        }}/>
      )}
    </div>
  );
}

export function Dock({
  items,
  activeId,
  spring = { mass:0.1, stiffness:150, damping:12 },
  magnification = 68,
  distance = 200,
  panelHeight = 64,
  baseItemSize = 48,
}) {
  const mouseX  = useMotionValue(Infinity);
  const isHov   = useMotionValue(0);
  const maxH    = useMemo(() => Math.max(256, magnification + magnification / 2 + 4), [magnification]);
  const hTarget = useTransform(isHov, [0,1], [panelHeight, maxH]);
  const height  = useSpring(hTarget, spring);

  return (
    <motion.div style={{ height, overflow:"visible", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <motion.div
        onMouseMove={({ pageX }) => { isHov.set(1); mouseX.set(pageX); }}
        onMouseLeave={() => { isHov.set(0); mouseX.set(Infinity); }}
        style={{
          height: panelHeight,
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          background: C.bg2 + "e8",
          backdropFilter: "blur(28px)",
          border: `1px solid ${C.lineH}`,
          borderRadius: "18px",
          padding: "8px 16px",
          boxShadow: `0 8px 40px rgba(0,0,0,0.8), 0 0 0 1px ${C.line}`,
          overflow: "visible",
        }}
        role="toolbar"
        aria-label="Navigation"
      >
        {items.map((item, i) => (
          <DockItem
            key={i}
            onClick={item.onClick}
            mouseX={mouseX}
            spring={spring}
            distance={distance}
            magnification={magnification}
            baseItemSize={baseItemSize}
            isActiveItem={activeId === item.id}
          >
            <DockIcon isActiveItem={activeId === item.id}>{item.icon}</DockIcon>
            <DockLabel>{item.label}</DockLabel>
          </DockItem>
        ))}
      </motion.div>
    </motion.div>
  );
}