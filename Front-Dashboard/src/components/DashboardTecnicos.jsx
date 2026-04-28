import { useState, useEffect } from 'react';

function isHorarioHabil() {
  const t = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const day = t.getDay();
  const min = t.getHours() * 60 + t.getMinutes();
  if (day === 0) return false;
  if (day === 6) return min >= 9 * 60 + 30 && min < 14 * 60;
  return min >= 9 * 60 + 30 && min < 18 * 60 + 30;
}

function businessMinutesSince(fromTs) {
  if (!isHorarioHabil()) return 0;
  const toLima = t => new Date(new Date(t).toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const fromLima = toLima(fromTs);
  const nowLima  = toLima(Date.now());
  const BIZ_START = 9 * 60 + 30;
  const fromMin = fromLima.getHours() * 60 + fromLima.getMinutes() + fromLima.getSeconds() / 60;
  const nowMin  = nowLima.getHours()  * 60 + nowLima.getMinutes()  + nowLima.getSeconds()  / 60;
  return Math.max(0, nowMin - Math.max(fromMin, BIZ_START));
}

const VENDOR_PHOTOS = {
  'erimay':    'https://comutelperu.com/correo-cm/Fotos/ERIMAY.png',
  'estefany':  'https://comutelperu.com/correo-cm/Fotos/ESTEFANY.png',
  'sthefania': 'https://comutelperu.com/correo-cm/Fotos/STHEFANIA.png',
  'christian': 'https://comutelperu.com/correo-cm/Fotos/CHRISTIAN-PERFIL.jpg.jpeg',
  'maria':     'https://comutelperu.com/correo-cm/Fotos/MAFER-PERFIL.jpg.jpeg',
};

export default function DashboardTecnicos({ leads, fetchedAt, vendedores }) {
  const [, setTick] = useState(0);
  const [animado, setAnimado] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick(k => k + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setAnimado(true), 60);
    return () => clearTimeout(t);
  }, []);

  const elapsed = businessMinutesSince(fetchedAt || Date.now());

  const sellers = {};

  leads.forEach(l => {
    const v = l.vendedor_nombre || (l.vendedor_id ? `Vendedor ${l.vendedor_id}` : 'Sin Asignar');
    
    // Ignorar al técnico
    const vLower = v.toLowerCase();
    if (vLower.includes('tecnico') || vLower.includes('técnico') || vLower.includes('elias')) {
      return; 
    }

    if (!sellers[v]) sellers[v] = { aTiempo: 0, atrasados: 0, total: 0 };

    let wTime;
    if (l.ts_primera_respuesta) {
      wTime = parseFloat(l.min_primera_respuesta) || 0;
    } else if (l._socketAt != null) {
      wTime = businessMinutesSince(l._socketAt);
    } else if (l.min_esperando_respuesta != null) {
      wTime = parseFloat(l.min_esperando_respuesta) + elapsed;
    } else {
      wTime = 0;
    }

    if (wTime > 15) sellers[v].atrasados++;
    else sellers[v].aTiempo++;
    sellers[v].total++;
  });

  const sorted = Object.entries(sellers)
    .map(([nombre, s]) => ({
      nombre,
      ...s,
      pct: s.total > 0 ? Math.round((s.aTiempo / s.total) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  if (sorted.length === 0) {
    return (
      <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
        Sin datos en este periodo
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px 2px' }}>
      {sorted.map((s, i) => {
        const color = s.pct >= 70 ? '#10b981' : s.pct > 50 ? '#f59e0b' : '#f43f5e';
        const initials = s.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        const photo = VENDOR_PHOTOS[s.nombre.split(' ')[0].toLowerCase()] || null;
        const firstName = s.nombre.split(' ')[0];
        const okW  = s.total > 0 ? (s.aTiempo / s.total) * 100 : 0;
        const lateW = s.total > 0 ? (s.atrasados / s.total) * 100 : 0;

        return (
          <div key={s.nombre} style={{
            display: 'grid', gridTemplateColumns: '28px 1fr',
            alignItems: 'center', gap: 10,
            opacity: animado ? 1 : 0,
            transform: animado ? 'translateY(0)' : 'translateY(10px)',
            transition: `all 0.6s cubic-bezier(.4,0,.2,1) ${i * 70}ms`,
          }}>
            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: color + '22', border: `1.5px solid ${color}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: color,
              flexShrink: 0, overflow: 'hidden',
            }}>
              {photo
                ? <img src={photo} alt={s.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials}
            </div>

            {/* Body */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--text-main)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{firstName}</span>
                <span style={{
                  fontSize: 11, fontWeight: 800, color,
                  fontVariantNumeric: 'tabular-nums',
                }}>{s.pct}%</span>
              </div>

              {/* Stacked mini bar */}
              <div style={{
                height: 5, borderRadius: 3,
                background: 'var(--track)',
                overflow: 'hidden', display: 'flex',
              }}>
                <div style={{
                  height: '100%',
                  width: animado ? `${okW}%` : '0%',
                  background: 'linear-gradient(90deg, #10b981aa 0%, #10b981 25%, #10b981aa 50%, #10b981 75%, #10b981aa 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'waveBg 2.5s linear infinite',
                  boxShadow: '0 0 4px rgba(16,185,129,0.5)',
                  transition: `width 0.7s cubic-bezier(.25,1,.5,1) ${i * 70}ms`,
                }} />
                <div style={{
                  height: '100%',
                  width: animado ? `${lateW}%` : '0%',
                  background: 'linear-gradient(90deg, #f43f5eaa 0%, #f43f5e 25%, #f43f5eaa 50%, #f43f5e 75%, #f43f5eaa 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'waveBg 2.5s linear infinite',
                  transition: `width 0.7s cubic-bezier(.25,1,.5,1) ${i * 70 + 50}ms`,
                }} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <span style={{ fontSize: 9, color: '#10b981', fontWeight: 700 }}>✓ {s.aTiempo}</span>
                <span style={{ fontSize: 9, color: '#f43f5e', fontWeight: 700 }}>✗ {s.atrasados}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
