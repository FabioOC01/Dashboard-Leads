import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-3)',
      border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
      boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: 'var(--text-dim)', fontSize: 10, marginBottom: 4, fontWeight: 600, letterSpacing: 0.4 }}>{label}</div>
      <div style={{ color: 'var(--text-main)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
        Leads: <span>{payload[0].value}</span>
      </div>
    </div>
  );
}

export default function GraficoTiempo({ leads, filtroFecha }) {
  const sorted = [...leads]
    .filter(l => l.ts_lead_creado)
    .sort((a, b) => new Date(a.ts_lead_creado) - new Date(b.ts_lead_creado));

  const dataMap = {};
  sorted.forEach(l => {
    const d = new Date(l.ts_lead_creado);
    let key;
    if (filtroFecha === 'dia') {
      key = d.getHours().toString().padStart(2, '0') + ':00';
    } else if (filtroFecha === 'semana' || filtroFecha === 'mes') {
      key = d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth() + 1).toString().padStart(2, '0');
    } else {
      key = (d.getMonth() + 1).toString().padStart(2, '0') + '/' + d.getFullYear();
    }
    if (!dataMap[key]) dataMap[key] = { time: key, leads: 0 };
    dataMap[key].leads++;
  });

  const data = Object.values(dataMap);

  if (data.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-dim)', fontSize: 12,
      }}>
        No hay datos en este periodo
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', padding: '6px 4px 0' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="areaGradAccent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="time"
            tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'Plus Jakarta Sans' }}
            axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'Plus Jakarta Sans' }}
            axisLine={false} tickLine={false} width={24} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-mid)', strokeDasharray: '3 3' }} />
          <Area
            type="monotone" dataKey="leads" name="Leads"
            stroke="#10b981" strokeWidth={2.5} fill="url(#areaGradAccent)"
            dot={{ fill: '#10b981', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#10b981', strokeWidth: 0 }}
            style={{ filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.5))' }}
            isAnimationActive animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
