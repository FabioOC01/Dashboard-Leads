import Semaforo from './Semaforo';
import { useState, useEffect } from 'react';

const ESTADO_CFG = {
  nuevo:       { label: 'Nuevo',       bg: '#D6EAF8', color: '#1B4F72' },
  en_atencion: { label: 'En atención', bg: '#FEF3C7', color: '#D97706' },
  cotizado:    { label: 'Cotizado',    bg: '#FDEBD0', color: '#E67E22' },
  derivado:          { label: 'Derivado',     bg: '#D1ECF1', color: '#0C7A8B' },
  cotizado_tecnico:  { label: 'Cot. Técnico', bg: '#E0F2FE', color: '#0369A1' },
};

function isHorarioHabil() {
  const t = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const day = t.getDay();
  const min = t.getHours() * 60 + t.getMinutes();
  if (day === 0) return false;
  if (day === 6) return min >= 9 * 60 + 30 && min < 14 * 60;
  return min >= 9 * 60 + 30 && min < 18 * 60 + 30;
}

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
    if (lead.min_primera_respuesta != null) return parseFloat(lead.min_primera_respuesta);
    return null;
  }
  if (lead._socketAt != null) return businessMinutesSince(lead._socketAt);
  if (lead.min_esperando_respuesta != null)
    return parseFloat(lead.min_esperando_respuesta) + businessMinutesSince(fetchedAt);
  return null;
}

const ESTADOS_CERRADOS = ['venta_efectiva', 'no_efectiva', 'negociacion_futuro'];

function getMinutosCotizacion(lead, fetchedAt) {
  if (lead.min_cotizacion != null && parseFloat(lead.min_cotizacion) > 0) return parseFloat(lead.min_cotizacion);
  if (ESTADOS_CERRADOS.includes(lead.estado))
    return lead.min_cotizacion_final != null ? parseFloat(lead.min_cotizacion_final) : null;
  if (lead._cotizacionAt != null) return businessMinutesSince(lead._cotizacionAt);
  if (lead.min_esperando_cotizacion != null)
    return parseFloat(lead.min_esperando_cotizacion) + businessMinutesSince(fetchedAt);
  return null;
}

function getMinutosSoporte(lead, fetchedAt) {
  if (['venta_efectiva', 'no_efectiva', 'negociacion_futuro'].includes(lead.estado))
    return lead.min_soporte_final != null ? parseFloat(lead.min_soporte_final) : null;
  if (lead.estado === 'cotizado_tecnico')
    return lead.min_soporte_cotizacion != null ? parseFloat(lead.min_soporte_cotizacion) : null;
  if (lead.estado !== 'derivado') return null;
  if (lead._derivadoAt != null) return businessMinutesSince(lead._derivadoAt);
  if (lead.min_esperando_soporte != null)
    return parseFloat(lead.min_esperando_soporte) + businessMinutesSince(fetchedAt);
  return null;
}

export default function TablaResumen({ leads, fetchedAt = Date.now() }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(k => k + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '35%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '20%' }} />
        </colgroup>
        <thead>
          <tr style={{ background: 'var(--header-bg)', color: 'var(--header-text)' }}>
            {['Vendedor', 'Estado', '1ra Resp.', 'Cotiz.'].map(h => (
              <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 500 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: 10, textAlign: 'center', color: '#888' }}>
                No hay leads activos
              </td>
            </tr>
          )}
          {leads.map((lead, i) => {
            const cfg = ESTADO_CFG[lead.estado];
            return (
              <tr key={lead.id} style={{
                background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-main)',
                borderBottom: '1px solid var(--border)'
              }}>
                <td style={{ padding: '4px 8px', fontWeight: 500 }}>{lead.vendedor_nombre || '—'}</td>
                <td style={{ padding: '4px 8px' }}>
                  <span style={{
                    background: cfg?.bg ?? '#eee',
                    color: cfg?.color ?? '#333',
                    padding: '1px 6px', borderRadius: 10,
                    fontSize: 10, fontWeight: 700,
                    display: 'inline-block', maxWidth: '100%',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {cfg?.label ?? lead.estado ?? '?'}
                  </span>
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <Semaforo minutos={getMinutosPrimeraRespuesta(lead, fetchedAt)} meta={15} tipo="1ra resp." />
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <Semaforo minutos={getMinutosCotizacion(lead, fetchedAt)} meta={240} tipo="Cotización" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
