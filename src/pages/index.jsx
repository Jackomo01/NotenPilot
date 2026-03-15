import React, { useState, useMemo, memo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useApp } from "../context/index.jsx";
import { useToast } from "../context/index.jsx";
import { wAvg, fDE, gc, toStr } from "../utils/helpers.jsx";
import { C, R, ARTEN } from "../utils/tokens.jsx";
import { SparkBtn, Card, Lbl, HR, Bdg, SelInp, Modal } from "../components/ui.jsx";
import { ChartTip } from "../components/ui.jsx";
import GradeForm from "../components/GradeForm.jsx";








// ─── Shared NoteChart ─────────────────────────────────────────────────────────
const NoteChart = ({ data, avgColor, height = 210 }) => {
  // X uses numeric idx as category key — avoids Recharts duplicate-datum hover bug.
  // Ticks thinned to max 8 labels, but every idx is a valid hover target.
  const tickIdxs = React.useMemo(() => {
    const n = data.length;
    if (!n) return [];
    if (n <= 8) return data.map(d => d.idx);
    const step = Math.max(1, Math.floor(n / 7));
    const t = [];
    for (let i = 0; i < n; i += step) t.push(data[i].idx);
    if (t[t.length - 1] !== data[n - 1].idx) t.push(data[n - 1].idx);
    return t;
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{top:6, right:4, bottom:0, left:-22}}>
        <defs>
          <linearGradient id="ncGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={avgColor} stopOpacity={0.28}/>
            <stop offset="100%" stopColor={avgColor} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid stroke={C.line} strokeDasharray="4 4" vertical={false}/>
        <XAxis
          dataKey="idx"
          type="category"
          allowDuplicatedCategory={false}
          ticks={tickIdxs}
          tickFormatter={(i) => { const d = data.find(p => p.idx === i); return d ? d.datum : ""; }}
          tick={{fill:C.t2, fontSize:10}}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          domain={[1, 6]}
          reversed
          ticks={[1, 2, 3, 4, 5, 6]}
          tick={{fill:C.t2, fontSize:10}}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ stroke:C.lineH, strokeWidth:1 }}
          wrapperStyle={{ outline:"none" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const point = data.find(d => d.idx === label || d.idx === Number(label));
            const fach = payload.find(p => p.name === "Note")?.payload?.Fach;
            return (
              <div style={{ background:C.bg3, border:`1px solid ${C.lineH}`, borderRadius:R.m, padding:"9px 13px", fontSize:12 }}>
                <div style={{ color:C.t2, marginBottom:5 }}>{point?.datum ?? label}</div>
                {payload.map(p => (
                  <div key={p.name} style={{ marginTop:3 }}>
                    <span style={{ color:C.t2, fontWeight:500 }}>{p.name}:</span>{" "}
                    <span style={{ color:C.t0, fontWeight:700 }}>
                      {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
                    </span>
                    {p.name === "Note" && fach && (
                      <span style={{ color:C.t2, fontWeight:400, marginLeft:6 }}>{fach}</span>
                    )}
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="Schnitt"
          stroke={avgColor}
          strokeWidth={2.5}
          fill="url(#ncGrad)"
          dot={false}
          activeDot={{ r:5, fill:avgColor, stroke:"#fff", strokeWidth:2.5 }}
          name="Durchschnitt"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="Note"
          stroke={C.lineH}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r:5, fill:C.lineH, stroke:"#fff", strokeWidth:2.5 }}
          name="Note"
          isAnimationActive={false}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize:11, paddingBottom:8 }}
          formatter={(value) => <span style={{ color:C.t1, fontWeight:500 }}>{value}</span>}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};






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
    return s.map((g,i) => {
      const parts = g.date.split("-");
      const datum = parts.length === 3 ? `${parts[2]}.${parts[1]}.` : g.date.slice(5);
      return { datum, idx:i, Note:g.grade, Schnitt:wAvg(s.slice(0,i+1)), Fach:g.subject };
    });
  }, [fil]);

  // Notes by type breakdown
  const byType = useMemo(() => {
    const map = {};
    fil.forEach(g => { map[g.type] = (map[g.type]||0)+1; });
    return Object.entries(map).map(([name,count]) => ({ name, count })).sort((a,b) => b.count-a.count);
  }, [fil]);

  const avgV    = wAvg(fil);
  const avgColor = avgV ? gc(avgV) : C.t2;

  // Notentendenz via lineare Regression (slope < 0 = besser, > 0 = schlechter)
  const trend = useMemo(() => {
    if (fil.length < 3) return null;
    const sorted = [...fil].sort((a,b) => new Date(a.date)-new Date(b.date));
    const n = sorted.length;
    const xs = sorted.map((_,i) => i);
    const ys = sorted.map(g => g.grade);
    const xMean = xs.reduce((s,x) => s+x, 0) / n;
    const yMean = ys.reduce((s,y) => s+y, 0) / n;
    const num = xs.reduce((s,x,i) => s + (x-xMean)*(ys[i]-yMean), 0);
    const den = xs.reduce((s,x) => s + (x-xMean)**2, 0);
    const slope = den === 0 ? 0 : num / den;
    if (slope < -0.08) return { label:"Verbessert", icon:"↑", color:C.g1 };
    if (slope >  0.08) return { label:"Verschlechtert", icon:"↓", color:C.g5 };
    return { label:"Stabil", icon:"→", color:C.g3 };
  }, [fil]);

  // Häufigste Note (gerundet auf 0.5)
  const mostFrequent = useMemo(() => {
    if (!fil.length) return null;
    const map = {};
    fil.forEach(g => {
      const r = Math.round(g.grade * 2) / 2;
      map[r] = (map[r] || 0) + 1;
    });
    const best = Object.entries(map).sort((a,b) => b[1]-a[1])[0];
    return best ? parseFloat(best[0]) : null;
  }, [fil]);

  // Letzte Verbesserung: letztes Paar aufeinanderfolgender Noten im selben Fach wo die Note gesunken ist
  const lastImprovement = useMemo(() => {
    if (fil.length < 2) return null;
    // Stable sort: by date, then by id as tiebreaker for same-day entries
    const sorted = [...fil].sort((a, b) => {
      const diff = new Date(a.date) - new Date(b.date);
      if (diff !== 0) return diff;
      return a.id < b.id ? -1 : 1; // stable tiebreaker
    });
    // go backwards to find the most recent improvement
    for (let i = sorted.length - 1; i >= 1; i--) {
      const curr = sorted[i];
      // find the most recent previous note in the same subject
      const prev = [...sorted].slice(0, i).reverse().find(g => g.subject === curr.subject);
      if (prev && curr.grade < prev.grade) {
        return { subject: curr.subject, from: prev.grade, to: curr.grade };
      }
    }
    return null;
  }, [fil]);

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

      {/* 4 KPI cards — alle mit passendem Gradient */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <Card pad="20px 22px" style={{position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at top right,${avgColor}18 0%,transparent 70%)`,pointerEvents:"none"}}/>
          <Lbl>Durchschnitt</Lbl>
          <div style={{fontSize:34,fontWeight:900,letterSpacing:"-0.05em",color:avgColor,lineHeight:1}}>{avgV?.toFixed(2)??"–"}</div>

        </Card>
        <Card pad="20px 22px">
          <Lbl>Anzahl Noten</Lbl>
          <div style={{fontSize:34,fontWeight:800,letterSpacing:"-0.04em",color:C.t0,lineHeight:1}}>{fil.length}</div>
        </Card>
        <Card pad="20px 22px">
          <Lbl>Häufigste Note</Lbl>
          {mostFrequent != null ? (
            <div style={{fontSize:34,fontWeight:900,color:gc(mostFrequent),letterSpacing:"-0.04em",lineHeight:1}}>
              {mostFrequent.toFixed(1).replace(".",",")}
            </div>
          ) : <div style={{fontSize:13,color:C.t2,marginTop:6}}>–</div>}
        </Card>
        <Card pad="20px 22px">
          <Lbl>Letzte Verbesserung</Lbl>
          {lastImprovement ? (
            <>
              <div style={{fontSize:13,fontWeight:700,color:C.t0,marginTop:4,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {lastImprovement.subject}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:18,fontWeight:800,color:gc(lastImprovement.from)}}>{lastImprovement.from.toFixed(1).replace(".",",")}</span>
                <span style={{fontSize:13,color:C.t2}}>→</span>
                <span style={{fontSize:18,fontWeight:800,color:gc(lastImprovement.to)}}>{lastImprovement.to.toFixed(1).replace(".",",")}</span>
              </div>
            </>
          ) : <div style={{fontSize:13,color:C.t2,marginTop:6}}>Keine</div>}
        </Card>
      </div>      {/* Trend chart + Leistungsarten */}
      <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:12}}>
        <Card pad="22px">
          <div style={{fontSize:13,fontWeight:600,color:C.t0,marginBottom:14}}>Notenverlauf</div>
          {ld.length>=2 ? (
            <NoteChart data={ld} avgColor={avgColor} height={210}/>
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