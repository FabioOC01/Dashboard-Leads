const RANK_COLORS = ['#F59E0B', '#9CA3AF', '#CD7F32', 'var(--text-muted)'];

export default function GraficoBarrasTop({ data, color = 'var(--color-green)' }) {
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
            {/* Rank */}
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: RANK_COLORS[i] + (i > 1 ? '' : ''),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: i < 2 ? '#111' : 'var(--text-muted)',
              flexShrink: 0,
            }}>
              {i + 1}
            </div>

            {/* Nombre + barra */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)',
                marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.name}
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${pct}%`,
                  background: item.color || color,
                  opacity: isTop ? 1 : 0.65,
                  transition: 'width 0.5s ease',
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
