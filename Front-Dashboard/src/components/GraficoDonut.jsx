import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const PALETA = [
  '#6366f1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#84CC16',
];

export default function GraficoDonut({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
        No hay datos
      </div>
    );
  }

  const dataConColor = data.map((d, i) => ({
    ...d,
    color: d.color || PALETA[i % PALETA.length],
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={dataConColor} margin={{ top: 8, right: 8, left: -20, bottom: 40 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          angle={-35}
          textAnchor="end"
          interval={0}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: 'var(--border)', opacity: 0.4 }}
          contentStyle={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border)',
            color: 'var(--text-main)',
            borderRadius: 8,
            boxShadow: 'var(--shadow)',
            fontSize: 12,
          }}
          itemStyle={{ color: 'var(--text-main)', fontWeight: 600 }}
          formatter={(value, name) => [value, name]}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}
          isAnimationActive={true} animationBegin={0} animationDuration={900} animationEasing="ease-out">
          {dataConColor.map((entry, i) => (
            <Cell key={`cell-${i}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
