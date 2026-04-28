import Semaforo from './Semaforo';
import { updateEstadoLead, updateTiemposLead, deleteLead, updateVendedorLead, updateInfoLead } from '../api/leads';
import { useState, useEffect, useRef } from 'react';

const ESTADOS = {
  nuevo:              { label: 'Nuevo',          color: '#38bdf8' },
  en_atencion:        { label: 'En atención',    color: '#a78bfa' },
  cotizado:           { label: 'Cotizado',       color: '#f59e0b' },
  derivado:           { label: 'Derivado',       color: '#06b6d4' },
  cotizado_tecnico:   { label: 'Cot. Técnico',   color: '#14b8a6' },
  venta_efectiva:     { label: 'Venta efectiva', color: '#10b981' },
  negociacion_futuro: { label: 'Neg. a futuro',  color: '#fb923c' },
  no_efectiva:        { label: 'No efectiva',    color: '#f43f5e' },
};

const inputStyle = {
  fontSize: 11, padding: '4px 8px', borderRadius: 6,
  border: '1px solid var(--border-mid)', background: 'var(--surface-2)',
  color: 'var(--text-main)', fontFamily: 'inherit', outline: 'none',
};

const btnOk = {
  flex: 1, fontSize: 11, padding: '3px 0', borderRadius: 6,
  border: 'none', background: 'var(--accent)', color: '#fff',
  cursor: 'pointer', fontWeight: 700,
};
const btnCancel = {
  flex: 1, fontSize: 11, padding: '3px 0', borderRadius: 6,
  border: 'none', background: 'var(--danger)', color: '#fff',
  cursor: 'pointer', fontWeight: 700,
};

function VendedorSelect({ lead, vendedores }) {
  const handleCambio = (e) => {
    const vendedor_id = e.target.value ? Number(e.target.value) : null;
    updateVendedorLead(lead.id, vendedor_id).catch(err => console.error('Error al cambiar vendedor', err));
  };

  return (
    <select
      value={lead.vendedor_id ?? ''}
      onChange={handleCambio}
      style={{ ...inputStyle, marginTop: 4, width: '100%', cursor: 'pointer' }}
    >
      <option value="">Sin asignar</option>
      {vendedores.map(v => (
        <option key={v.id} value={v.id}>{v.nombre}</option>
      ))}
    </select>
  );
}

function TecnicoSelect({ lead, tecnicos, isAdmin }) {
  const handleCambio = (e) => {
    const tecnico_id = e.target.value ? Number(e.target.value) : null;
    updateEstadoLead(lead.id, lead.estado, tecnico_id).catch(err => console.error("Error al asignar técnico", err));
  };

  if (!isAdmin) {
    const tecnico = tecnicos.find(t => t.id === lead.tecnico_id);
    return (
      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
        {tecnico ? tecnico.nombre : 'Sin asignar'}
      </div>
    );
  }

  return (
    <select
      value={lead.tecnico_id ?? ''}
      onChange={handleCambio}
      style={{ ...inputStyle, marginTop: 4, width: '100%', cursor: 'pointer' }}
    >
      <option value="">Sin asignar</option>
      {tecnicos.map(t => (
        <option key={t.id} value={t.id}>{t.nombre}</option>
      ))}
    </select>
  );
}

function StatePill({ estado }) {
  const cfg = ESTADOS[estado] || { label: estado, color: '#6b7280' };
  return (
    <span className="state-pill" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 6,
      background: cfg.color + '1f',
      border: `1px solid ${cfg.color}55`,
      color: cfg.color, fontSize: 11, fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: cfg.color, boxShadow: `0 0 4px ${cfg.color}`,
      }} />
      {cfg.label}
    </span>
  );
}

function BadgeSelect({ lead, isAdmin, onActualizar }) {
  const cfg = ESTADOS[lead.estado] || { label: lead.estado, color: '#6b7280' };

  const handleCambio = (e) => {
    const nuevoEstado = e.target.value;
    updateEstadoLead(lead.id, nuevoEstado)
      .then(() => onActualizar?.())
      .catch(err => console.error("Error al actualizar", err));
  };

  if (!isAdmin) return <StatePill estado={lead.estado} />;

  return (
    <select
      value={lead.estado}
      onChange={handleCambio}
      style={{
        background: cfg.color + '1f', color: cfg.color,
        padding: '3px 9px', borderRadius: 6,
        border: `1px solid ${cfg.color}55`,
        outline: 'none', cursor: 'pointer', appearance: 'none',
        fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
      }}
    >
      {Object.entries(ESTADOS).map(([val, config]) => (
        <option key={val} value={val} style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>
          {config.label}
        </option>
      ))}
    </select>
  );
}

function tsToInput(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const lima = new Date(d.toLocaleString('en-US', { timeZone: 'America/Lima' }));
  return lima.toISOString().slice(0, 16);
}

