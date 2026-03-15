import { useState, useRef, memo, useCallback } from "react";
import { motion } from "framer-motion";
import { C, R } from "../utils/tokens.jsx";
import { SparkBtn, Card, Lbl, HR, TxtInp, baseInpStyle } from "../components/ui.jsx";
import { VariableProximity, ClickSpark } from "../animations/index.jsx";
import { useToast } from "../context/index.jsx";

const AuthPage = memo(({ onAuth }) => {
  const [mode, setMode]       = useState("login");
  const [email, setEmail]     = useState("");
  const [passVal, setPassVal] = useState("");
  const [name, setName]       = useState("");
  const [err, setErr]         = useState("");
  const [loading, setLoad]    = useState(false);
  const toast = useToast();
  const pageRef = useRef(null);

  const validate = () => {
    if (!email.includes("@"))                { setErr("Bitte gib eine gültige E-Mail ein."); return false; }
    if (passVal.length < 6)                  { setErr("Passwort mind. 6 Zeichen."); return false; }
    if (mode === "register" && !name.trim()) { setErr("Bitte gib deinen Namen ein."); return false; }
    return true;
  };

  const submit = useCallback(async () => {
    if (loading) return;
    if (!validate()) return;
    setLoad(true); setErr("");
    await new Promise(r => setTimeout(r, 800));
    const displayName = name || email.split("@")[0];
    toast(mode === "login" ? "Willkommen zurück!" : "Konto erstellt!");
    onAuth({ email, name: displayName, isNew: mode === "register" });
    setLoad(false);
  }, [loading, email, passVal, name, mode]);

  // Google auth — only fires when explicitly called
  const googleAuth = useCallback(async (e) => {
    // Prevent any event bubbling triggering this unintentionally
    e.stopPropagation();
    if (loading) return;
    setLoad(true); setErr("");
    await new Promise(r => setTimeout(r, 1000));
    toast("Mit Google angemeldet!");
    onAuth({ email: "nutzer@gmail.com", name: "Schüler", google: true, isNew: false });
    setLoad(false);
  }, [loading]);

  return (
    <div
      ref={pageRef}
      style={{
        minHeight:"100vh", background:C.bg0,
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:16, position:"relative", overflow:"hidden",
      }}
    >
      {/* Grid bg */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none",
        backgroundImage:`linear-gradient(${C.line} 1px,transparent 1px),linear-gradient(90deg,${C.line} 1px,transparent 1px)`,
        backgroundSize:"44px 44px", opacity:0.3,
        maskImage:"radial-gradient(ellipse 60% 60% at 50% 50%,#000 30%,transparent 100%)",
      }}/>
      {/* Glow */}
      <div style={{
        position:"fixed", top:"20%", left:"50%", transform:"translate(-50%,-50%)",
        width:400, height:400, background:C.accGlow,
        borderRadius:"50%", filter:"blur(80px)", pointerEvents:"none",
      }}/>

      <div style={{ position:"relative", zIndex:1, width:"100%", maxWidth:400 }}>
        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <div style={{ width:32, height:32, borderRadius:R.m, background:C.acc, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <span style={{ fontSize:22, fontWeight:900, letterSpacing:"-0.05em", color:C.t0 }}>
              <VariableProximity label="Notenpilot" containerRef={pageRef} radius={60}/>
            </span>
          </div>
          <h1 style={{ fontSize:22, fontWeight:700, color:C.t0, letterSpacing:"-0.02em", marginBottom:6 }}>
            {mode === "login" ? "Willkommen zurück" : "Konto erstellen"}
          </h1>
          <p style={{ fontSize:13, color:C.t1 }}>
            {mode === "login" ? "Melde dich an, um fortzufahren." : "Starte kostenlos durch."}
          </p>
        </div>

        <Card pad="28px 32px">
          {/* Google button — uses explicit onClick, stopPropagation to avoid accidental triggers */}
          <ClickSpark sparkColor="#4285F4" sparkCount={8} sparkRadius={22} sparkSize={9} duration={420}>
            <motion.button
              type="button"
              onClick={googleAuth}
              disabled={loading}
              whileTap={{ scale: loading ? 1 : 0.97 }}
              style={{
                width:"100%", display:"flex", alignItems:"center", justifyContent:"center",
                gap:10, padding:"10px 18px",
                background:"#fff", color:"#111",
                border:"1px solid #e0e0e0", borderRadius:R.s,
                fontSize:13, fontWeight:600,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily:"inherit", opacity: loading ? 0.6 : 1,
                transition:"background 0.12s",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#f5f5f5"; }}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
            >
              {loading ? (
                <span style={{ width:16, height:16, border:"2px solid #ccc", borderTopColor:"#555", borderRadius:"50%", animation:"spin 0.8s linear infinite", display:"inline-block" }}/>
              ) : (
                <svg width={16} height={16} viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Mit Google {mode === "login" ? "anmelden" : "registrieren"}
            </motion.button>
          </ClickSpark>

          <div style={{ display:"flex", alignItems:"center", gap:12, margin:"18px 0" }}>
            <HR/>
            <span style={{ fontSize:11, color:C.t2, flexShrink:0, letterSpacing:"0.06em" }}>ODER</span>
            <HR/>
          </div>

          {mode === "register" && (
            <div style={{ marginBottom:14 }}>
              <Lbl>Name</Lbl>
              <TxtInp value={name} onChange={e => setName(e.target.value)} placeholder="Dein Name"/>
            </div>
          )}

          <div style={{ marginBottom:14 }}>
            <Lbl>E-Mail</Lbl>
            <TxtInp
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@schule.de"
              autoFocus={mode === "login"}
            />
          </div>

          <div style={{ marginBottom:6 }}>
            <Lbl>Passwort</Lbl>
            <input
              type="password"
              value={passVal}
              onChange={e => setPassVal(e.target.value)}
              placeholder={mode === "register" ? "Mind. 6 Zeichen" : "Passwort"}
              onKeyDown={e => e.key === "Enter" && submit()}
              style={{ ...baseInpStyle(false) }}
            />
          </div>

          {err && <div style={{ fontSize:12, color:C.err, margin:"8px 0 2px" }}>{err}</div>}

          <div style={{ marginTop:18 }}>
            <SparkBtn full disabled={loading} onClick={submit}>
              {loading ? (
                <span style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ width:12, height:12, border:"2px solid #ffffff60", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.8s linear infinite", display:"inline-block" }}/>
                  Bitte warten…
                </span>
              ) : mode === "login" ? "Anmelden" : "Konto erstellen"}
            </SparkBtn>
          </div>

          <div style={{ textAlign:"center", marginTop:16, fontSize:13, color:C.t1 }}>
            {mode === "login" ? "Noch kein Konto? " : "Bereits registriert? "}
            <motion.button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}
              whileHover={{ color: C.accH }}
              style={{ background:"none", border:"none", cursor:"pointer", color:C.acc, fontSize:13, fontFamily:"inherit", fontWeight:600 }}
            >
              {mode === "login" ? "Registrieren" : "Anmelden"}
            </motion.button>
          </div>
        </Card>
      </div>
    </div>
  );
});

export default AuthPage;