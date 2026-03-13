import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";

import { AppCtx, ToastProvider } from "./context/index.jsx";
import { useLS } from "./hooks/index.jsx";
import { loadGsap } from "./utils/gsap.jsx";
import { C, R } from "./utils/tokens.jsx";
import { SEED_GRADES, SEED_SUBJECTS, Icons } from "./utils/data.jsx";

import { Dock }      from "./animations/index.jsx";
import { SparkBtn, Modal } from "./components/ui.jsx";
import SearchBar     from "./components/SearchBar.jsx";
import GradeForm     from "./components/GradeForm.jsx";

import Landing   from "./pages/Landing.jsx";
import AuthPage  from "./pages/AuthPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import { GradesPage, StatsPage, SettingsPage } from "./pages/index.jsx";

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800;900&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background: #07070c;
      color: #ededf8;
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
      width: 100%;
      overflow-x: hidden;
    }
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #1c1c2e; border-radius: 9px; }
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    input[type=number] { -moz-appearance: textfield; }
    ::selection { background: #5b6ef030; }
    @keyframes sk {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    .sf-inner   { will-change: transform, opacity; }
    .sr-word    { will-change: opacity, filter; }
    .scroll-stack-card { will-change: transform, filter; backface-visibility: hidden; }
  `}</style>
);

function AppShell() {
  const [grades,   setGrades]   = useLS("np6_grades",   SEED_GRADES);
  const [subjects, setSubjects] = useLS("np6_subjects", SEED_SUBJECTS);
  const [user,     setUser]     = useLS("np6_user",     null);
  const [page,     setPage]     = useState("dashboard");
  const [view,     setView]     = useState("landing");
  const [addOpen,  setAddOpen]  = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (user) setView("app");
    loadGsap();
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const ctx = useMemo(() => ({ grades, setGrades, subjects, setSubjects }), [grades, setGrades, subjects, setSubjects]);

  const handleAuth   = u => { setUser(u); setView("app"); };
  const handleLogout = () => { setUser(null); setView("landing"); };

  const dockItems = [
    { id:"dashboard", label:"Dashboard",       icon:Icons.dash,     onClick:()=>setPage("dashboard") },
    { id:"grades",    label:"Noten",           icon:Icons.notes,    onClick:()=>setPage("grades")    },
    { id:"add",       label:"Note hinzufügen", icon:Icons.add,      onClick:()=>setAddOpen(true)     },
    { id:"stats",     label:"Statistiken",     icon:Icons.stats,    onClick:()=>setPage("stats")     },
    { id:"settings",  label:"Einstellungen",   icon:Icons.settings, onClick:()=>setPage("settings")  },
  ];

  const renderPage = () => {
    switch (page) {
      case "dashboard": return <Dashboard loading={loading} user={user}/>;
      case "grades":    return <GradesPage onAdd={()=>setAddOpen(true)}/>;
      case "stats":     return <StatsPage/>;
      case "settings":  return <SettingsPage user={user} onLogout={handleLogout}/>;
    }
  };

  return (
    <AppCtx.Provider value={ctx}>
      <GlobalStyles />

      {view === "landing" && <Landing onLogin={() => setView("auth")} onRegister={() => setView("auth")}/>}
      {view === "auth"    && <AuthPage onAuth={handleAuth}/>}

      {view === "app" && (
        <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", width:"100%" }}>
          <div style={{
            position:"sticky", top:0, zIndex:100,
            background:"#07070cf0", backdropFilter:"blur(20px)",
            borderBottom:"1px solid #1c1c2e",
            display:"flex", justifyContent:"space-between", alignItems:"center",
            padding:"0 32px", height:52, width:"100%",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:24, height:24, borderRadius:"6px", background:"#5b6ef0", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
              </div>
              <span style={{ fontSize:13, fontWeight:800, letterSpacing:"-0.04em", color:"#ededf8" }}>Notenpilot</span>
            </div>
            <SearchBar/>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <SparkBtn onClick={() => setAddOpen(true)}>+ Note</SparkBtn>
              {user && (
                <motion.button onClick={handleLogout} whileHover={{ scale:1.05 }}
                  style={{ width:30, height:30, borderRadius:"9999px", background:"#5b6ef025", border:"1px solid #5b6ef040", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#7585f4", fontFamily:"inherit" }}
                  title="Abmelden"
                >{(user.name||"?")[0].toUpperCase()}</motion.button>
              )}
            </div>
          </div>

          <div style={{ flex:1, width:"100%", padding:"24px 32px 110px", boxSizing:"border-box" }}>
            <div key={page}>{renderPage()}</div>
          </div>

          <div style={{ position:"fixed", bottom:20, left:0, right:0, display:"flex", justifyContent:"center", zIndex:200, pointerEvents:"none" }}>
            <div style={{ pointerEvents:"all" }}>
              <Dock items={dockItems} activeId={page} panelHeight={62} baseItemSize={46} magnification={68} distance={200}/>
            </div>
          </div>
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Neue Note hinzufügen">
        <GradeForm onClose={() => setAddOpen(false)}/>
      </Modal>
    </AppCtx.Provider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
