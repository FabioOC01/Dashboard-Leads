import { useState, useEffect } from 'react';

const ESTADO_COLORS = {
  nuevo: '#38bdf8',
  en_atencion: '#a78bfa',
  cotizado: '#f59e0b',
  derivado: '#06b6d4',
  cotizado_tecnico: '#14b8a6',
  venta_efectiva: '#10b981',
  negociacion_futuro: '#fb923c',
  no_efectiva: '#f43f5e',
};

const ESTADO_LABELS = {
  nuevo: 'Nuevo',
  en_atencion: 'En Atención',
  cotizado: 'Cotizado',
  derivado: 'Derivado',
  cotizado_tecnico: 'Cot. Técnico',
  venta_efectiva: 'Venta Efectiva',
  negociacion_futuro: 'Neg. Futuro',
  no_efectiva: 'No Efectiva',
};

export default function GraficoEstados({ leads }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const counts = {};
  leads.forEach(l => {
    const e = l.estado || 'nuevo';
    counts[e] = (counts[e] || 0) + 1;
  });

  const data = Object.entries(counts)
    .map(([key, value]) => ({
      key,
      name: ESTADO_LABELS[key] || key,
      value,
      color: ESTADO_COLORS[key] || '#6b7280',
    }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 0', color: 'var(--text-dim)', fontSize: 14,
      }}>
        No hay datos
      </div>
    );
  }

  const max = data[0].value;
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '5px 0px 1px' }}>
      {data.map((d, i) => {
        const barW = max > 0 ? (d.value / max) * 200 : 0;
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
        return (
          <div key={d.key} style={{
            display: 'grid', gridTemplateColumns: '78px 1fr 15px',
            alignItems: 'center', gap: 8,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(10px)',
            transition: `all 0.6s cubic-bezier(.4,0,.2,1) ${i * 60}ms`,
          }}>
            <div style={{
              fontSize: 12, color: 'var(--text-muted)', fontWeight: 500,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{d.name}</div>
            <div style={{
              height: 20, background: 'var(--track)',
              borderRadius: 3, overflow: 'hidden', position: 'relative',
            }}>
              <div style={{
                height: '100%',
                width: visible ? `${barW}%` : '0%',
                background: `linear-gradient(90deg, ${d.color}aa 0%, ${d.color} 25%, ${d.color}aa 50%, ${d.color} 75%, ${d.color}aa 100%)`,
                backgroundSize: '200% 100%',
                animation: 'waveBg 2.5s linear infinite',
                borderRadius: 3,
                boxShadow: `0 0 6px ${d.color}55`,
                transition: `width 0.6s cubic-bezier(.4,0,.2,1) ${i * 60}ms`,
              }} />
            </div>
            <div style={{
              fontSize: 10, color: 'var(--text-main)', fontWeight: 800,
              fontVariantNumeric: 'tabular-nums', textAlign: 'right',
            }}>
              {d.value}

            </div>
          </div>
        );
      })}
    </div>
  );
}
