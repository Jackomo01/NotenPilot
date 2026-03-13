import { useState, useMemo, memo } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useApp } from "../context/index.jsx";
import { useToast } from "../context/index.jsx";
import { wAvg, fDE, gc, toStr } from "../utils/helpers.jsx";
import { C, R, ARTEN } from "../utils/tokens.jsx";
import { SparkBtn, Card, Lbl, HR, Bdg, SelInp, Modal } from "../components/ui.jsx";
import { ChartTip } from "../components/ui.jsx";
import GradeForm from "../components/GradeForm.jsx";

// ─── Grades Page ──────────────────────────────────────────────────────────────
export const GradesPage = memo(({ onAdd }) => {
  const { grades, setGrades, subjects } = useApp();
  const [fS,setFS]       = useState("");
  const [fT,setFT]       = useState("");
  const [editItem,setEI] = useState(null);
  const toast = useToast();

  const rows = useMemo(() =>
    [...grades].filter(g=>(!fS||g.subject===fS)&&(!fT||g.type===fT))
      .sort((a,b)=>new Date(b.date)-new Date(a.date)),
    [grades,fS,fT]
  );
  const del = id => { setGrades(p=>p.filter(g=>g.id!==id)); toast("Note gelöscht."); };

  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.25}} style={{display:"grid",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:C.t0,letterSpacing:"-0.02em",marginBottom:3}}>Alle Noten</h2>
          <p style={{fontSize:12,color:C.t1}}>{rows.length} Einträge{fS||fT?" (gefiltert)":""}</p>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{width:180}}><SelInp value={fS} onChange={e=>setFS(e.target.value)} options={[{value:"",label:"Alle Fächer"},...subjects.map(s=>({value:s,label:s}))]}/></div>
          <div style={{width:180}}><SelInp value={fT} onChange={e=>setFT(e.target.value)} options={[{value:"",label:"Alle Arten"},...ARTEN.map(t=>({value:t,label:t}))]}/></div>
          <SparkBtn onClick={onAdd}>+ Hinzufügen</SparkBtn>
        </div>
      </div>
      <Card pad="0">
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{borderBottom:`1px solid ${C.line}`}}>
            {["Fach","Note","Art","Gewichtung","Datum",""].map((h,i)=>(
              <th key={i} style={{padding:"12px 20px",textAlign:h==="Note"?"center":"left",fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:C.t2}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.length===0
              ? <tr><td colSpan={6} style={{padding:"40px 20px",textAlign:"center",color:C.t2,fontSize:14}}>Noch keine Noten vorhanden.</td></tr>
              : rows.map(g=>(
                <motion.tr key={g.id} initial={{opacity:0}} animate={{opacity:1}} style={{borderBottom:`1px solid ${C.line}`}} whileHover={{background:C.bg3}} transition={{duration:0.1}}>
                  <td style={{padding:"12px 20px",fontWeight:500,color:C.t0}}>{g.subject}</td>
                  <td style={{padding:"12px 20px",textAlign:"center"}}><span style={{fontSize:22,fontWeight:900,letterSpacing:"-0.04em",color:gc(g.grade)}}>{g.grade.toFixed(1)}</span></td>
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
              ))}
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
  const [period,setPeriod] = useState("all");

  const fil = useMemo(() => {
    const d={"7d":7,"30d":30,"90d":90,"all":Infinity}[period];
    return grades.filter(g=>(Date.now()-new Date(g.date))/86400000<=d);
  }, [grades,period]);
  const sStats = useMemo(() =>
    subjects.map(s=>{const sg=fil.filter(g=>g.subject===s);return{name:s,avg:wAvg(sg),count:sg.length};}).filter(s=>s.avg!=null),
    [fil,subjects]
  );
  const ld = useMemo(() => {
    const s=[...fil].sort((a,b)=>new Date(a.date)-new Date(b.date));
    return s.map((g,i)=>({datum:g.date.slice(5),Note:g.grade,Schnitt:wAvg(s.slice(0,i+1))}));
  }, [fil]);
  const avgV=wAvg(fil), bestV=fil.length?Math.min(...fil.map(g=>g.grade)):null, worstV=fil.length?Math.max(...fil.map(g=>g.grade)):null;

  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.25}} style={{display:"grid",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:C.t0,letterSpacing:"-0.02em",marginBottom:3}}>Statistiken</h2>
          <p style={{fontSize:12,color:C.t1}}>{fil.length} Noten im Zeitraum</p>
        </div>
        <div style={{display:"flex",gap:3,background:C.bg3,border:`1px solid ${C.line}`,borderRadius:R.m,padding:4}}>
          {[["7d","7 T"],["30d","30 T"],["90d","Quartal"],["all","Gesamt"]].map(([v,l])=>(
            <motion.button key={v} onClick={()=>setPeriod(v)} style={{padding:"5px 13px",borderRadius:R.s,border:"none",cursor:"pointer",background:period===v?C.bg5:"transparent",color:period===v?C.t0:C.t1,fontSize:12,fontWeight:period===v?600:400,fontFamily:"inherit",transition:"all 0.1s"}}>{l}</motion.button>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        {[["Durchschnitt",avgV?.toFixed(2)??"–",avgV?gc(avgV):C.t2],["Beste Note",bestV?.toFixed(1)??"–",C.g1],["Schlechteste",worstV?.toFixed(1)??"–",C.g5],["Anzahl",fil.length,C.t0]].map(([l,v,col])=>(
          <Card key={l} pad="20px 22px"><Lbl>{l}</Lbl><div style={{fontSize:34,fontWeight:800,letterSpacing:"-0.04em",color:col,lineHeight:1}}>{v}</div></Card>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Card pad="22px">
          <div style={{fontSize:13,fontWeight:600,color:C.t0,marginBottom:14}}>Notenverlauf</div>
          {ld.length>=2 ? (
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={ld} margin={{top:4,right:4,bottom:0,left:-22}}>
                <CartesianGrid stroke={C.line} strokeDasharray="4 4" vertical={false}/>
                <XAxis dataKey="datum" tick={{fill:C.t2,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis domain={[1,6]} reversed tick={{fill:C.t2,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Line type="monotone" dataKey="Note" stroke={C.lineH} strokeWidth={1} dot={{fill:C.acc,r:3,strokeWidth:0}}/>
                <Line type="monotone" dataKey="Schnitt" stroke={C.acc} strokeWidth={2.5} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          ) : <div style={{height:190,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:C.t2}}>Nicht genug Daten</div>}
        </Card>
        <Card pad="22px">
          <div style={{fontSize:13,fontWeight:600,color:C.t0,marginBottom:14}}>Fachvergleich</div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={sStats} margin={{top:4,right:4,bottom:0,left:-22}}>
              <CartesianGrid stroke={C.line} strokeDasharray="4 4" vertical={false}/>
              <XAxis dataKey="name" tick={{fill:C.t2,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis domain={[1,6]} reversed tick={{fill:C.t2,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="avg" name="Schnitt" radius={[3,3,0,0]} fill={C.acc}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </motion.div>
  );
});

// ─── Settings Page ────────────────────────────────────────────────────────────
export const SettingsPage = memo(({ user, onLogout }) => {
  const { grades, setGrades, subjects, setSubjects } = useApp();
  const [confirm,setConfirm] = useState(false);
  const toast = useToast();
  const exp = () => {
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify({grades,subjects},null,2)],{type:"application/json"}));
    a.download=`notenpilot-${toStr()}.jsxon`;
    a.click();
    toast("Exportiert.");
  };
  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.25}} style={{display:"grid",gap:16,maxWidth:560}}>
      <div>
        <h2 style={{fontSize:20,fontWeight:700,color:C.t0,letterSpacing:"-0.02em",marginBottom:3}}>Einstellungen</h2>
        {user&&<p style={{fontSize:12,color:C.t1}}>Angemeldet als {user.email}</p>}
      </div>
      <Card pad="22px">
        <div style={{fontSize:14,fontWeight:600,color:C.t0,marginBottom:12}}>Fächer verwalten</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {subjects.map(s=>(
            <div key={s} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 13px",background:C.bg3,borderRadius:R.s}}>
              <span style={{fontSize:13,color:C.t0}}>{s}</span>
              <SparkBtn variant="danger" size="sm" onClick={()=>{setSubjects(p=>p.filter(x=>x!==s));toast(`„${s}" gelöscht.`);}}>Löschen</SparkBtn>
            </div>
          ))}
          {subjects.length===0&&<div style={{fontSize:12,color:C.t2}}>Keine Fächer.</div>}
        </div>
      </Card>
      <Card pad="22px">
        <div style={{fontSize:14,fontWeight:600,color:C.t0,marginBottom:8}}>Daten exportieren</div>
        <div style={{fontSize:12,color:C.t1,marginBottom:12}}>Alle Noten als JSON herunterladen.</div>
        <SparkBtn variant="subtle" onClick={exp}>Exportieren</SparkBtn>
      </Card>
      <Card pad="22px">
        <div style={{fontSize:14,fontWeight:600,color:C.t0,marginBottom:8}}>Konto</div>
        <div style={{fontSize:12,color:C.t1,marginBottom:12}}>Angemeldet als <strong style={{color:C.t0}}>{user?.email}</strong>.</div>
        <SparkBtn variant="ghost" onClick={onLogout}>Abmelden</SparkBtn>
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
    </motion.div>
  );
});