/* CriticalLeads.jsx - leads por vencer / vencidos, con cuenta regresiva en vivo */
import { Icon } from './Icon';
import SellerAvatar from './SellerAvatar';
import { useTicker, fmtCountdownMin } from '../hooks/useDashboard';
import {
  statusMeta, canalMeta, getMinutosPrimeraRespuesta,
  ESTADOS_CERRADOS, SLA_RESPUESTA,
} from '../utils/domain';

export default function CriticalLeads({ leads, fetchedAt, limit = 4, onVerDetalle, vendedores = [] }) {
  useTicker(1000); // re-render cada segundo para el countdown

  const items = (leads || [])
    .map(l => {
      if (ESTADOS_CERRADOS.includes(l.estado) || l.ts_primera_respuesta) return null;
      const transcurrido = getMinutosPrimeraRespuesta(l, fetchedAt);
      if (transcurrido == null) return null;
      const sla = { tipo: 'primera', label: '1ra respuesta', meta: SLA_RESPUESTA, transcurrido };
      const restante = sla.meta - sla.transcurrido;
      return { lead: l, sla, restante };
    })
    .filter(Boolean)
    // Todos los leads pendientes de primera respuesta, ordenados por urgencia.
    .sort((a, b) => a.restante - b.restante)
    .slice(0, limit);

  const vencidos = items.filter(x => x.restante < 0).length;

  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title"><Icon name="flame" size={17} style={{ color: 'var(--danger)' }} /> Leads críticos · por vencer</span>
        <div className="card__tools">
          {vencidos > 0 && (
            <span className="chip-mini" style={{ color: 'var(--danger-ink)', background: 'var(--danger-bg)' }}>{vencidos} vencidos</span>
          )}
          {onVerDetalle && <button className="card__link" onClick={onVerDetalle}>Ver detalle <Icon name="chevRight" size={13} /></button>}
        </div>
      </div>
      <div className="card__body">
        {items.length === 0 ? (
          <div className="crit-empty">Sin leads críticos en este momento 🎉</div>
        ) : (
          <div className="crit">
            {items.map(({ lead: l, sla, restante }) => {
              const cd = fmtCountdownMin(restante);
              const rowCls = restante <= 5 ? 'is-danger' : restante <= 10 ? 'is-warn' : 'is-fresh';
              const st = statusMeta(l.estado);
              const ch = canalMeta(l.canal);
              return (
                <div className={'crit-row ' + rowCls} key={l.id}>
                  <span className="crit-flag" />
                  <div className="crit-main">
                    <div className="crit-name">
                      <span className="crit-name__text">{l.nombre || 'Sin nombre'}</span>
                      <span className={'chip ' + st.cls}><span className="chip__dot" />{st.label}</span>
                    </div>
                    <div className="crit-sub">
                      <span className="cell-mono" style={{ color: 'var(--ink-3)' }}>#{l.id}</span>
                      {l.canal && <><span className="crit-dot" />
                        {ch.icon ? <img src={ch.icon} alt="" style={{ width: 13, height: 13, objectFit: 'contain' }} /> : <span className="checkrow__dot" style={{ background: ch.color }} />}
                        <span style={{ textTransform: 'capitalize' }}>{l.canal}</span></>}
                    </div>
                  </div>
                  <div className="crit-meta">
                    <SellerAvatar seller={l} vendedores={vendedores} size={26} fontSize={10} />
                    <div className="crit-sla">
                      <div className="crit-sla__label">{sla.label}</div>
                      <div className="crit-count">
                        <Icon name={cd.overdue ? 'flame' : 'clock'} size={14} stroke={2.4} />
                        {cd.overdue ? 'Vencido ' : ''}{cd.txt}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
