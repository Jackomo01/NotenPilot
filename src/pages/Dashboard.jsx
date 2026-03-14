import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useApp } from "../context/index.jsx";
import { useCountUp } from "../hooks/index.jsx";
import { wAvg, fDE, gc, gl } from "../utils/helpers.jsx";
import { C, R } from "../utils/tokens.jsx";
import { Sk, Card, Lbl, ChartTip } from "../components/ui.jsx";

const AnimNum = ({ to, dec=0 }) => { const v = useCountUp(to??0); return <span>{v.toFixed(dec)}</span>; };

const Dashboard = memo(({ loading, user }) => {
  const { grades, subjects } = useApp();
  const avg = wAvg(grades);
  const animAvg = useCountUp(avg);

  const sStats = useMemo(() =>
    subjects.map(s => {
      const sg = grades.filter(g => g.subject === s);
      return { name:s, avg:wAvg(sg), count:sg.length };
    }).filter(s => s.avg != null).sort((a,b) => a.avg - b.avg),
    [grades, subjects]
  );

  const trend = useMemo(() => {
    const s = [...grades].sort((a,b) => new Date(a.date)-new Date(b.date));
    return s.map((g,i) => ({ datum:g.date.slice(5), Note:g.grade, Schnitt:wAvg(s.slice(0,i+1)) }));
  }, [grades]);

  const recent = useMemo(() => [...grades].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,7), [grades]);

  const best  = sStats[0];
  const worst = sStats.length > 1 ? sStats[sStats.length-1] : null;
  const avgColor = avg ? gc(avg) : C.t2;

  if (loading) return (
    <div style={{ display:"grid", gap:16 }}>
      {[1,2,3].map(i => <Sk key={i} h={120} r={R.xl}/>)}
    </div>
  );

  return (
    <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3 }} style={{ display:"grid", gap:16 }}>
      <div>
        <h2 style={{ fontSize:22, fontWeight:800, color:C.t0, letterSpacing:"-0.03em", marginBottom:3 }}>
          Guten Tag{user?.name ? `, ${user.name}` : ""}.
        </h2>
        <p style={{ fontSize:13, color:C.t1 }}>Dein aktueller Leistungsüberblick.</p>
      </div>

      {/* 4 stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {/* Gesamtschnitt */}
        <Card pad="22px 24px" style={{ position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse at top right,${avgColor}18 0%,transparent 70%)`, pointerEvents:"none" }}/>
          <Lbl>Gesamtdurchschnitt</Lbl>
          <div style={{ fontSize:50, fontWeight:900, letterSpacing:"-0.06em", color:avg?avgColor:C.t2, lineHeight:1, marginBottom:4 }}>
            {avg ? animAvg.toFixed(2) : "–"}
          </div>
          <div style={{ fontSize:12, color:C.t1 }}>{avg ? gl(avg) : "Keine Noten"}</div>
        </Card>

        {/* Anzahl */}
        <Card pad="22px 24px">
          <Lbl>Noten gesamt</Lbl>
          <div style={{ fontSize:42, fontWeight:800, letterSpacing:"-0.05em", color:C.t0, lineHeight:1, marginBottom:4 }}>
            <AnimNum to={grades.length}/>
          </div>
          <div style={{ fontSize:12, color:C.t1 }}>{subjects.length} Fächer</div>
        </Card>

        {/* Bestes Fach */}
        <Card pad="22px 24px">
          <Lbl>Bestes Fach</Lbl>
          {best ? (
            <>
              <div style={{ fontSize:15, fontWeight:600, color:C.t0, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{best.name}</div>
              <div style={{ fontSize:38, fontWeight:800, letterSpacing:"-0.05em", color:gc(best.avg), lineHeight:1 }}>{best.avg.toFixed(2)}</div>
            </>
          ) : <div style={{ fontSize:13, color:C.t2, marginTop:8 }}>–</div>}
        </Card>

        {/* Schwächstes Fach */}
        <Card pad="22px 24px">
          <Lbl>Schwächstes Fach</Lbl>
          {worst ? (
            <>
              <div style={{ fontSize:15, fontWeight:600, color:C.t0, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{worst.name}</div>
              <div style={{ fontSize:38, fontWeight:800, letterSpacing:"-0.05em", color:gc(worst.avg), lineHeight:1 }}>{worst.avg.toFixed(2)}</div>
            </>
          ) : <div style={{ fontSize:13, color:C.t2, marginTop:8 }}>–</div>}
        </Card>
      </div>

      {/* Charts row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:12 }}>
        <Card pad="22px">
          <div style={{ fontSize:13, fontWeight:600, color:C.t0, marginBottom:16 }}>Notenentwicklung</div>
          {trend.length >= 2 ? (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={trend} margin={{top:4,right:4,bottom:0,left:-22}}>
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={avgColor} stopOpacity={0.3}/>
                    <stop offset="100%" stopColor={avgColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.line} strokeDasharray="4 4" vertical={false}/>
                <XAxis dataKey="datum" tick={{fill:C.t2,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis domain={[1,6]} reversed tick={{fill:C.t2,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip
                  content={<ChartTip/>}
                  cursor={{ stroke:C.lineH, strokeWidth:1 }}
                  wrapperStyle={{ outline:"none" }}
                />
                <Area type="monotone" dataKey="Schnitt" stroke={avgColor} strokeWidth={2.5} fill="url(#ag)" dot={false} name="Durchschnitt"/>
                <Line type="monotone" dataKey="Note" stroke={C.lineH} strokeWidth={1} dot={{fill:avgColor,r:3.5,strokeWidth:0}} name="Note"/>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:210, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:C.t2 }}>
              Mind. 2 Noten für den Verlauf
            </div>
          )}
        </Card>

        <Card pad="22px">
          <div style={{ fontSize:13, fontWeight:600, color:C.t0, marginBottom:14 }}>Zuletzt eingetragen</div>
          {recent.length === 0
            ? <div style={{ fontSize:13, color:C.t2 }}>Noch keine Noten.</div>
            : recent.map((g,i) => (
              <div key={g.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:i<recent.length-1?`1px solid ${C.line}`:"none" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:C.t0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.subject}</div>
                  <div style={{ fontSize:10, color:C.t2, marginTop:1 }}>{g.type} · {fDE(g.date)}</div>
                </div>
                <div style={{ fontSize:20, fontWeight:800, color:gc(g.grade), letterSpacing:"-0.03em", flexShrink:0, marginLeft:8 }}>{g.grade.toFixed(1)}</div>
              </div>
            ))
          }
        </Card>
      </div>

      {/* Schnitt nach Fach */}
      {sStats.length > 0 && (
        <Card pad="22px">
          <div style={{ fontSize:13, fontWeight:600, color:C.t0, marginBottom:16 }}>Schnitt nach Fach</div>
          <ResponsiveContainer width="100%" height={Math.max(80, sStats.length * 36)}>
            <BarChart data={sStats} layout="vertical" margin={{top:0,right:8,bottom:0,left:0}}>
              <CartesianGrid stroke={C.line} strokeDasharray="4 4" horizontal={false}/>
              <XAxis type="number" domain={[1,6]} reversed tick={{fill:C.t2,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="name" tick={{fill:C.t1,fontSize:11}} axisLine={false} tickLine={false} width={90}/>
              <Tooltip
                content={<ChartTip/>}
                cursor={{ fill: C.bg3 }}
                wrapperStyle={{ outline:"none" }}
              />
              <Bar dataKey="avg" name="Schnitt" radius={[0,3,3,0]}>
                {sStats.map((s,i) => <Cell key={i} fill={gc(s.avg)}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </motion.div>
  );
});

export default Dashboard;