function inputToISO(val) {
  if (!val) return null;
  return val + ':00-05:00';
}

function CeldaTiempo({ lead, campo, label, onGuardado, isAdmin }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const inputRef = useRef();

  const abrir = () => {
    setValor(tsToInput(lead[campo]));
    setEditando(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await updateTiemposLead(lead.id, { [campo]: inputToISO(valor) });
      onGuardado?.();
    } catch (err) {
      console.error('Error al guardar tiempo', err);
    } finally {
      setGuardando(false);
      setEditando(false);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ color: lead[campo] ? 'var(--text-main)' : 'var(--text-dim)' }}>
        {lead[campo] ? formatFecha(lead[campo]) : '—'}
      </div>
    );
  }

  if (editando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 170 }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 1 }}>{label}</div>
        <input
          ref={inputRef}
          type="datetime-local"
          value={valor}
          onChange={e => setValor(e.target.value)}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={guardar} disabled={guardando} style={btnOk}>{guardando ? '...' : '✓'}</button>
          <button onClick={() => setEditando(false)} style={btnCancel}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={abrir} title={`Editar ${label}`}
      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
      <span>{lead[campo] ? formatFecha(lead[campo]) : <span style={{ color: 'var(--text-dim)' }}>—</span>}</span>
      <span style={{ fontSize: 10, color: 'var(--text-dim)', opacity: 0.6 }}>✎</span>
    </div>
  );
}

