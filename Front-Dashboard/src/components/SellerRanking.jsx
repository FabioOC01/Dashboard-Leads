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
        <div className="ranking">
          {rows.map((r, i) => {
            const tone = slaTone(r.sla);
            const respTotal = r.verde + r.amarillo + r.rojo;
            const segPct = n => (respTotal ? (n / respTotal) * 100 : 0);

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
                  <div className="rank-stat__head">
                    <span className="rank-sla__label">SLA 1ª resp.</span>
                    <span className={'rank-sla__value rank-sla__value--' + tone}>{r.sla}%</span>
                  </div>
                  {respTotal > 0 && (
                    <>
                      <span className="rank-breakdown__track">
                        <span style={{ width: segPct(r.verde) + '%', background: 'var(--ok)' }} />
                        <span style={{ width: segPct(r.amarillo) + '%', background: 'var(--warn)' }} />
                        <span style={{ width: segPct(r.rojo) + '%', background: 'var(--danger)' }} />
                      </span>
                      <div className="rank-breakdown__counts">
                        <span className="rank-breakdown__count rank-breakdown__count--ok"><i />{r.verde}</span>
                        <span className="rank-breakdown__count rank-breakdown__count--warn"><i />{r.amarillo}</span>
                        <span className="rank-breakdown__count rank-breakdown__count--danger"><i />{r.rojo}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
