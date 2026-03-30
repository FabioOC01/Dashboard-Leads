import { useState, useEffect } from 'react';

export default function DashboardTecnicos({ leads, fetchedAt }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(k => k + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsed = (Date.now() - (fetchedAt || Date.now())) / 60000;

  const sellers = {};
  leads.forEach(l => {
    const v = l.vendedor_nombre || (l.vendedor_id ? `Vendedor ${l.vendedor_id}` : 'Sin Asignar');
    if (!sellers[v]) sellers[v] = { aTiempo: 0, atrasados: 0, cotizados: 0, total: 0 };

    const leadElapsed = l._socketAt != null
      ? (Date.now() - l._socketAt) / 60000
      : elapsed;

    let wTime = 0;
    if (l.min_primera_respuesta != null) {
      wTime = l.min_primera_respuesta;
    } else if (l.min_esperando_respuesta != null) {
      wTime = l.min_esperando_respuesta + leadElapsed;
    } else if (l.ts_primera_respuesta) {
      const tsResp = new Date(String(l.ts_primera_respuesta).replace(' ', 'T'));
      const tsRef  = new Date(String(l.ts_efectivo || l.ts_lead_creado).replace(' ', 'T'));
      wTime = (tsResp - tsRef) / 60000;
    } else {
      const ref = new Date(String(l.ts_efectivo || l.ts_lead_creado).replace(' ', 'T'));
      wTime = isNaN(ref.getTime()) ? 0 : (Date.now() - ref.getTime()) / 60000;
    }

    if (wTime > 15) sellers[v].atrasados++;
    else sellers[v].aTiempo++;

    if (l.estado === 'cotizado') sellers[v].cotizados++;
    sellers[v].total++;
  });

  const sorted = Object.entries(sellers)
    .map(([nombre, s]) => ({ nombre, ...s, pct: s.total > 0 ? Math.round((s.aTiempo / s.total) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);

  if (sorted.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', paddingTop: 12 }}>Sin datos en este periodo.</div>;
  }

  return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {sorted.map(s => {
      const barColor = s.pct >= 80 ? '#27AE60' : s.pct >= 50 ? '#D97706' : '#E74C3C';
      const initials = s.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

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
            }}
          >
            {initials}
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
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: 4,
                  width: `${s.pct}%`,
                  background: barColor,
                  transition: 'width 0.5s ease',
                }}
              />
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
