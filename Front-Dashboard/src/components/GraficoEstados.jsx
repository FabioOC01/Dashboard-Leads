import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const ESTADO_COLORS = {
  nuevo:              '#1B4F72',
  en_atencion:        '#D97706',
  cotizado:           '#3fb3e9',
  cotizado_tecnico:   '#0369A1',
  venta_efectiva:     '#038539',
  negociacion_futuro: '#8E44AD',
  no_efectiva:        '#E74C3C',
};

const ESTADO_LABELS = {
  nuevo:            'Nuevo',
  en_atencion:      'En atención',
  cotizado:         'Cotizado',
  cotizado_tecnico: 'Cot. Técnico',
  venta_efectiva:   'Venta efectiva',
  negociacion_futuro: 'Neg. a futuro',
  no_efectiva:      'No efectiva',
};

export default function GraficoEstados({ leads }) {
  const counts = {};
  leads.forEach(l => {
    const e = l.estado || 'nuevo';
    counts[e] = (counts[e] || 0) + 1;
  });

  const data = Object.entries(counts)
    .map(([key, value]) => ({
      name: ESTADO_LABELS[key] || key,
      value,
      color: ESTADO_COLORS[key] || '#888',
    }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>No hay datos</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8, paddingTop: 20 }}>
      {/* Pie rotando */}
      <div style={{ flex: 1, animation: 'spin-slow 20s linear infinite' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="50%"
              outerRadius="80%"
              dataKey="value"
              stroke="none"
              paddingAngle={2}
              isAnimationActive={true}
              animationBegin={0}
              animationDuration={900}
              animationEasing="ease-out"
            >
              {data.map((entry, i) => (
                <Cell key={`cell-${i}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border)',
                color: 'var(--text-main)',
                borderRadius: 8,
                boxShadow: 'var(--shadow)',
              }}
              itemStyle={{ color: 'var(--text-main)', fontWeight: 600 }}
              formatter={(value, name) => [value, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda estática (no rota) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', justifyContent: 'center' }}>
        {data.map(entry => (
          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
            {entry.name}
          </div>
        ))}
      </div>
    </div>
  );
}
