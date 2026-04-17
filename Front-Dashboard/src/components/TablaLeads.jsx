import Semaforo from './Semaforo';
import { updateEstadoLead, updateTiemposLead, deleteLead, updateVendedorLead, updateInfoLead } from '../api/leads';
import { useState, useEffect, useRef } from 'react';

const ESTADOS = {
  nuevo:              { label: 'Nuevo',          bg: '#D6EAF8', color: '#1B4F72' },
  en_atencion:        { label: 'En atención',    bg: '#FEF3C7', color: '#D97706' },
  cotizado:           { label: 'Cotizado',       bg: '#FDEBD0', color: '#E67E22' },
  derivado:           { label: 'Derivado',       bg: '#D1ECF1', color: '#0C7A8B' },
  cotizado_tecnico:   { label: 'Cot. Técnico',   bg: '#E0F2FE', color: '#0369A1' },
  venta_efectiva:     { label: 'Venta efectiva', bg: '#D5F5E3', color: '#27AE60' },
  negociacion_futuro: { label: 'Neg. a futuro',  bg: '#EAD7F7', color: '#8E44AD' },
  no_efectiva:        { label: 'No efectiva',    bg: '#FADBD8', color: '#E74C3C' },
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
      style={{
        marginTop: 4, fontSize: 11, padding: '2px 6px',
        borderRadius: 6, border: '1px solid var(--border)',
        background: 'var(--bg-main)', color: 'var(--text-main)',
        cursor: 'pointer', width: '100%',
      }}
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
      style={{
        marginTop: 4, fontSize: 11, padding: '2px 6px',
        borderRadius: 6, border: '1px solid var(--border)',
        background: 'var(--bg-main)', color: 'var(--text-main)',
        cursor: 'pointer', width: '100%',
      }}
    >
      <option value="">Sin asignar</option>
      {tecnicos.map(t => (
        <option key={t.id} value={t.id}>{t.nombre}</option>
      ))}
    </select>
  );
}

function BadgeSelect({ lead, isAdmin, onActualizar }) {
  const cfg = ESTADOS[lead.estado] || { label: lead.estado, bg: '#eee', color: '#333' };

  const handleCambio = (e) => {
    const nuevoEstado = e.target.value;
    updateEstadoLead(lead.id, nuevoEstado)
      .then(() => onActualizar?.())
      .catch(err => console.error("Error al actualizar", err));
  };

  if (!isAdmin) {
    return (
      <div style={{
        background: cfg.bg, color: cfg.color, padding: '4px 8px',
        borderRadius: 20, fontSize: 12, fontWeight: 600,
        display: 'inline-block', textAlign: 'center',
      }}>
        {cfg.label}
      </div>
    );
  }

  return (
    <select
      value={lead.estado}
      onChange={handleCambio}
      style={{
        background: cfg.bg, color: cfg.color, padding: '4px 8px',
        borderRadius: 20, fontSize: 12, fontWeight: 600,
        border: 'none', outline: 'none', cursor: 'pointer', appearance: 'none',
        textAlign: 'center'
      }}
    >
      {Object.entries(ESTADOS).map(([val, config]) => (
        <option key={val} value={val} style={{ background: 'white', color: 'black' }}>{config.label}</option>
      ))}
    </select>
  );
}

// Convierte timestamp a valor para input datetime-local (Lima)
function tsToInput(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const lima = new Date(d.toLocaleString('en-US', { timeZone: 'America/Lima' }));
  return lima.toISOString().slice(0, 16);
}

