import { PieChart, Pie, Cell } from 'recharts';

export default function GraficoSLA({ atendidos, total }) {
  const pct = total > 0 ? Math.round((atendidos / total) * 100) : 0;

  const data = [
    { name: 'SLA Atendido', value: atendidos },
    { name: 'SLA Restante', value: Math.max(total - atendidos, 0) }
  ];

  const COLORS = ['#2ECC71', '#e0e0e0'];
  const size = 230;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', paddingTop: 70 }}>
      <div style={{ position: 'relative', width: size, height: size / 2 + 60 }}>
        <PieChart width={size} height={size}>
          <Pie
            data={data}
            cx={size / 2}
            cy={size / 2}
            startAngle={180}
            endAngle={0}
            innerRadius={size * 0.30}
            outerRadius={size * 0.48}
            dataKey="value"
            stroke="none"
            isAnimationActive={true}
            animationBegin={0}
            animationDuration={1000}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))}
          </Pie>
        </PieChart>
        <div style={{
          position: 'absolute',
          bottom: 45,
          left: '50%',
          transform: 'translateX(-45%)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: '#2ECC71', lineHeight: 1, animation: 'pulse-glow 2.5s ease-in-out infinite' }}>{pct}%</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Atendidos a tiempo</div>
        </div>
      </div>
    </div>
  );
}
