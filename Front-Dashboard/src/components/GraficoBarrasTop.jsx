import { useState, useEffect } from 'react';

const RANK_COLORS = ['#F59E0B', '#9CA3AF', '#CD7F32', 'var(--text-muted)'];

export default function GraficoBarrasTop({ data, color = 'var(--color-green)' }) {
  const [animado, setAnimado] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimado(true), 50);
    return () => clearTimeout(t);
  }, []);
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
        No hay datos
      </div>
    );
  }

  const max = Math.max(...data.map(d => d.value));
  const top4 = data.slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {top4.map((item, i) => {
        const pct = max > 0 ? (item.value / max) * 100 : 0;
        const isTop = i === 0;

        return (
          <div key={item.name} style={{
            display: 'grid',
            gridTemplateColumns: '22px 1fr auto',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 8,
            background: isTop ? 'var(--filter-bg)' : 'transparent',
            border: `1px solid ${isTop ? 'var(--border)' : 'transparent'}`,
          }}>
            {/* Rank / Icon */}
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: item.icon ? 'transparent' : RANK_COLORS[i],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: i < 2 ? '#111' : 'var(--text-muted)',
              flexShrink: 0,
            }}>
              {item.icon
                ? <img src={item.icon} alt={item.name} style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: '50%' }} />
                : i + 1}
            </div>

            {/* Nombre + barra */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)',
                marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.name}
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: animado ? `${pct}%` : '0%',
                  background: item.color || color,
                  opacity: isTop ? 1 : 0.65,
                  transition: `width 0.7s cubic-bezier(0.25, 1, 0.5, 1) ${i * 80}ms`,
                }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.55) 50%, transparent 80%)',
                  backgroundSize: '200% 100%',
                  animation: `shimmer-bar ${1.8 + i * 0.4}s linear infinite`,
                  animationDelay: `${i * 0.5}s`,
                }} />
              </div>
            </div>

            {/* Valor */}
            <div style={{
              fontSize: 14, fontWeight: 800,
              color: 'var(--text-main)',
              minWidth: 20, textAlign: 'right',
            }}>
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
