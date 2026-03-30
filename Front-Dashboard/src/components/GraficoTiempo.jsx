import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export default function GraficoTiempo({ leads, filtroFecha }) {
  const sorted = [...leads].filter(l => l.ts_lead_creado).sort((a,b) => new Date(a.ts_lead_creado) - new Date(b.ts_lead_creado));

  const dataMap = {};
  sorted.forEach(l => {
    const d = new Date(l.ts_lead_creado);
    let key;
    if (filtroFecha === 'dia') {
      key = d.getHours().toString().padStart(2, '0') + ':00';
    } else if (filtroFecha === 'semana' || filtroFecha === 'mes') {
      key = d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth()+1).toString().padStart(2, '0');
    } else {
      key = (d.getMonth()+1).toString().padStart(2, '0') + '/' + d.getFullYear();
    }
    if(!dataMap[key]) dataMap[key] = { time: key, leads: 0 };
    dataMap[key].leads++;
  });
  
  const data = Object.values(dataMap);

  if (data.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>No hay datos en este periodo</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2E86C1" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#2E86C1" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEE" />
        <XAxis dataKey="time" stroke="#888" fontSize={12} tickLine={false} axisLine={false} dy={10} />
        <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} dx={-10} allowDecimals={false} />
        <Tooltip 
          contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          labelStyle={{ fontWeight: 600, color: '#333', marginBottom: 4 }}
        />
        <Area type="monotone" dataKey="leads" name="Leads Nuevos" stroke="#2E86C1" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
