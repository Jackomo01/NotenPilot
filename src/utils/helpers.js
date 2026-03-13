export const uid   = () => Math.random().toString(36).slice(2, 9);
export const wAvg  = gs => {
  if (!gs?.length) return null;
  const tw = gs.reduce((s, g) => s + (g.weight ?? 1), 0);
  const ts = gs.reduce((s, g) => s + g.grade * (g.weight ?? 1), 0);
  return tw ? +(ts / tw).toFixed(2) : null;
};
export const toStr = () => new Date().toISOString().slice(0, 10);
export const fDE   = d => {
  try { return new Date(d + "T12:00:00").toLocaleDateString("de-DE", { day:"2-digit", month:"2-digit", year:"numeric" }); }
  catch { return d; }
};

import { C } from "./tokens.js";

export const gc = g => {
  if (!g) return C.t2;
  if (g <= 1.3) return C.g1;
  if (g <= 2.3) return C.g2;
  if (g <= 3.3) return C.g3;
  if (g <= 4.3) return C.g4;
  return C.g5;
};

export const gl = g => {
  if (!g) return "";
  if (g <= 1.5) return "Sehr gut";
  if (g <= 2.5) return "Gut";
  if (g <= 3.5) return "Befriedigend";
  if (g <= 4.5) return "Ausreichend";
  return "Mangelhaft";
};