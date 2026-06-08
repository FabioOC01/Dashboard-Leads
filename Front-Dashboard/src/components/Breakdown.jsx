/* Breakdown.jsx — tarjeta rotativa de distribución (por estado / canal / tipo) */
import { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';

export default function Breakdown({ views, interval = 6000 }) {
  const [idx, setIdx] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (!pausedRef.current) setIdx(i => (i + 1) % views.length);
    }, interval);
    return () => clearInterval(id);
  }, [views.length, interval]);

  const view = views[Math.min(idx, views.length - 1)] || { title: '', data: [] };
  const rows = (view.data || []).filter(d => d.n > 0);
  const total = rows.reduce((a, b) => a + b.n, 0);
  const max = Math.max(1, ...rows.map(d => d.n));

  return (
    <div className="card"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}>
      <div className="card__head">
        <span className="card__title"><Icon name={view.icon} size={17} /> {view.title}</span>
        <div className="card__tools dot-tabs">
          {views.map((v, i) => (
            <button key={v.id} className={'dot-tab' + (i === idx ? ' is-active' : '')}
              onClick={() => setIdx(i)} title={v.title} aria-label={v.title} />
          ))}
        </div>
      </div>
      <div className="card__body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {rows.length === 0 ? (
          <div className="crit-empty">Sin datos en el período</div>
        ) : (
          <div className="bk-chart" key={view.id}>
            {rows.map((d, i) => {
              const h = (d.n / max) * 100;
              const pct = total ? Math.round((d.n / total) * 100) : 0;
              return (
                <div className="bk-col" key={d.key}>
                  <span className="bk-col__val">{d.n}<span className="bk-col__pct">{pct}%</span></span>
                  <div className="bk-col__track">
                    <div className="bk-col__bar" title={`${d.label}: ${d.n} (${pct}%)`}
                      style={{ height: Math.max(h, 2) + '%', background: d.color, animationDelay: (i * 45) + 'ms' }} />
                  </div>
                  <span className="bk-col__lbl">
                    {d.icon
                      ? <img className="bk-col__logo" src={d.icon} alt={d.label} title={d.label} />
                      : <span className="bk-col__txt">{d.label}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
