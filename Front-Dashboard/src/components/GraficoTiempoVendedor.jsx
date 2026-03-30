import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#2E86C1', '#28B463', '#E67E22', '#8E44AD', '#E74C3C', '#F1C40F'];

export default function GraficoTiempoVendedor({ leads }) {
  // Agrupar leads por vendedor y tipo para promediar minutos de respuesta
  const sellers = {};
  const tiposSet = new Set();

  leads.forEach(l => {
    if (!l.vendedor_nombre || l.min_primera_respuesta == null) return;
    const v = l.vendedor_nombre;
    const t = l.tipo || 'General';
    
    tiposSet.add(t);
    
    if (!sellers[v]) sellers[v] = {};
    if (!sellers[v][t]) sellers[v][t] = { sum: 0, count: 0 };
    
    sellers[v][t].sum += l.min_primera_respuesta;
    sellers[v][t].count += 1;
  });

  const data = Object.keys(sellers).map(v => {
    const row = { vendedor: v };
    Object.keys(sellers[v]).forEach(t => {
      row[t] = Math.round((sellers[v][t].sum / sellers[v][t].count) * 10) / 10;
    });
    return row;
  });
  
  const tipos = Array.from(tiposSet);

  if (data.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>No hay datos suficientes de respuesta</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEE" />
        <XAxis dataKey="vendedor" stroke="#888" fontSize={12} tickLine={false} axisLine={false} dy={10} />
        <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} dx={-10} label={{ value: 'Minutos', angle: -90, position: 'insideLeft', style: { fill: '#888', fontSize: 12 } }} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          labelStyle={{ fontWeight: 600, color: '#333', marginBottom: 4 }}
          formatter={(value) => [`${value} min`, 'Tiempo']}
        />
        <Legend wrapperStyle={{ paddingTop: 20 }} iconType="circle" />
        {tipos.map((tipo, index) => (
          <Bar key={tipo} dataKey={tipo} name={tipo} fill={COLORS[index % COLORS.length]} radius={[4, 4, 0, 0]} barSize={40} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
