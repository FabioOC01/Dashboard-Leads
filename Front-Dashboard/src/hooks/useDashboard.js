/* useDashboard.js — shared hooks + formatters (portados del diseño Leads 2.0) */
import { useState, useEffect, useRef } from 'react';

/* animated number counter (eased) */
export function useAnimatedNumber(target, { duration = 900, decimals = 0 } = {}) {
  const [val, setVal] = useState(0);
  const ref = useRef({ from: 0, start: 0 });
  useEffect(() => {
    ref.current.from = val;
    ref.current.start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - ref.current.start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = ref.current.from + (target - ref.current.from) * eased;
      setVal(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // fallback: garantizar el valor final aunque rAF se pause (pestaña en segundo plano)
    const safety = setTimeout(() => setVal(target), duration + 80);
    return () => { cancelAnimationFrame(raf); clearTimeout(safety); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/* live Peru clock (America/Lima) */
export function usePeruClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/Lima' });
  const date = now.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Lima' });
  return { time, date };
}

/* segundo a segundo: devuelve un contador que cambia cada intervalo (fuerza re-render) */
export function useTicker(intervalMs = 1000) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(v => v + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return t;
}

/* format minutos restantes de SLA → { txt, level, overdue } */
export function fmtCountdownMin(minsRemaining) {
  if (minsRemaining == null || isNaN(minsRemaining)) return { txt: '—', level: 'ok', overdue: false };
  const secs = Math.round(minsRemaining * 60);
  const overdue = secs < 0;
  const a = Math.abs(secs);
  const h = Math.floor(a / 3600);
  const m = Math.floor((a % 3600) / 60);
  const s = a % 60;
  let txt;
  if (h > 0) txt = `${h}h ${String(m).padStart(2, '0')}m`;
  else txt = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  let level = 'ok';
  if (overdue) level = 'danger';
  else if (minsRemaining < 3) level = 'warn';
  return { txt: (overdue ? '+' : '') + txt, level, overdue };
}
