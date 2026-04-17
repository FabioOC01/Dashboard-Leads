import { useState, useEffect, useRef } from 'react';

function isHorarioHabil() {
  const t = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const day = t.getDay();
  const min = t.getHours() * 60 + t.getMinutes();
  if (day === 0) return false;
  if (day === 6) return min >= 9 * 60 + 30 && min < 14 * 60;
  return min >= 9 * 60 + 30 && min < 18 * 60 + 30;
}

export default function DashboardTecnicos({ leads, fetchedAt }) {
  const [tick, setTick] = useState(0);
  const [animado, setAnimado] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setTick(k => k + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setAnimado(true), 50);
    return () => clearTimeout(t);
  }, []);

  const elapsed = isHorarioHabil() ? (Date.now() - (fetchedAt || Date.now())) / 60000 : 0;

  const sellers = {};
  leads.forEach(l => {
    const v = l.vendedor_nombre || (l.vendedor_id ? `Vendedor ${l.vendedor_id}` : 'Sin Asignar');
    if (!sellers[v]) sellers[v] = { aTiempo: 0, atrasados: 0, cotizados: 0, total: 0 };

    let wTime;
    if (l.ts_primera_respuesta) {
      wTime = parseFloat(l.min_primera_respuesta) || 0;
    } else if (l._socketAt != null) {
      wTime = isHorarioHabil() ? (Date.now() - l._socketAt) / 60000 : parseFloat(l.min_esperando_respuesta) || 0;
    } else if (l.min_esperando_respuesta != null) {
      wTime = parseFloat(l.min_esperando_respuesta) + elapsed;
    } else {
      wTime = 0;
    }

    if (wTime > 15) sellers[v].atrasados++;
    else sellers[v].aTiempo++;

    if (l.estado === 'cotizado') sellers[v].cotizados++;
    sellers[v].total++;
  });

  const VENDOR_PHOTOS = {
    'erimay':    'https://comutelperu.com/correo-cm/Fotos/ERIMAY.png',
    'estefany':  'https://comutelperu.com/correo-cm/Fotos/ESTEFANY.png',
    'sthefania': 'https://comutelperu.com/correo-cm/Fotos/STHEFANIA.png',
    'christian': 'https://comutelperu.com/correo-cm/Fotos/CHRISTIAN-PERFIL.jpg.jpeg',
  };

  const sorted = Object.entries(sellers)
    .map(([nombre, s], i) => ({ nombre, ...s, pct: s.total > 0 ? Math.round((s.aTiempo / s.total) * 100) : 0, idx: i }))
    .sort((a, b) => b.pct - a.pct);

  if (sorted.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', paddingTop: 12 }}>Sin datos en este periodo.</div>;
  }

  return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {sorted.map((s, i) => {
      const barColor = s.pct >= 70 ? '#27AE60' : s.pct >= 50 ? '#D97706' : '#E74C3C';
      const initials = s.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const photo = VENDOR_PHOTOS[s.nombre.split(' ')[0].toLowerCase()] || null;

      return (
        <div
          key={s.nombre}
          style={{
            display: 'grid',
            gridTemplateColumns: '36px 1fr auto',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            background: 'var(--filter-bg)',
            borderRadius: 10,
            border: '1px solid var(--border)',
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: barColor + '22',
              border: `2px solid ${barColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 800,
              color: barColor,
              flexShrink: 0,
              overflow: 'hidden',
              animation: `pulse-glow ${2 + i * 0.3}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
            }}
          >
            {photo
              ? <img src={photo} alt={s.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>

          {/* Nombre + barra */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 5,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                {s.nombre}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: barColor, marginLeft: 8 }}>
                {s.pct}%
              </span>
            </div>

            <div
              style={{
                height: 6,
                borderRadius: 4,
                background: 'var(--border)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: 4,
                  width: animado ? `${s.pct}%` : '0%',
                  background: barColor,
                  transition: `width 0.7s cubic-bezier(0.25, 1, 0.5, 1) ${i * 100}ms`,
                }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.5) 50%, transparent 80%)',
                backgroundSize: '200% 100%',
                animation: `shimmer-bar ${2 + i * 0.35}s linear infinite`,
                animationDelay: `${i * 0.6}s`,
              }} />
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 20,
                background: 'rgba(39,174,96,0.15)',
                color: '#27AE60',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <img
                src="https://comutelperu.com/correo-cm/Iconos/check.png"
                alt="check"
                style={{ width: 12, height: 12, display: 'block' }}
              />
              {s.aTiempo}
            </span>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 20,
                background: 'rgba(231,76,60,0.15)',
                color: '#E74C3C',
              }}
            >
              ✗ {s.atrasados}
            </span>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 20,
                background: 'rgba(230,126,34,0.15)',
                color: '#E67E22',
              }}
            >
              📋 {s.cotizados}
            </span>
          </div>
        </div>
      );
    })}
  </div>
);
}