// Convierte valor del input datetime-local a ISO string Lima (-05:00)
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

  const cancelar = () => setEditando(false);

  if (!isAdmin) {
    return (
      <div style={{ color: lead[campo] ? 'var(--text-main)' : '#bbb' }}>
        {lead[campo] ? formatFecha(lead[campo]) : '—'}
      </div>
    );
  }

  if (editando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 170 }}>
        <div style={{ fontSize: 10, color: '#888', marginBottom: 1 }}>{label}</div>
        <input
          ref={inputRef}
          type="datetime-local"
          value={valor}
          onChange={e => setValor(e.target.value)}
          style={{
            fontSize: 11, padding: '3px 6px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--bg-main)',
            color: 'var(--text-main)',
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={guardar}
            disabled={guardando}
            style={{
              flex: 1, fontSize: 11, padding: '2px 0', borderRadius: 6,
              border: 'none', background: '#27AE60', color: 'white', cursor: 'pointer',
            }}
          >
            {guardando ? '...' : '✓'}
          </button>
          <button
            onClick={cancelar}
            style={{
              flex: 1, fontSize: 11, padding: '2px 0', borderRadius: 6,
              border: 'none', background: '#E74C3C', color: 'white', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={abrir}
      title={`Editar ${label}`}
      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
    >
      <span>{lead[campo] ? formatFecha(lead[campo]) : <span style={{ color: '#bbb' }}>—</span>}</span>
      <span style={{ fontSize: 10, color: '#bbb', opacity: 0.6 }}>✎</span>
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
        <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>{lead.tipo || 'General'}</div>
        <div style={{ color: '#888', marginTop: 2, fontSize: 12 }}>{lead.campana || 'S/C'}</div>
      </>
    );
  }

  if (editando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
        <input
          ref={refTipo}
          type="text"
          placeholder="Tipo"
          value={tipo}
          onChange={e => setTipo(e.target.value)}
          style={{
            fontSize: 11, padding: '3px 6px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--bg-main)',
            color: 'var(--text-main)',
          }}
        />
        <input
          type="text"
          placeholder="Campaña"
          value={campana}
          onChange={e => setCampana(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') setEditando(false); }}
          style={{
            fontSize: 11, padding: '3px 6px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--bg-main)',
            color: 'var(--text-main)',
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={guardar} disabled={guardando} style={{ flex: 1, fontSize: 11, padding: '2px 0', borderRadius: 6, border: 'none', background: '#27AE60', color: 'white', cursor: 'pointer' }}>
            {guardando ? '...' : '✓'}
          </button>
          <button onClick={() => setEditando(false)} style={{ flex: 1, fontSize: 11, padding: '2px 0', borderRadius: 6, border: 'none', background: '#E74C3C', color: 'white', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={abrir} title="Editar tipo / campaña" style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{lead.tipo || 'General'}</span>
        <span style={{ fontSize: 10, color: '#bbb', opacity: 0.6 }}>✎</span>
      </div>
      <div style={{ color: '#888', marginTop: 2, fontSize: 12 }}>{lead.campana || 'S/C'}</div>
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
    return <span>{lead.canal || '—'}</span>;
  }

  if (editando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
        <input
          ref={refInput}
          type="text"
          placeholder="Canal"
          value={canal}
          onChange={e => setCanal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') setEditando(false); }}
          style={{
            fontSize: 11, padding: '3px 6px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--bg-main)',
            color: 'var(--text-main)',
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={guardar} disabled={guardando} style={{ flex: 1, fontSize: 11, padding: '2px 0', borderRadius: 6, border: 'none', background: '#27AE60', color: 'white', cursor: 'pointer' }}>
            {guardando ? '...' : '✓'}
          </button>
          <button onClick={() => setEditando(false)} style={{ flex: 1, fontSize: 11, padding: '2px 0', borderRadius: 6, border: 'none', background: '#E74C3C', color: 'white', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={abrir} title="Editar canal" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
      <span>{lead.canal || '—'}</span>
      <span style={{ fontSize: 10, color: '#bbb', opacity: 0.6 }}>✎</span>
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
        <textarea
          ref={refInput}
          rows={2}
          placeholder="Observación..."
          value={obs}
          onChange={e => setObs(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setEditando(false); }}
          style={{
            fontSize: 11, padding: '4px 6px', borderRadius: 6, width: '100%',
            border: '1px solid var(--border)', background: 'var(--bg-main)',
            color: 'var(--text-main)', resize: 'vertical', minHeight: 48,
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={guardar} disabled={guardando} style={{ flex: 1, fontSize: 11, padding: '2px 0', borderRadius: 6, border: 'none', background: '#27AE60', color: 'white', cursor: 'pointer' }}>
            {guardando ? '...' : '✓'}
          </button>
          <button onClick={() => setEditando(false)} style={{ flex: 1, fontSize: 11, padding: '2px 0', borderRadius: 6, border: 'none', background: '#E74C3C', color: 'white', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={isAdmin ? abrir : undefined}
      title={isAdmin ? 'Editar observación' : undefined}
      style={{
        marginTop: 6, padding: '4px 6px', borderRadius: 6,
        background: '#FEF9C3', borderLeft: '3px solid #F59E0B',
        fontSize: 11, color: '#92400E', lineHeight: 1.4,
        cursor: isAdmin ? 'pointer' : 'default',
        display: 'flex', alignItems: 'flex-start', gap: 4,
      }}
    >
      <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {lead.observaciones || <span style={{ color: '#bbb', fontStyle: 'italic' }}>Sin observación</span>}
      </span>
      {isAdmin && <span style={{ fontSize: 10, color: '#bbb', opacity: 0.6, flexShrink: 0 }}>✎</span>}
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

// Devuelve true si ahora mismo estamos en horario hábil (hora Peru)
function isHorarioHabil() {
  const peruTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const day = peruTime.getDay(); // 0=Dom, 6=Sáb
  const t = peruTime.getHours() * 60 + peruTime.getMinutes();
  if (day === 0) return false;
  if (day === 6) return t >= 9 * 60 + 30 && t < 14 * 60;
  return t >= 9 * 60 + 30 && t < 18 * 60 + 30;
}

function getMinutosPrimeraRespuesta(lead, fetchedAt) {
  if (lead.ts_primera_respuesta) {
    if (lead.min_primera_respuesta != null) return lead.min_primera_respuesta;
    return null;
  }
  if (lead._socketAt != null) {
    return isHorarioHabil() ? (Date.now() - lead._socketAt) / 60000 : 0;
  }
  if (lead.min_esperando_respuesta != null) {
    const elapsed = isHorarioHabil() ? (Date.now() - fetchedAt) / 60000 : 0;
    return lead.min_esperando_respuesta + elapsed;
  }
  return null;
}

const ESTADOS_CERRADOS = ['venta_efectiva', 'no_efectiva', 'negociacion_futuro'];

function getMinutosCotizacion(lead, fetchedAt) {
  if (lead.min_cotizacion != null && parseFloat(lead.min_cotizacion) > 0) return parseFloat(lead.min_cotizacion);
  // Lead cerrado sin cotización enviada: mostrar tiempo final fijo
  if (ESTADOS_CERRADOS.includes(lead.estado)) {
    return lead.min_cotizacion_final != null ? parseFloat(lead.min_cotizacion_final) : null;
  }
  if (lead._cotizacionAt != null) {
    return isHorarioHabil() ? (Date.now() - lead._cotizacionAt) / 60000 : parseFloat(lead.min_esperando_cotizacion) || 0;
  }
  if (lead.min_esperando_cotizacion != null) {
    const elapsed = isHorarioHabil() ? (Date.now() - fetchedAt) / 60000 : 0;
    return parseFloat(lead.min_esperando_cotizacion) + elapsed;
  }
  return null;
}

function getMinutosSoporte(lead, fetchedAt) {
  // Lead cerrado tras soporte: mostrar tiempo total
  if (['venta_efectiva', 'no_efectiva', 'negociacion_futuro'].includes(lead.estado)) {
    return lead.min_soporte_final != null ? parseFloat(lead.min_soporte_final) : null;
  }
  // Técnico ya mandó cotización: mostrar tiempo derivado→cotizacion_tecnico
  if (lead.estado === 'cotizado_tecnico') {
    return lead.min_soporte_cotizacion != null ? parseFloat(lead.min_soporte_cotizacion) : null;
  }
  // Lead en espera de soporte activo
  if (lead.estado !== 'derivado') return null;
  if (lead._derivadoAt != null) {
    return isHorarioHabil() ? (Date.now() - lead._derivadoAt) / 60000 : parseFloat(lead.min_esperando_soporte) || 0;
  }
  if (lead.min_esperando_soporte != null) {
    const elapsed = isHorarioHabil() ? (Date.now() - fetchedAt) / 60000 : 0;
    return parseFloat(lead.min_esperando_soporte) + elapsed;
  }
  return null;
}

export default function TablaLeads({ leads, fetchedAt = Date.now(), tecnicos = [], vendedores = [], onActualizar, onEliminar, isAdmin = false }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(k => k + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: 'var(--header-bg)', color: 'var(--header-text)' }}>
            {['Cliente', 'Tipo · Campaña', 'Vendedor', 'Canal', 'Requerimiento', 'Estado',
              'Respuesta', 'Cotización', 'Soporte',
              ...(isAdmin ? ['Creado', 'Efectivo', '1ra Resp.', 'Cotiz.', 'Deriv.', ''] : [])].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500 }}>
                  {h}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 && (
            <tr>
              <td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#888' }}>
                No hay leads
              </td>
            </tr>
          )}
          {leads.map((lead, i) => (
            <tr key={lead.id} style={{
              background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-main)',
              borderBottom: '1px solid var(--border)'
            }}>
              <td style={{ padding: '10px 14px' }}>
                <div style={{ fontWeight: 600 }}>{lead.nombre}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{lead.celular}</div>
              </td>
              <td style={{ padding: '10px 14px', fontSize: 13 }}>
                <CeldaInfo lead={lead} onGuardado={onActualizar} isAdmin={isAdmin} />
              </td>
              <td style={{ padding: '10px 14px' }}>
                <div>{lead.vendedor_nombre || '—'}</div>
                {isAdmin && (
                  <VendedorSelect lead={lead} vendedores={vendedores} />
                )}
                {(lead.estado === 'derivado' || lead.estado === 'cotizado_tecnico' || (lead.tecnico_id && lead.ts_derivado)) && (
                  <TecnicoSelect lead={lead} tecnicos={tecnicos} isAdmin={isAdmin} />
                )}
              </td>
              <td style={{ padding: '10px 14px' }}>
                <CeldaCanal lead={lead} onGuardado={onActualizar} isAdmin={isAdmin} />
              </td>
              <td style={{ padding: '10px 14px', maxWidth: 220 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lead.requerimiento || '—'}
                </div>
                <CeldaObservaciones lead={lead} onGuardado={onActualizar} isAdmin={isAdmin} />
              </td>
              <td style={{ padding: '10px 14px' }}>
                <BadgeSelect lead={lead} isAdmin={isAdmin} onActualizar={onActualizar} />
              </td>
              <td style={{ padding: '10px 14px' }}>
                <Semaforo
                  minutos={getMinutosPrimeraRespuesta(lead, fetchedAt)}
                  meta={15}
                  tipo="1ra resp."
                />
              </td>
              <td style={{ padding: '10px 14px' }}>
                <Semaforo
                  minutos={getMinutosCotizacion(lead, fetchedAt)}
                  meta={240}
                  tipo="Cotización"
                />
              </td>
              <td style={{ padding: '10px 14px' }}>
                <Semaforo
                  minutos={getMinutosSoporte(lead, fetchedAt)}
                  meta={240}
                  tipo="Soporte"
                />
              </td>
              {isAdmin && (
                <>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#888' }}>
                    {formatFecha(lead.ts_lead_creado)}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>
                    <CeldaTiempo lead={lead} campo="ts_efectivo" label="Efectivo" onGuardado={onActualizar} isAdmin={isAdmin} />
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>
                    <CeldaTiempo lead={lead} campo="ts_primera_respuesta" label="1ra Respuesta" onGuardado={onActualizar} isAdmin={isAdmin} />
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>
                    <CeldaTiempo lead={lead} campo="ts_cotizacion_enviada" label="Cotización" onGuardado={onActualizar} isAdmin={isAdmin} />
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>
                    <CeldaTiempo lead={lead} campo="ts_derivado" label="Derivado" onGuardado={onActualizar} isAdmin={isAdmin} />
                  </td>
                </>
              )}
              {isAdmin && (
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
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
                      fontSize: 16, opacity: 0.5, padding: 4,
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                  >
                    🗑️
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
