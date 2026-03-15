import { useState, useRef, memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "../context/index.jsx";
import { useToast } from "../context/index.jsx";
import { useClickOutside } from "../hooks/index.jsx";
import { uid, toStr, fDE, gc } from "../utils/helpers.jsx";
import { ARTEN } from "../utils/tokens.jsx";
import { C, R } from "../utils/tokens.jsx";
import { SparkBtn, Lbl, HR, SelInp, TxtInp, Combobox, Calendar, baseInpStyle } from "./ui.jsx";

// Schulaufgabe → ×2, everything else → ×1
const getDefaultWeight = (type) => type === "Schulaufgabe" ? 2 : 1;

const WEIGHTS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

const GradeForm = memo(({ onClose, editItem }) => {
  const { grades, setGrades, subjects, setSubjects } = useApp();
  const toast = useToast();
  const [form, setForm] = useState(() => editItem
    ? { ...editItem, grade: String(editItem.grade), weight: editItem.weight ?? 1 }
    : { subject: "", grade: "", weight: 1, date: toStr(), type: "" }
  );
  const [showCal, setShowCal] = useState(false);
  const [errors, setErrors]   = useState({});
  const calRef = useRef(null);
  useClickOutside(calRef, () => setShowCal(false));

  const set = k => v => setForm(p => {
    const n = { ...p, [k]: v };
    if (k === "type") n.weight = getDefaultWeight(v);
    return n;
  });
  const setE = k => e => set(k)(e.target.value);

  const validate = () => {
    const e = {};
    if (!form.subject.trim()) e.subject = "Pflichtfeld";
    const g = parseFloat(form.grade);
    if (!form.grade || isNaN(g) || g < 1 || g > 6) e.grade = "Note 1.0 – 6.0";
    if (!form.type) e.type = "Pflichtfeld";
    if (!form.date) e.date = "Pflichtfeld";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = () => {
    if (!validate()) return;
    const subj = form.subject.trim();
    if (subj && !subjects.includes(subj)) setSubjects(p => [...p, subj]);
    const entry = { ...form, subject: subj, grade: parseFloat(form.grade), weight: form.weight };
    if (editItem) {
      setGrades(p => p.map(g => g.id === editItem.id ? { ...entry, id: editItem.id } : g));
      toast("Note aktualisiert.");
    } else {
      setGrades(p => [...p, { ...entry, id: `g${uid()}` }]);
      toast("Note gespeichert.");
    }
    onClose();
  };

  const isSchulaufgabe = form.type === "Schulaufgabe";

  return (
    <div>
      {/* Fach */}
      <div style={{ marginBottom: 18 }}>
        <Lbl>Fach</Lbl>
        {/* autoFocus entfernt — kein automatisches Fokussieren beim Öffnen */}
        <Combobox value={form.subject} onChange={set("subject")} options={subjects} placeholder="Fach eingeben oder wählen…" />
        {errors.subject && <div style={{ fontSize: 11, color: C.err, marginTop: 4 }}>{errors.subject}</div>}
      </div>

      {/* Note + Art */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        <div>
          <Lbl>Note (1 – 6)</Lbl>
          <input
            type="text"
            inputMode="decimal"
            value={form.grade}
            onChange={e => {
              const val = e.target.value;
              if (/^[0-9]*[.,]?[0-9]*$/.test(val) || val === "") set("grade")(val.replace(",", "."));
            }}
            placeholder="z.B. 2.5"
            style={{ ...baseInpStyle(false) }}
          />
          {errors.grade && <div style={{ fontSize: 11, color: C.err, marginTop: 4 }}>{errors.grade}</div>}
        </div>
        <div>
          <Lbl>Leistungsart</Lbl>
          <SelInp value={form.type} onChange={setE("type")} options={ARTEN} placeholder="Art wählen…" />
          {errors.type && <div style={{ fontSize: 11, color: C.err, marginTop: 4 }}>{errors.type}</div>}
        </div>
      </div>

      {/* Gewichtung */}
      <div style={{ marginBottom: 18 }}>
        <Lbl>Gewichtung</Lbl>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {WEIGHTS.map(w => {
            const isActive = form.weight === w;
            const isAuto   = isSchulaufgabe && w === 2;
            return (
              <button
                key={w}
                onClick={() => set("weight")(w)}
                style={{
                  padding: "6px 14px", borderRadius: R.s,
                  border: `1px solid ${isActive ? C.acc : C.line}`,
                  background: isActive ? `${C.acc}22` : C.bg4,
                  color: isActive ? C.accH : C.t1,
                  fontSize: 13, fontWeight: isActive ? 700 : 400,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.12s", position: "relative",
                  boxShadow: isAuto ? `0 0 8px ${C.acc}25` : "none",
                }}
              >
                ×{w}
                {isAuto && (
                  <span style={{
                    position:"absolute", top:-4, right:-4,
                    width:8, height:8, borderRadius:"50%",
                    background:C.acc, border:`2px solid ${C.bg2}`,
                  }}/>
                )}
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {isSchulaufgabe && (
            <motion.div
              initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
              exit={{ opacity:0, height:0 }} transition={{ duration:0.18 }}
              style={{ overflow:"hidden" }}
            >
              <div style={{
                marginTop:8, display:"inline-flex", alignItems:"center", gap:6,
                padding:"4px 10px", background:`${C.acc}12`,
                border:`1px solid ${C.acc}28`, borderRadius:R.s,
                fontSize:11, color:C.accH, fontWeight:600,
              }}>
                <span style={{ width:5, height:5, borderRadius:"50%", background:C.acc, display:"inline-block" }}/>
                Schulaufgabe → ×2
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Datum */}
      <div ref={calRef} style={{ marginBottom: 24 }}>
        <Lbl>Datum</Lbl>
        <div style={{ position:"relative" }}>
          <TxtInp value={form.date ? fDE(form.date) : ""} placeholder="Datum wählen…" readOnly onClick={() => setShowCal(v => !v)} />
          <svg style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}
            width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth={2} strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <AnimatePresence>
            {showCal && (
              <div style={{ position:"absolute", bottom:"calc(100% + 6px)", left:0, zIndex:400 }}>
                <Calendar value={form.date} onChange={set("date")} onClose={() => setShowCal(false)} />
              </div>
            )}
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