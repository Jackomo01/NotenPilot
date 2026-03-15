import React, { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { useApp } from "../context/index.jsx";
import { useCountUp } from "../hooks/index.jsx";
import { wAvg, fDE, gc, gl } from "../utils/helpers.jsx";
import { C, R } from "../utils/tokens.jsx";
import { Sk, Card, Lbl, ChartTip } from "../components/ui.jsx";

const AnimNum = ({ to, dec=0 }) => { const v = useCountUp(to??0); return <span>{v.toFixed(dec)}</span>; };








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
    return s.map((g,i) => {
      const parts = g.date.split("-"); // YYYY-MM-DD
      const datum = parts.length === 3 ? `${parts[2]}.${parts[1]}.` : g.date.slice(5);
      return { datum, idx:i, Note:g.grade, Schnitt:wAvg(s.slice(0,i+1)), Fach:g.subject };
    });
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
          <div style={{ fontSize:13, fontWeight:600, color:C.t0, marginBottom:16 }}>Notenverlauf</div>
          {trend.length >= 2 ? (
            <NoteChart data={trend} avgColor={avgColor} height={220}/>
          ) : (
            <div style={{ height:210, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:C.t2 }}>
              Nicht genug Daten
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