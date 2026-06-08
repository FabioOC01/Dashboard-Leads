/* KpiStrip.jsx — 3 KPIs (Leads, Ventas efectivas, SLA cumplido) tintados + sparkline */
import { useId } from 'react';
import { Icon } from './Icon';
import { useAnimatedNumber } from '../hooks/useDashboard';

function Sparkline({ data, w = 56, h = 22 }) {
  const gid = 'sp' + useId().replace(/:/g, '');
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const n = data.length;
  const x = i => (i / (n - 1)) * w;
  const y = v => h - 2 - ((v - min) / range) * (h - 4);
  const line = data.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = line + ` L${w} ${h} L0 ${h} Z`;
  return (
    <svg className="kpi__spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--kpi-accent, var(--primary))" stopOpacity="0.26" />
          <stop offset="100%" stopColor="var(--kpi-accent, var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="var(--kpi-accent, var(--primary))" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(n - 1).toFixed(1)} cy={y(data[n - 1]).toFixed(1)} r="2" fill="var(--kpi-accent, var(--primary))" />
    </svg>
  );
}

function KpiCard({ kpi }) {
  const decimals = Number.isInteger(kpi.value) ? 0 : 1;
  const v = useAnimatedNumber(kpi.value, { decimals });
  const hasTrend = typeof kpi.trend === 'number';
  const goodDown = kpi.good === 'down';
  const positive = goodDown ? kpi.trend < 0 : kpi.trend > 0;
  const trendCls = !hasTrend ? '' : (kpi.trend === 0 ? 'trend--flat' : (positive ? 'trend--up' : 'trend--down'));
  const trendIcon = kpi.trend === 0 ? 'arrowRight' : (kpi.trend > 0 ? 'arrowUp' : 'arrowDown');
  const hasSpark = Array.isArray(kpi.spark) && kpi.spark.length >= 2;
  return (
    <div className="kpi" style={{ '--kpi-accent': kpi.accent }}>
      <span className="kpi__wm"><Icon name={kpi.icon} size={74} stroke={1.4} /></span>
      <div className="kpi__l">
        <span className="kpi__label">
          <span className="kpi__dot"><Icon name={kpi.icon} size={15} /></span>{kpi.label}
        </span>
        <div className="kpi__val">
          {v.toLocaleString('es-PE')}{kpi.suffix && <small>{kpi.suffix}</small>}
        </div>
      </div>
      {(hasTrend || hasSpark || kpi.note) && (
        <div className="kpi__r">
          {hasTrend && (
            <span className={'trend ' + trendCls}>
              <Icon name={trendIcon} size={12} stroke={2.6} />{Math.abs(kpi.trend)}%
            </span>
          )}
          {hasSpark && <Sparkline data={kpi.spark} />}
          {kpi.note && <span className="kpi__note">{kpi.note}</span>}
        </div>
      )}
    </div>
  );
}

export default function KpiStrip({ kpis }) {
  return (
    <div className="grid grid--kpi">
      {kpis.map(k => <KpiCard key={k.key} kpi={k} />)}
    </div>
  );
}