function CeldaInfo({ lead, onGuardado, isAdmin }) {
  const [editando, setEditando] = useState(false);
  const [tipo, setTipo] = useState('');
  const [campana, setCampana] = useState('');
  const [guardando, setGuardando] = useState(false);
  const refTipo = useRef();

  const abrir = () => {
    if (!isAdmin) return;
    setTipo(lead.tipo || '');
    setCampana(lead.campana || '');
    setEditando(true);
    setTimeout(() => refTipo.current?.focus(), 50);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await updateInfoLead(lead.id, { tipo: tipo || null, campana: campana || null });
      onGuardado?.();
    } catch (err) {
      console.error('Error al guardar tipo/campaña', err);
    } finally {
      setGuardando(false);
      setEditando(false);
    }
  };

  if (!isAdmin) {
    return (
      <>
        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{lead.tipo || 'General'}</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 2, fontSize: 11 }}>{lead.campana || 'S/C'}</div>
      </>
    );
  }

  if (editando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
        <input ref={refTipo} type="text" placeholder="Tipo" value={tipo}
          onChange={e => setTipo(e.target.value)} style={inputStyle} />
        <input type="text" placeholder="Campaña" value={campana}
          onChange={e => setCampana(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') setEditando(false); }}
          style={inputStyle} />
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={guardar} disabled={guardando} style={btnOk}>{guardando ? '...' : '✓'}</button>
          <button onClick={() => setEditando(false)} style={btnCancel}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={abrir} title="Editar tipo / campaña" style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{lead.tipo || 'General'}</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', opacity: 0.6 }}>✎</span>
      </div>
      <div style={{ color: 'var(--text-muted)', marginTop: 2, fontSize: 11 }}>{lead.campana || 'S/C'}</div>
    </div>
  );
}

function CeldaCanal({ lead, onGuardado, isAdmin }) {
  const [editando, setEditando] = useState(false);
  const [canal, setCanal] = useState('');
  const [guardando, setGuardando] = useState(false);
  const refInput = useRef();

  const abrir = () => {
    if (!isAdmin) return;
    setCanal(lead.canal || '');
    setEditando(true);
    setTimeout(() => refInput.current?.focus(), 50);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await updateInfoLead(lead.id, { tipo: lead.tipo || null, campana: lead.campana || null, canal: canal || null });
      onGuardado?.();
    } catch (err) {
      console.error('Error al guardar canal', err);
    } finally {
      setGuardando(false);
      setEditando(false);
    }
  };

  if (!isAdmin) {
    return <span style={{ color: 'var(--text-muted)' }}>{lead.canal || '—'}</span>;
  }

  if (editando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
        <input ref={refInput} type="text" placeholder="Canal" value={canal}
          onChange={e => setCanal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') setEditando(false); }}
          style={inputStyle} />
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={guardar} disabled={guardando} style={btnOk}>{guardando ? '...' : '✓'}</button>
          <button onClick={() => setEditando(false)} style={btnCancel}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={abrir} title="Editar canal"
      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
      <span>{lead.canal || '—'}</span>
      <span style={{ fontSize: 10, color: 'var(--text-dim)', opacity: 0.6 }}>✎</span>
    </div>
  );
}

function CeldaObservaciones({ lead, onGuardado, isAdmin }) {
  const [editando, setEditando] = useState(false);
  const [obs, setObs] = useState('');
  const [guardando, setGuardando] = useState(false);
  const refInput = useRef();

  const abrir = () => {
    if (!isAdmin) return;
    setObs(lead.observaciones || '');
    setEditando(true);
    setTimeout(() => refInput.current?.focus(), 50);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await updateInfoLead(lead.id, {
        tipo: lead.tipo || null,
        campana: lead.campana || null,
        canal: lead.canal || null,
        observaciones: obs || null,
      });
      onGuardado?.();
    } catch (err) {
      console.error('Error al guardar observación', err);
    } finally {
      setGuardando(false);
      setEditando(false);
    }
  };

  if (!lead.observaciones && !isAdmin) return null;

  if (editando) {
    return (
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <textarea ref={refInput} rows={2} placeholder="Observación..." value={obs}
          onChange={e => setObs(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setEditando(false); }}
          style={{ ...inputStyle, width: '100%', resize: 'vertical', minHeight: 48 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={guardar} disabled={guardando} style={btnOk}>{guardando ? '...' : '✓'}</button>
          <button onClick={() => setEditando(false)} style={btnCancel}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={isAdmin ? abrir : undefined}
      title={isAdmin ? 'Editar observación' : undefined}
      style={{
        marginTop: 6, padding: '5px 8px', borderRadius: 6,
        background: 'var(--color-yellow-bg)',
        borderLeft: '2px solid var(--warning)',
        fontSize: 11, color: 'var(--warning)', lineHeight: 1.4,
        cursor: isAdmin ? 'pointer' : 'default',
        display: 'flex', alignItems: 'flex-start', gap: 4,
      }}
    >
      <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {lead.observaciones || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Sin observación</span>}
      </span>
      {isAdmin && <span style={{ fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, flexShrink: 0 }}>✎</span>}
    </div>
  );
}

function formatFecha(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Lima'
  });
}

function isHorarioHabil() {
  const peruTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const day = peruTime.getDay();
  const t = peruTime.getHours() * 60 + peruTime.getMinutes();
  if (day === 0) return false;
  if (day === 6) return t >= 9 * 60 + 30 && t < 14 * 60;
  return t >= 9 * 60 + 30 && t < 18 * 60 + 30;
}

// Minutos hábiles reales entre fromTs y ahora.
// Si fromTs fue antes de las 9:30, el conteo empieza desde las 9:30, no desde fromTs.
function businessMinutesSince(fromTs) {
  if (!isHorarioHabil()) return 0;
  const toLima = t => new Date(new Date(t).toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const fromLima = toLima(fromTs);
  const nowLima  = toLima(Date.now());
  const BIZ_START = 9 * 60 + 30;
  const fromMin = fromLima.getHours() * 60 + fromLima.getMinutes() + fromLima.getSeconds() / 60;
  const nowMin  = nowLima.getHours()  * 60 + nowLima.getMinutes()  + nowLima.getSeconds()  / 60;
  return Math.max(0, nowMin - Math.max(fromMin, BIZ_START));
}

function getMinutosPrimeraRespuesta(lead, fetchedAt) {
  if (lead.ts_primera_respuesta) {
    if (lead.min_primera_respuesta != null) return lead.min_primera_respuesta;
    return null;
  }
  if (lead._socketAt != null) {
    return businessMinutesSince(lead._socketAt);
  }
  if (lead.min_esperando_respuesta != null) {
    return lead.min_esperando_respuesta + businessMinutesSince(fetchedAt);
  }
  return null;
}

const ESTADOS_CERRADOS = ['venta_efectiva', 'no_efectiva', 'negociacion_futuro'];

function getMinutosCotizacion(lead, fetchedAt) {
  if (lead.min_cotizacion != null && parseFloat(lead.min_cotizacion) > 0) return parseFloat(lead.min_cotizacion);
  if (ESTADOS_CERRADOS.includes(lead.estado)) {
    return lead.min_cotizacion_final != null ? parseFloat(lead.min_cotizacion_final) : null;
  }
  if (lead._cotizacionAt != null) {
    return isHorarioHabil() ? (Date.now() - lead._cotizacionAt) / 60000 : parseFloat(lead.min_esperando_cotizacion) || 0;
  }
  if (lead.min_esperando_cotizacion != null) {
    return parseFloat(lead.min_esperando_cotizacion) + businessMinutesSince(fetchedAt);
  }
  return null;
}

function getMinutosSoporte(lead, fetchedAt) {
  if (['venta_efectiva', 'no_efectiva', 'negociacion_futuro'].includes(lead.estado)) {
    return lead.min_soporte_final != null ? parseFloat(lead.min_soporte_final) : null;
  }
  if (lead.estado === 'cotizado_tecnico') {
    return lead.min_soporte_cotizacion != null ? parseFloat(lead.min_soporte_cotizacion) : null;
  }
  if (lead.estado !== 'derivado') return null;
  if (lead._derivadoAt != null) {
    return isHorarioHabil() ? (Date.now() - lead._derivadoAt) / 60000 : parseFloat(lead.min_esperando_soporte) || 0;
  }
  if (lead.min_esperando_soporte != null) {
    return parseFloat(lead.min_esperando_soporte) + businessMinutesSince(fetchedAt);
  }
  return null;
}

const thStyle = {
  padding: '10px 14px', textAlign: 'left',
  fontWeight: 700, fontSize: 9, letterSpacing: 0.7,
  textTransform: 'uppercase', color: 'var(--text-dim)',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg-card)',
};

const tdStyle = {
  padding: '12px 14px', fontSize: 12,
  color: 'var(--text-main)',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
};

export default function TablaLeads({ leads, fetchedAt = Date.now(), tecnicos = [], vendedores = [], onActualizar, onEliminar, isAdmin = false }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(k => k + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const headers = ['Cliente', 'Tipo · Campaña', 'Vendedor', 'Canal', 'Requerimiento', 'Estado',
    'Respuesta', 'Cotización', 'Soporte',
    ...(isAdmin ? ['Creado', 'Efectivo', '1ra Resp.', 'Cotiz.', 'Deriv.', ''] : [])];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map(h => <th key={h} style={thStyle}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 && (
            <tr>
              <td colSpan={headers.length} style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                No hay leads
              </td>
            </tr>
          )}
          {leads.map((lead) => (
            <tr key={lead.id} className="lead-row">
              <td style={tdStyle}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{lead.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{lead.celular}</div>
              </td>
              <td style={tdStyle}>
                <CeldaInfo lead={lead} onGuardado={onActualizar} isAdmin={isAdmin} />
              </td>
              <td style={tdStyle}>
                <div style={{ color: 'var(--text-main)' }}>{lead.vendedor_nombre || <span style={{ color: 'var(--text-dim)' }}>—</span>}</div>
                {isAdmin && <VendedorSelect lead={lead} vendedores={vendedores} />}
                {(lead.estado === 'derivado' || lead.estado === 'cotizado_tecnico' || (lead.tecnico_id && lead.ts_derivado)) && (
                  <TecnicoSelect lead={lead} tecnicos={tecnicos} isAdmin={isAdmin} />
                )}
              </td>
              <td style={tdStyle}>
                <CeldaCanal lead={lead} onGuardado={onActualizar} isAdmin={isAdmin} />
              </td>
              <td style={{ ...tdStyle, maxWidth: 220 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                  {lead.requerimiento || <span style={{ color: 'var(--text-dim)' }}>—</span>}
                </div>
                <CeldaObservaciones lead={lead} onGuardado={onActualizar} isAdmin={isAdmin} />
              </td>
              <td style={tdStyle}>
                <BadgeSelect lead={lead} isAdmin={isAdmin} onActualizar={onActualizar} />
              </td>
              <td style={tdStyle}>
                <Semaforo minutos={getMinutosPrimeraRespuesta(lead, fetchedAt)} meta={15} amarilloHasta={20} tipo="1ra resp." />
              </td>
              <td style={tdStyle}>
                <Semaforo minutos={getMinutosCotizacion(lead, fetchedAt)} meta={240} tipo="Cotización" />
              </td>
              <td style={tdStyle}>
                <Semaforo minutos={getMinutosSoporte(lead, fetchedAt)} meta={240} tipo="Soporte" />
              </td>
              {isAdmin && (
                <>
                  <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatFecha(lead.ts_lead_creado)}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11 }}>
                    <CeldaTiempo lead={lead} campo="ts_efectivo" label="Efectivo" onGuardado={onActualizar} isAdmin={isAdmin} />
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11 }}>
                    <CeldaTiempo lead={lead} campo="ts_primera_respuesta" label="1ra Respuesta" onGuardado={onActualizar} isAdmin={isAdmin} />
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11 }}>
                    <CeldaTiempo lead={lead} campo="ts_cotizacion_enviada" label="Cotización" onGuardado={onActualizar} isAdmin={isAdmin} />
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11 }}>
                    <CeldaTiempo lead={lead} campo="ts_derivado" label="Derivado" onGuardado={onActualizar} isAdmin={isAdmin} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      onClick={() => {
                        if (window.confirm(`¿Eliminar el lead de ${lead.nombre}? Esta acción no se puede deshacer.`)) {
                          deleteLead(lead.id)
                            .then(() => onEliminar?.(lead.id))
                            .catch(err => console.error('Error al eliminar', err));
                        }
                      }}
                      title="Eliminar lead"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 14, color: 'var(--text-dim)', padding: 4,
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                    >
                      🗑
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
