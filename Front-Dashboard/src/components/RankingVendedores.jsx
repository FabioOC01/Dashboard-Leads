export default function RankingVendedores({ metricas }) {
  const sorted = [...metricas].sort((a, b) =>
    (a.avg_min_primera_respuesta || 999) - (b.avg_min_primera_respuesta || 999)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map((v, i) => (
        <div key={v.id} style={{
          display: 'flex', alignItems: 'center', gap: 16,
          background: 'white', borderRadius: 10, padding: '12px 16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: i === 0 ? '#F1C40F' : i === 1 ? '#BDC3C7' : '#CD7F32',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: 'white', fontSize: 14, flexShrink: 0
          }}>
            {i + 1}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{v.nombre}</div>
            <div style={{ fontSize: 12, color: '#888' }}>
              {v.leads_activos} activos · {v.ventas_efectivas} cerrados
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#888' }}>Prom. respuesta</div>
            <div style={{ fontWeight: 700, color: '#1B4F72', fontSize: 16 }}>
              {v.avg_min_primera_respuesta
                ? `${v.avg_min_primera_respuesta} min`
                : '—'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
