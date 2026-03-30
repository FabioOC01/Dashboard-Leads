import Semaforo from './Semaforo';
import { updateEstadoLead } from '../api/leads';
import { useState, useEffect } from 'react';

const ESTADOS = {
  nuevo:              { label: 'Nuevo',          bg: '#D6EAF8', color: '#1B4F72' },
  en_atencion:        { label: 'En atención',    bg: '#FEF3C7', color: '#D97706' },
  cotizado:           { label: 'Cotizado',       bg: '#FDEBD0', color: '#E67E22' },
  venta_efectiva:     { label: 'Venta efectiva', bg: '#D5F5E3', color: '#27AE60' },
  negociacion_futuro: { label: 'Neg. a futuro',  bg: '#EAD7F7', color: '#8E44AD' },
  no_efectiva:        { label: 'No efectiva',    bg: '#FADBD8', color: '#E74C3C' },
};

function BadgeSelect({ lead }) {
  const cfg = ESTADOS[lead.estado] || { label: lead.estado, bg: '#eee', color: '#333' };

  const handleCambio = (e) => {
    const nuevoEstado = e.target.value;
    updateEstadoLead(lead.id, nuevoEstado).catch(err => console.error("Error al actualizar", err));
  };

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

function formatFecha(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

// Tiempo de espera de primera respuesta (minutos)
function getMinutosPrimeraRespuesta(lead, elapsed) {
  // ── YA ATENDIDO: valor fijo (no debe moverse) ──
  if (lead.ts_primera_respuesta) {
    // Mejor: valor calculado por la DB en business_minutes (sin problemas de timezone)
    if (lead.min_primera_respuesta != null) return lead.min_primera_respuesta;
    // Fallback para leads socket-actualizados sin min_primera_respuesta
    return null; // Semaforo mostrará '—'; se corregirá en la próxima recarga de API
  }
  // ── ESPERANDO PRIMERA RESPUESTA: timer en vivo ──
  // Lead llegó por socket: _socketAt es Date.now() del browser, sin problemas de timezone
  if (lead._socketAt != null) return (Date.now() - lead._socketAt) / 60000;
  // Lead cargado por API: min_esperando_respuesta ya tiene los minutos de negocio al momento
  // de la carga; elapsed son los minutos calendario desde entonces
  if (lead.min_esperando_respuesta != null) return lead.min_esperando_respuesta + elapsed;
  return null;
}

// Tiempo de espera de cotización (minutos)
function getMinutosCotizacion(lead, elapsed) {
  // Ya cotizado: valor fijo
  if (lead.min_cotizacion != null && lead.min_cotizacion > 0) return lead.min_cotizacion;
  // Cotización pendiente — timer en vivo
  if (lead.min_esperando_cotizacion != null) return lead.min_esperando_cotizacion + elapsed;
  // Fallback para leads socket con ts_primera_respuesta disponible
  if (lead.ts_primera_respuesta && !lead.ts_cotizacion_enviada) {
    return (Date.now() - new Date(String(lead.ts_primera_respuesta).replace(' ', 'T')).getTime()) / 60000;
  }
  return null;
}

export default function TablaLeads({ leads, fetchedAt }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(k => k + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Minutos calendario transcurridos desde la última carga de API
  // Crece con cada tick → hace avanzar min_esperando_* para leads de API
  const elapsed = (Date.now() - (fetchedAt || Date.now())) / 60000;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: 'var(--header-bg)', color: 'var(--header-text)' }}>
            {['Cliente', 'Tipo / Campaña', 'Vendedor', 'Canal', 'Requerimiento', 'Estado',
              'Respuesta', 'Cotización', 'Fecha'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500 }}>
                  {h}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 && (
            <tr>
              <td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#888' }}>
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
                <div style={{ fontWeight: 500, color: '#444' }}>{lead.tipo || 'General'}</div>
                <div style={{ color: '#888', marginTop: 2 }}>{lead.campana || 'S/C'}</div>
              </td>
              <td style={{ padding: '10px 14px' }}>{lead.vendedor_nombre || '—'}</td>
              <td style={{ padding: '10px 14px' }}>{lead.canal || '—'}</td>
              <td style={{ padding: '10px 14px', maxWidth: 200 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lead.requerimiento || '—'}
                </div>
              </td>
              <td style={{ padding: '10px 14px' }}>
                <BadgeSelect lead={lead} />
              </td>
              <td style={{ padding: '10px 14px' }}>
                <Semaforo
                  minutos={getMinutosPrimeraRespuesta(lead, elapsed)}
                  meta={15}
                  tipo="1ra resp."
                />
              </td>
              <td style={{ padding: '10px 14px' }}>
                <Semaforo
                  minutos={getMinutosCotizacion(lead, elapsed)}
                  meta={240}
                  tipo="Cotización"
                />
              </td>
              <td style={{ padding: '10px 14px', fontSize: 12, color: '#888' }}>
                {formatFecha(lead.ts_lead_creado)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
