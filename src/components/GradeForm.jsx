import { useState, useRef, memo } from "react";
import { AnimatePresence } from "framer-motion";
import { useApp } from "../context/index.jsxx";
import { useToast } from "../context/index.jsxx";
import { useClickOutside } from "../hooks/index.jsxx";
import { uid, toStr, fDE, gc, gl } from "../utils/helpers.jsxx";
import { ARTEN } from "../utils/tokens.jsxx";
import { C, R } from "../utils/tokens.jsxx";
import { SparkBtn, Lbl, HR, SelInp, TxtInp, Combobox, Calendar, baseInpStyle } from "./ui.jsxx";
import { ElasticSlider } from "../animations/index.jsxx";

const GradeForm = memo(({ onClose, editItem }) => {
  const { grades, setGrades, subjects, setSubjects } = useApp();
  const toast = useToast();
  const [form, setForm] = useState(() => editItem
    ? { ...editItem, grade:String(editItem.grade), weight:editItem.weight??1 }
    : { subject:"", grade:"", weight:1, date:toStr(), type:"" }
  );
  const [showCal, setShowCal] = useState(false);
  const [errors, setErrors]   = useState({});
  const calRef = useRef(null);
  useClickOutside(calRef, () => setShowCal(false));

  const set = k => v => setForm(p => {
    const n = { ...p, [k]:v };
    if (k==="type" && v==="Schulaufgabe" && p.weight===1) n.weight = 2;
    return n;
  });
  const setE = k => e => set(k)(e.target.value);

  const validate = () => {
    const e = {};
    if (!form.subject.trim()) e.subject = "Pflichtfeld";
    const g = parseFloat(form.grade);
    if (!form.grade||isNaN(g)||g<1||g>6) e.grade = "Note 1.0 – 6.0";
    if (!form.type) e.type = "Pflichtfeld";
    if (!form.date) e.date = "Pflichtfeld";
    setErrors(e); return !Object.keys(e).length;
  };

  const submit = () => {
    if (!validate()) return;
    const subj = form.subject.trim();
    if (subj && !subjects.includes(subj)) setSubjects(p => [...p, subj]);
    const entry = { ...form, subject:subj, grade:parseFloat(form.grade), weight:form.weight };
    if (editItem) {
      setGrades(p => p.map(g => g.id===editItem.id?{...entry,id:editItem.id}:g));
      toast("Note aktualisiert.");
    } else {
      setGrades(p => [...p, { ...entry, id:`g${uid()}` }]);
      toast("Note gespeichert.");
    }
    onClose();
  };

  const gn = parseFloat(form.grade), gOk = !isNaN(gn)&&gn>=1&&gn<=6;

  return (
    <div>
      <div style={{ marginBottom:18 }}>
        <Lbl>Fach</Lbl>
        <Combobox value={form.subject} onChange={set("subject")} options={subjects} placeholder="Fach eingeben oder wählen…" autoFocus />
        {errors.subject && <div style={{ fontSize:11, color:C.err, marginTop:4 }}>{errors.subject}</div>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:18 }}>
        <div>
          <Lbl>Note (1 – 6)</Lbl>
          <div style={{ position:"relative" }}>
            <input type="number" value={form.grade} onChange={setE("grade")} min={1} max={6} step={0.5} placeholder="z.B. 2.0"
              style={{ ...baseInpStyle(false) }} />
            {gOk && <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:11, fontWeight:700, color:gc(gn), pointerEvents:"none" }}>{gl(gn)}</span>}
          </div>
          {errors.grade && <div style={{ fontSize:11, color:C.err, marginTop:4 }}>{errors.grade}</div>}
        </div>
        <div>
          <Lbl>Leistungsart</Lbl>
          <SelInp value={form.type} onChange={setE("type")} options={ARTEN} placeholder="Art wählen…" />
          {errors.type && <div style={{ fontSize:11, color:C.err, marginTop:4 }}>{errors.type}</div>}
        </div>
      </div>

      <div style={{ marginBottom:18 }}>
        <ElasticSlider value={form.weight} onChange={set("weight")} startingValue={0.5} maxValue={4} isStepped stepSize={0.5} label="Gewichtung" />
        {form.type==="Schulaufgabe" && <div style={{ fontSize:10, color:C.acc, marginTop:6 }}>Schulaufgabe → automatisch Gewichtung 2</div>}
      </div>

      <div ref={calRef} style={{ marginBottom:24 }}>
        <Lbl>Datum</Lbl>
        <div style={{ position:"relative" }}>
          <TxtInp value={form.date?fDE(form.date):""} placeholder="Datum wählen…" readOnly onClick={() => setShowCal(v=>!v)} />
          <svg style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}
            width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth={2} strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <AnimatePresence>
            {showCal && <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:400 }}>
              <Calendar value={form.date} onChange={set("date")} onClose={() => setShowCal(false)} />
            </div>}
          </AnimatePresence>
        </div>
        {errors.date && <div style={{ fontSize:11, color:C.err, marginTop:4 }}>{errors.date}</div>}
      </div>

      <HR />
      <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:16 }}>
        <SparkBtn variant="ghost" onClick={onClose}>Abbrechen</SparkBtn>
        <SparkBtn onClick={submit}>{editItem ? "Änderungen speichern" : "Note speichern"}</SparkBtn>
      </div>
    </div>
  );
});

export default GradeForm;