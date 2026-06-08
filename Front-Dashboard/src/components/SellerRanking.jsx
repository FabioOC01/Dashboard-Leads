/* SellerRanking.jsx - ranking de vendedores (ventas, leads, SLA%) */
import { Icon } from './Icon';
import { initials, avatarColor } from '../utils/domain';

function slaTone(sla) {
  if (sla >= 70) return 'ok';
  if (sla >= 51) return 'warn';
  return 'danger';
}

export default function SellerRanking({ data, onVerTodos }) {
  const rows = data || [];
  const counts = rows.reduce((acc, r) => {
    acc[slaTone(r.sla)]++;
    return acc;
  }, { ok: 0, warn: 0, danger: 0 });

  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title"><Icon name="trophy" size={17} /> Ranking de vendedores</span>
        {onVerTodos && (
          <div className="card__tools">
            <button className="card__link" onClick={onVerTodos}>Ver todos <Icon name="chevRight" size={13} /></button>
          </div>
        )}
      </div>
      <div className="card__body" style={{ paddingTop: 4 }}>
        {rows.length === 0 && <div className="crit-empty">Sin datos de vendedores</div>}
        {rows.length > 0 && (
          <div className="rank-sla-legend">
            <span className="rank-sla-legend__item rank-sla-legend__item--ok"><i />{counts.ok} en verde</span>
            <span className="rank-sla-legend__item rank-sla-legend__item--warn"><i />{counts.warn} en amarillo</span>
            <span className="rank-sla-legend__item rank-sla-legend__item--danger"><i />{counts.danger} en rojo</span>
          </div>
        )}
        <div className="ranking">
          {rows.map((r, i) => {
            const tone = slaTone(r.sla);

            return (
              <div className={'rank-row' + (i === 0 ? ' is-top' : '')} key={r.id}>
                <span className="rank-pos">
                  {i === 0 ? <Icon name="trophy" size={15} style={{ color: 'var(--warn)' }} /> : i + 1}
                </span>
                <div className="rank-id">
                  <span className="rank-av" style={{ background: avatarColor(r.name) }}>{initials(r.name)}</span>
                  <div className="rank-meta">
                    <div className="rank-name">{r.name}</div>
                    <div className="rank-sub">
                      <span>{r.leads} leads</span>
                      <span>{r.ventas} ventas</span>
                    </div>
                  </div>
                </div>
                <div className="rank-stat">
                  <div className={'rank-sla rank-sla--' + tone}>
                    <span className="rank-sla__label">SLA</span>
                    <span className="rank-sla__value">{r.sla}%</span>
                    <span className="rank-sla__track">
                      <span style={{ width: Math.max(0, Math.min(100, r.sla)) + '%' }} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
