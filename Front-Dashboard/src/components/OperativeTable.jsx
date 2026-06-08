/* OperativeTable.jsx — tabla operativa compacta del dashboard */
import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { deleteLead } from '../api/leads';
import {
  statusMeta, canalMeta, initials, avatarColor, ESTADOS_CERRADOS,
  getMinutosPrimeraRespuesta, getMinutosCotizacion, slaLevel,
  SLA_RESPUESTA, SLA_COTIZACION,
} from '../utils/domain';

function fmtMin(m) {
  if (m == null || isNaN(m)) return '—';
  const v = Math.round(m);
  if (v >= 60) return `${Math.floor(v / 60)}h ${v % 60}m`;
  return `${v}m`;
}

export default function OperativeTable({ rows, query, setQuery, fetchedAt, isAdmin, newIds, onVerDetalle, onVer, onEliminar, showSearch = true, totalCount }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(k => k + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const list = rows || [];
  const q = (query || '').toLowerCase();
  const filtered = showSearch
    ? list.filter(r =>
      !q || (r.nombre || '').toLowerCase().includes(q) ||
      String(r.id).includes(q) || (r.requerimiento || '').toLowerCase().includes(q) ||
      (r.vendedor_nombre || '').toLowerCase().includes(q))
    : list;
  const total = totalCount ?? list.length;

  const handleEliminar = (lead) => {
    if (window.confirm(`¿Eliminar el lead de ${lead.nombre}? Esta acción no se puede deshacer.`)) {
      deleteLead(lead.id).then(() => onEliminar?.(lead.id)).catch(err => console.error('Error al eliminar', err));
    }
  };

  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title"><Icon name="layers" size={17} /> Tabla operativa</span>
        {onVerDetalle && (
          <div className="card__tools"><button className="card__link" onClick={onVerDetalle}>Abrir vista detalle <Icon name="arrowRight" size={13} /></button></div>
        )}
      </div>
      <div className="table-toolbar">
        {showSearch && (
          <div className="search">
            <Icon name="search" size={15} />
            <input placeholder="Buscar lead, cliente, vendedor…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        )}
        <span className="pillcount"><b>{filtered.length}</b> de {total} leads</span>
      </div>
      <div className="card__body" style={{ paddingTop: 0 }}>
        <div className="tablewrap">
          <table className="optable">
            <thead>
              <tr>
                <th>Lead / Cliente</th>
                <th>Estado</th>
                <th>Vendedor</th>
                <th>Canal</th>
                <th>1ª resp.</th>
                <th>Cotización</th>
                <th style={{ textAlign: 'right' }}>{isAdmin ? 'Acciones' : ''}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="crit-empty">No hay leads</td></tr>
              )}
              {filtered.map(r => {
                const st = statusMeta(r.estado);
                const ch = canalMeta(r.canal);
                const closed = ESTADOS_CERRADOS.includes(r.estado);
                const mResp = getMinutosPrimeraRespuesta(r, fetchedAt);
                const mCot = getMinutosCotizacion(r, fetchedAt);
                const respCls = closed ? 'sla-closed' : slaLevel(mResp, SLA_RESPUESTA, 20);
                const cotCls = closed ? 'sla-closed' : slaLevel(mCot, SLA_COTIZACION);
                return (
                  <tr key={r.id} className={newIds?.has(r.id) ? 'is-new' : ''}>
                    <td>
                      <div className="cell-lead">
                        <span className="cell-lead__name">{r.nombre || 'Sin nombre'}</span>
                        <span className="cell-lead__id">#{r.id} · {r.celular || r.requerimiento || '—'}</span>
                      </div>
                    </td>
                    <td><span className={'chip ' + st.cls}><span className="chip__dot" />{st.label}</span></td>
                    <td>
                      {r.vendedor_nombre ? (
                        <div className="cell-seller">
                          <span className="rank-av" style={{ background: avatarColor(r.vendedor_nombre) }}>{initials(r.vendedor_nombre)}</span>
                          <span style={{ fontWeight: 500 }}>{r.vendedor_nombre.split(' ')[0]}</span>
                        </div>
                      ) : <span style={{ color: 'var(--ink-3)' }}>Sin asignar</span>}
                    </td>
                    <td>
                      {r.canal ? (
                        <span className="cell-chan">
                          {ch.icon ? <img src={ch.icon} alt="" /> : <span className="checkrow__dot" style={{ background: ch.color }} />}
                          {r.canal}
                        </span>
                      ) : <span style={{ color: 'var(--ink-3)' }}>—</span>}
                    </td>
                    <td><span className={'sla-tag ' + respCls}>{closed ? '—' : fmtMin(mResp)}</span></td>
                    <td><span className={'sla-tag ' + cotCls}>{closed ? '—' : fmtMin(mCot)}</span></td>
                    <td className="td-act">
                      {isAdmin ? (
                        <>
                          <button className="minibtn" title="Editar en detalle" onClick={onVerDetalle}><Icon name="edit" size={14} /></button>
                          <button className="minibtn" title="Eliminar" onClick={() => handleEliminar(r)}><Icon name="trash" size={14} /></button>
                        </>
                      ) : (
                        <button className="minibtn" title="Ver detalle" onClick={onVer || onVerDetalle}><Icon name="eye" size={14} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
