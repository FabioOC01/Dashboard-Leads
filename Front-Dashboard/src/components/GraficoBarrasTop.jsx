import { useState, useEffect } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

const CANAL_COLORS = {
  Store: '#7C3AED', WhatsApp: '#25D366', Facebook: '#60A5FA',
  Instagram: '#EC4899', Web: '#38BDF8', Tiktok: '#9CA3AF', Youtube: '#EF4444',
};

const TIPO_COLORS = {
  requerimiento: '#6366f1',
  soporte:       '#f59e0b',
  academia:      '#10b981',
  producto:      '#ec4899',
  general:       '#38bdf8',
};
const TIPO_PALETTE = ['#6366f1','#f59e0b','#10b981','#ec4899','#38bdf8','#fb923c','#a78bfa'];

const CANAL_ICONS = {
  store:     'https://comutelperu.com/correo-cm/Iconos/odoo.png?v=2',
  whatsapp:  'https://comutelperu.com/correo-cm/Iconos/whatsapp.png',
  facebook:  'https://comutelperu.com/correo-cm/Iconos/facebook.png?v=2',
  instagram: 'https://comutelperu.com/correo-cm/Iconos/instagram.png',
  web:       'https://comutelperu.com/correo-cm/Logo/ISO.png',
  tiktok:    'https://comutelperu.com/correo-cm/Iconos/tiktok.png',
  youtube:   'https://comutelperu.com/correo-cm/Iconos/youtube.png',
};

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
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: payload[0].color }} />
        Leads: <span>{payload[0].value}</span>
      </div>
    </div>
  );
}

function LogoTick({ x, y, payload }) {
  const key = payload.value?.toLowerCase();
  const icon = CANAL_ICONS[key];
  if (!icon) {
    return (
      <text x={x} y={y + 12} textAnchor="middle"
        style={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'Plus Jakarta Sans' }}>
        {payload.value}
      </text>
    );
  }
  return (
    <g transform={`translate(${x - 11}, ${y + 2})`}>
      <image href={icon} width={22} height={22} style={{ borderRadius: 4 }} />
    </g>
  );
}

export default function GraficoBarrasTop({
  dataTipo,
  dataCanal,
  colorTipo = '#6366f1',
  data,
  color = 'var(--accent)',
  tipo = 'tipo',
}) {
  const hasDual = Boolean(dataTipo && dataCanal);
  const [tab, setTab] = useState('canal');

  useEffect(() => {
    if (!hasDual) return;
    const interval = setInterval(() => {
      setTab(current => current === 'canal' ? 'tipo' : 'canal');
    }, 10000);
    return () => clearInterval(interval);
  }, [hasDual]);

  let activeData, activeColor, activeMode;
  if (hasDual) {
    activeData = tab === 'tipo' ? dataTipo : dataCanal;
    activeColor = tab === 'tipo' ? colorTipo : '#6B7280';
    activeMode = tab;
  } else {
    activeData = data;
    activeColor = color;
    activeMode = tipo;
  }

  if (!activeData || activeData.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 200, color: 'var(--text-dim)', fontSize: 12,
      }}>
        No hay datos
      </div>
    );
  }

  const enriched = activeData.map((d, i) => ({
    n: d.name,
    v: d.value,
    c: activeMode === 'canal'
      ? (CANAL_COLORS[d.name] || d.color || activeColor)
      : (TIPO_COLORS[d.name?.toLowerCase()] || TIPO_PALETTE[i % TIPO_PALETTE.length]),
  }));

  const isCanal = activeMode === 'canal';
  const title = isCanal ? 'Por Canal de Ingreso' : 'Por Tipo de Ingreso';

  return (
    <div style={{ width: '100%' }}>
      {hasDual && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="12" cy="12" r="10" fill="none" stroke="var(--track)" strokeWidth="4" />
              <circle cx="12" cy="12" r="10" fill="none" stroke="var(--accent)" strokeWidth="4"
                strokeDasharray="62.83"
                style={{ strokeDashoffset: '62.83', animation: 'circletimer 10s linear infinite' }} />
            </svg>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {['tipo', 'canal'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '5px 14px', fontSize: 11, fontWeight: 600,
                  border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                  transition: 'all 0.2s',
                  background: tab === t ? 'var(--accent)' : 'transparent',
                  color: tab === t ? '#fff' : 'var(--text-dim)',
                }}>
                  {t === 'tipo' ? 'Tipo' : 'Canal'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ width: '100%', height: hasDual ? 200 : 180, padding: '6px 4px 0' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={enriched} barCategoryGap="38%"
            margin={{ top: 18, right: 4, left: -10, bottom: isCanal ? 6 : 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="n"
              axisLine={false} tickLine={false}
              tick={isCanal ? <LogoTick /> : { fill: 'var(--text-main)', fontSize: 12, fontFamily: 'Plus Jakarta Sans', fontWeight: 600 }}
              height={isCanal ? 30 : 20}
            />
            <YAxis
              tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'Plus Jakarta Sans' }}
              axisLine={false} tickLine={false} width={28} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--hover)' }} />
            <Bar dataKey="v" radius={[5, 5, 0, 0]} opacity={0.92}>
              <LabelList dataKey="v" position="top"
                style={{ fill: 'var(--text-main)', fontSize: 11, fontWeight: 700, fontFamily: 'Plus Jakarta Sans' }} />
              {enriched.map((d, i) => (
                <Cell key={i} fill={d.c} style={{ filter: `drop-shadow(0 0 4px ${d.c}55)` }} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
