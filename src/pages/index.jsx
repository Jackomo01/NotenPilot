import { useState, useMemo, memo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useApp } from "../context/index.jsx";
import { useToast } from "../context/index.jsx";
import { wAvg, fDE, gc, toStr } from "../utils/helpers.jsx";
import { C, R, ARTEN } from "../utils/tokens.jsx";
import { SparkBtn, Card, Lbl, HR, Bdg, SelInp, Modal } from "../components/ui.jsx";
import { ChartTip } from "../components/ui.jsx";
import GradeForm from "../components/GradeForm.jsx";

// ─── Grades Page ──────────────────────────────────────────────────────────────
export const GradesPage = memo(({ onAdd, highlightId }) => {
  const { grades, setGrades, subjects } = useApp();
  const [fS, setFS]       = useState("");
  const [fT, setFT]       = useState("");
  const [editItem, setEI] = useState(null);
  const toast = useToast();

  const rows = useMemo(() =>
    [...grades].filter(g => (!fS || g.subject === fS) && (!fT || g.type === fT))
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [grades, fS, fT]
  );

  const del = id => { setGrades(p => p.filter(g => g.id !== id)); toast("Note gelöscht."); };

  // Scroll to highlighted row and clear subject/type filters if needed
  useEffect(() => {
    if (!highlightId) return;
    const target = grades.find(g => g.id === highlightId);
    if (target) {
      if (fS && target.subject !== fS) setFS("");
      if (fT && target.type !== fT) setFT("");
    }
    // Give React time to re-render after filter clear
    const t = setTimeout(() => {
      const el = document.getElementById(`grade-row-${highlightId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(t);
  }, [highlightId]);

  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.25}} style={{display:"grid",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:C.t0,letterSpacing:"-0.02em",marginBottom:3}}>Alle Noten</h2>
          <p style={{fontSize:12,color:C.t1}}>{rows.length} Einträge{fS||fT?" (gefiltert)":""}</p>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{width:180}}>
            <SelInp value={fS} onChange={e=>setFS(e.target.value)} options={[{value:"",label:"Alle Fächer"},...subjects.map(s=>({value:s,label:s}))]}/>
          </div>
          <div style={{width:180}}>
            <SelInp value={fT} onChange={e=>setFT(e.target.value)} options={[{value:"",label:"Alle Arten"},...ARTEN.map(t=>({value:t,label:t}))]}/>
          </div>
        </div>
      </div>

      <Card pad="0">
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead>
            <tr style={{borderBottom:`1px solid ${C.line}`}}>
              {["Fach","Note","Art","Gewichtung","Datum",""].map((h,i)=>(
                <th key={i} style={{padding:"12px 20px",textAlign:h==="Note"?"center":"left",fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:C.t2}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={6} style={{padding:"40px 20px",textAlign:"center",color:C.t2,fontSize:14}}>Noch keine Noten vorhanden.</td></tr>
              : rows.map(g => {
                  const isHL = g.id === highlightId;
                  return (
                    <motion.tr
                      key={g.id}
                      id={`grade-row-${g.id}`}
                      initial={{opacity:0}}
                      animate={{opacity:1}}
                      className={isHL ? "grade-row-highlighted" : ""}
                      style={{
                        borderBottom:`1px solid ${C.line}`,
                        borderLeft: isHL ? `3px solid ${C.acc}` : "3px solid transparent",
                        transition:"border-color 0.2s",
                      }}
                      whileHover={{background:C.bg3}}
                      transition={{duration:0.1}}
                    >
                      <td style={{padding:"12px 20px",fontWeight:500,color:C.t0}}>{g.subject}</td>
                      <td style={{padding:"12px 20px",textAlign:"center"}}>
                        <span style={{fontSize:22,fontWeight:900,letterSpacing:"-0.04em",color:gc(g.grade)}}>{g.grade.toFixed(1)}</span>
                      </td>
                      <td style={{padding:"12px 20px"}}><Bdg>{g.type}</Bdg></td>
                      <td style={{padding:"12px 20px",color:C.t1}}>×{g.weight}</td>
                      <td style={{padding:"12px 20px",color:C.t1}}>{fDE(g.date)}</td>
                      <td style={{padding:"12px 20px"}}>
                        <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                          <SparkBtn variant="ghost" size="sm" onClick={()=>setEI(g)}>Bearbeiten</SparkBtn>
                          <SparkBtn variant="danger" size="sm" onClick={()=>del(g.id)}>Löschen</SparkBtn>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
            }
          </tbody>
        </table>
      </Card>

      <Modal open={!!editItem} onClose={()=>setEI(null)} title="Note bearbeiten">
        {editItem && <GradeForm onClose={()=>setEI(null)} editItem={editItem}/>}
      </Modal>
    </motion.div>
  );
});

// ─── Stats Page ───────────────────────────────────────────────────────────────
export const StatsPage = memo(() => {
  const { grades, subjects } = useApp();
  const [period, setPeriod] = useState("all");

  const fil = useMemo(() => {
    const d = {"7d":7,"30d":30,"all":Infinity}[period];
    return grades.filter(g => (Date.now()-new Date(g.date))/86400000 <= d);
  }, [grades, period]);

  const sStats = useMemo(() =>
    subjects.map(s => {
      const sg = fil.filter(g => g.subject === s);
      return { name:s, avg:wAvg(sg), count:sg.length };
    }).filter(s => s.avg != null).sort((a,b) => a.avg - b.avg),
    [fil, subjects]
  );

  const ld = useMemo(() => {
    const s = [...fil].sort((a,b) => new Date(a.date)-new Date(b.date));
    return s.map((g,i) => ({ datum:g.date.slice(5), Note:g.grade, Schnitt:wAvg(s.slice(0,i+1)) }));
  }, [fil]);

  // Notes by type breakdown
  const byType = useMemo(() => {
    const map = {};
    fil.forEach(g => { map[g.type] = (map[g.type]||0)+1; });
    return Object.entries(map).map(([name,count]) => ({ name, count })).sort((a,b) => b.count-a.count);
  }, [fil]);

  const avgV   = wAvg(fil);
  const bestV  = fil.length ? Math.min(...fil.map(g=>g.grade)) : null;
  const worstV = fil.length ? Math.max(...fil.map(g=>g.grade)) : null;
  const avgColor = avgV ? gc(avgV) : C.t2;

  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.25}} style={{display:"grid",gap:16}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:C.t0,letterSpacing:"-0.02em",marginBottom:3}}>Statistiken</h2>
        </div>
        <div style={{display:"flex",gap:3,background:C.bg3,border:`1px solid ${C.line}`,borderRadius:R.m,padding:4}}>
          {[["7d","7 Tage"],["30d","30 Tage"],["all","Gesamt"]].map(([v,l])=>(
            <motion.button key={v} onClick={()=>setPeriod(v)}
              style={{padding:"5px 14px",borderRadius:R.s,border:"none",cursor:"pointer",background:period===v?C.bg5:"transparent",color:period===v?C.t0:C.t1,fontSize:12,fontWeight:period===v?600:400,fontFamily:"inherit",transition:"all 0.1s"}}
            >{l}</motion.button>
          ))}
        </div>
      </div>

      {/* 4 KPI cards — Durchschnitt with grade-color gradient, no Gesamtgewicht */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <Card pad="20px 22px" style={{position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at top right,${avgColor}18 0%,transparent 70%)`,pointerEvents:"none"}}/>
          <Lbl>Durchschnitt</Lbl>
          <div style={{fontSize:34,fontWeight:900,letterSpacing:"-0.05em",color:avgColor,lineHeight:1}}>{avgV?.toFixed(2)??"–"}</div>
          {avgV && <div style={{fontSize:11,color:C.t1,marginTop:4}}>{avgV<=1.5?"Sehr gut":avgV<=2.5?"Gut":avgV<=3.5?"Befriedigend":avgV<=4.5?"Ausreichend":"Mangelhaft"}</div>}
        </Card>
        <Card pad="20px 22px">
          <Lbl>Beste Note</Lbl>
          <div style={{fontSize:34,fontWeight:800,letterSpacing:"-0.04em",color:C.g1,lineHeight:1}}>{bestV?.toFixed(1)??"–"}</div>
        </Card>
        <Card pad="20px 22px">
          <Lbl>Schlechteste</Lbl>
          <div style={{fontSize:34,fontWeight:800,letterSpacing:"-0.04em",color:worstV?gc(worstV):C.t2,lineHeight:1}}>{worstV?.toFixed(1)??"–"}</div>
        </Card>
        <Card pad="20px 22px">
          <Lbl>Anzahl Noten</Lbl>
          <div style={{fontSize:34,fontWeight:800,letterSpacing:"-0.04em",color:C.t0,lineHeight:1}}>{fil.length}</div>
        </Card>
      </div>

      {/* Trend chart + Leistungsarten */}
      <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:12}}>
        <Card pad="22px">
          <div style={{fontSize:13,fontWeight:600,color:C.t0,marginBottom:14}}>Notenverlauf</div>
          {ld.length>=2 ? (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={ld} margin={{top:4,right:4,bottom:0,left:-22}}>
                <defs>
                  <linearGradient id="sgAvg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={avgColor} stopOpacity={0.3}/>
                    <stop offset="100%" stopColor={avgColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.line} strokeDasharray="4 4" vertical={false}/>
                <XAxis dataKey="datum" tick={{fill:C.t2,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis domain={[1,6]} reversed tick={{fill:C.t2,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Area type="monotone" dataKey="Schnitt" stroke={avgColor} strokeWidth={2.5} fill="url(#sgAvg)" dot={false} name="Durchschnitt"/>
                <Line type="monotone" dataKey="Note" stroke={C.lineH} strokeWidth={1} dot={{fill:avgColor,r:3.5,strokeWidth:0}} name="Note"/>
              </AreaChart>
            </ResponsiveContainer>
          ) : <div style={{height:210,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:C.t2}}>Nicht genug Daten</div>}
        </Card>

        <Card pad="22px">
          <div style={{fontSize:13,fontWeight:600,color:C.t0,marginBottom:14}}>Leistungsarten</div>
          {byType.length > 0 ? (
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {byType.map((t,i) => (
                <div key={t.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 11px",background:C.bg3,borderRadius:R.s}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:[C.acc,C.g1,C.g3,C.g4,C.g5,C.accH][i%6]}}/>
                    <span style={{fontSize:12,color:C.t1}}>{t.name}</span>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:C.t0}}>{t.count}</span>
                </div>
              ))}
            </div>
          ) : <div style={{fontSize:13,color:C.t2}}>Keine Daten</div>}
        </Card>
      </div>

      {/* Fachdetails — grade-color gradient per card */}
      {sStats.length > 0 && (
        <Card pad="22px">
          <div style={{fontSize:13,fontWeight:600,color:C.t0,marginBottom:14}}>Fachdetails</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
            {sStats.map(s => {
              const col = gc(s.avg);
              return (
                <div key={s.name} style={{background:C.bg3,borderRadius:R.l,padding:"16px 18px",border:`1px solid ${C.line}`,position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at top right,${col}16 0%,transparent 70%)`,pointerEvents:"none"}}/>
                  <div style={{fontSize:11,color:C.t1,fontWeight:600,marginBottom:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                  <div style={{fontSize:28,fontWeight:900,color:col,letterSpacing:"-0.05em",lineHeight:1}}>{s.avg.toFixed(2)}</div>
                  <div style={{fontSize:10,color:C.t2,marginTop:5}}>{s.count} Note{s.count!==1?"n":""}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </motion.div>
  );
});

// ─── Settings Page — full width ───────────────────────────────────────────────
export const SettingsPage = memo(({ user, onLogout }) => {
  const { grades, setGrades, subjects, setSubjects } = useApp();
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();

  const exp = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({grades,subjects},null,2)],{type:"application/json"}));
    a.download = `notenpilot-${toStr()}.json`;
    a.click();
    toast("Exportiert.");
  };

  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.25}} style={{display:"grid",gap:16}}>
      <div>
        <h2 style={{fontSize:20,fontWeight:700,color:C.t0,letterSpacing:"-0.02em",marginBottom:3}}>Einstellungen</h2>
        {user && <p style={{fontSize:12,color:C.t1}}>Angemeldet als {user.email}</p>}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}}>
        <Card pad="22px" style={{alignSelf:"start"}}>
          <div style={{fontSize:14,fontWeight:600,color:C.t0,marginBottom:12}}>Fächer verwalten</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {subjects.map(s=>(
              <div key={s} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 13px",background:C.bg3,borderRadius:R.s}}>
                <span style={{fontSize:13,color:C.t0}}>{s}</span>
                <SparkBtn variant="danger" size="sm" onClick={()=>{setSubjects(p=>p.filter(x=>x!==s));toast(`„${s}" gelöscht.`);}}>Löschen</SparkBtn>
              </div>
            ))}
            {subjects.length===0 && <div style={{fontSize:12,color:C.t2}}>Keine Fächer.</div>}
          </div>
        </Card>

        <div style={{display:"grid",gap:16,alignContent:"start"}}>
          <Card pad="22px">
            <div style={{fontSize:14,fontWeight:600,color:C.t0,marginBottom:8}}>Konto</div>
            <div style={{fontSize:12,color:C.t1,marginBottom:12}}>Angemeldet als <strong style={{color:C.t0}}>{user?.email}</strong>.</div>
            <SparkBtn variant="ghost" onClick={onLogout}>Abmelden</SparkBtn>
          </Card>

          <Card pad="22px">
            <div style={{fontSize:14,fontWeight:600,color:C.t0,marginBottom:8}}>Daten exportieren</div>
            <div style={{fontSize:12,color:C.t1,marginBottom:12}}>Alle Noten als JSON herunterladen.</div>
            <SparkBtn variant="subtle" onClick={exp}>Exportieren</SparkBtn>
          </Card>

          <Card pad="22px" style={{borderColor:C.err+"30"}}>
            <div style={{fontSize:14,fontWeight:600,color:C.err,marginBottom:8}}>Gefahrenzone</div>
            <div style={{fontSize:12,color:C.t1,marginBottom:12}}>Alle Noten unwiderruflich löschen.</div>
            {!confirm
              ? <SparkBtn variant="danger" onClick={()=>setConfirm(true)}>Alle Daten löschen</SparkBtn>
              : <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:12,color:C.t1}}>Wirklich?</span>
                  <SparkBtn variant="danger" onClick={()=>{setGrades([]);setSubjects([]);setConfirm(false);toast("Alle Daten gelöscht.");}}>Ja, löschen</SparkBtn>
                  <SparkBtn variant="ghost" onClick={()=>setConfirm(false)}>Abbrechen</SparkBtn>
                </div>
            }
          </Card>
        </div>
      </div>
    </motion.div>
  );
});