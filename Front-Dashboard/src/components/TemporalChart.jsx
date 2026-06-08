/* TemporalChart.jsx — evolución de leads / ventas / vencimientos */
import { Icon } from './Icon';

export default function TemporalChart({ series, titulo = 'Evolución temporal', subtitulo = 'leads · ventas · vencimientos' }) {
  const labels = series?.labels || [];
  const leads = series?.leads || [];
  const ventas = series?.ventas || [];
  const breach = series?.breach || [];
  const n = labels.length;

  const W = 760, H = 230, pad = { l: 30, r: 14, t: 16, b: 28 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const maxL = Math.max(1, ...leads) * 1.15;
  const maxV = Math.max(1, ...ventas);
  const x = i => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = v => pad.t + ih - (v / maxL) * ih;
  const linePath = arr => arr.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const areaPath = arr => linePath(arr) + ` L${x(n - 1)} ${pad.t + ih} L${x(0)} ${pad.t + ih} Z`;
  const bw = Math.max(4, iw / Math.max(n, 1) * 0.32);
  const gridY = [0, 0.25, 0.5, 0.75, 1].map(p => pad.t + ih - p * ih);

  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title"><Icon name="pulse" size={17} /> {titulo}</span>
        <div className="card__tools"><span className="card__sub">{subtitulo}</span></div>
      </div>
      <div className="card__body">
        <div className="chart">
          {n === 0 ? (
            <div className="crit-empty">Sin datos en el período</div>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="gLtemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {gridY.map((gy, i) => (
                <line key={i} x1={pad.l} y1={gy} x2={W - pad.r} y2={gy} stroke="var(--border)" strokeWidth="1" />
              ))}
              {breach.map((v, i) => v > 0 && (
                <rect key={i} x={x(i) - bw / 2} y={y(v)} width={bw} height={pad.t + ih - y(v)}
                  rx="2" fill="var(--danger)" opacity="0.28" />
              ))}
              <path d={areaPath(leads)} fill="url(#gLtemp)" />
              <path d={linePath(leads)} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
              <path d={linePath(ventas.map(s => s * (maxL / maxV / 1.6)))}
                fill="none" stroke="var(--st-venta)" strokeWidth="2.5" />
              {leads.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2" />)}
              {labels.map((h, i) => (
                <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)" fontFamily="IBM Plex Mono, monospace">{h}</text>
              ))}
            </svg>
          )}
        </div>
        <div className="chart-legend">
          <span><i style={{ background: 'var(--primary)' }} /> Leads ingresados</span>
          <span><i style={{ background: 'var(--st-venta)' }} /> Ventas efectivas</span>
          <span><i style={{ background: 'var(--danger)', opacity: .4 }} /> SLA vencidos</span>
        </div>
      </div>
    </div>
  );
}
