import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const ESTADO_COLORS = {
  nuevo:              '#1B4F72',
  en_atencion:        '#D97706',
  cotizado:           '#3fb3e9',
  venta_efectiva:     '#038539',
  negociacion_futuro: '#8E44AD',
  no_efectiva:        '#E74C3C',
};

const ESTADO_LABELS = {
  nuevo: 'Nuevo',
  en_atencion: 'En atención',
  cotizado: 'Cotizado',
  venta_efectiva: 'Venta efectiva',
  negociacion_futuro: 'Neg. a futuro',
  no_efectiva: 'No efectiva',
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
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
