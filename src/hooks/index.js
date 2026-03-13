import { useState, useEffect, useCallback } from "react";
import { db } from "../utils/storage.jsx";

export const useLS = (key, init) => {
  const [v, sv] = useState(() => db.get(key, init));
  const set = useCallback(fn => {
    sv(p => {
      const n = typeof fn === "function" ? fn(p) : fn;
      db.set(key, n);
      return n;
    });
  }, [key]);
  return [v, set];
};

export const useCountUp = (target, ms = 900) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target == null) return;
    const s = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - s) / ms, 1);
      const e = 1 - (1 - p) ** 3;
      setVal(+(target * e).toFixed(2));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return val;
};

export const useClickOutside = (ref, fn) => {
  useEffect(() => {
    const h = e => { if (!ref.current?.contains(e.target)) fn(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [fn]);
};