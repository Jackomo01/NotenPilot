import { createContext, useContext, useState, useCallback } from "react";
import { uid } from "../utils/helpers.js";

// App context
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

// Toast context
export const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export const ToastProvider = ({ children }) => {
  const [ts, setTs] = useState([]);
  const push = useCallback((msg, type = "ok") => {
    const id = uid();
    setTs(p => [...p, { id, msg, type }]);
    setTimeout(() => setTs(p => p.filter(t => t.id !== id)), 3400);
  }, []);

  const { C, R } = (() => {
    const C = {
      bg3:"#0f0f18", lineH:"#262640", acc:"#5b6ef0", ok:"#26d49a", err:"#d84040", t0:"#ededf8",
    };
    const R = { m:"10px" };
    return { C, R };
  })();

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{ position:"fixed", top:80, right:16, zIndex:1000, display:"flex", flexDirection:"column", gap:8 }}>
        {ts.map(t => (
          <div key={t.id} onClick={() => setTs(p => p.filter(x => x.id !== t.id))}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 16px", background:C.bg3, border:`1px solid ${t.type === "err" ? "#d8404040" : "#5b6ef040"}`, borderRadius:R.m, cursor:"pointer", boxShadow:"0 8px 32px rgba(0,0,0,0.6)", fontSize:13, color:C.t0, maxWidth:320 }}
          >
            <div style={{ width:6, height:6, borderRadius:"50%", background:t.type === "err" ? C.err : C.ok, flexShrink:0 }} />
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};