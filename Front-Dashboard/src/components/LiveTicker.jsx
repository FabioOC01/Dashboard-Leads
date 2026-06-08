/* LiveTicker.jsx — feed horizontal de actividad en tiempo real */
import { Icon } from './Icon';

function tickIcon(type) {
  const map = {
    nuevo:    { ic: 'layers',    c: 'var(--st-nuevo)',     bg: 'color-mix(in srgb, var(--st-nuevo) 16%, transparent)' },
    atencion: { ic: 'phone',     c: 'var(--st-atencion)',  bg: 'color-mix(in srgb, var(--st-atencion) 14%, transparent)' },
    cotizado: { ic: 'mail',      c: 'var(--st-cotizado)',  bg: 'color-mix(in srgb, var(--st-cotizado) 14%, transparent)' },
    derivado: { ic: 'wrench',    c: 'var(--st-derivado)',  bg: 'color-mix(in srgb, var(--st-derivado) 14%, transparent)' },
    venta:    { ic: 'check2',    c: 'var(--st-venta)',     bg: 'var(--ok-bg)' },
    sla:      { ic: 'hourglass', c: 'var(--warn)',         bg: 'var(--warn-bg)' },
    breach:   { ic: 'flame',     c: 'var(--danger)',       bg: 'var(--danger-bg)' },
  };
  return map[type] || map.nuevo;
}

export default function LiveTicker({ items, conectado = true, enHorarioHabil = true }) {
  if (!items || items.length === 0) return null;
  const loop = [...items, ...items];
  const state = !conectado ? 'off' : (enHorarioHabil ? 'live' : 'paused');
  const tagLabel = state === 'off' ? 'Reconectando…' : (state === 'live' ? 'En vivo' : 'Fuera de horario');
  return (
    <div className="ticker" role="log" aria-label="Actividad en tiempo real">
      <div className={'ticker__tag ticker__tag--' + state}><span className="ticker__live" /> {tagLabel}</div>
      <div className="ticker__viewport">
        <div className="ticker__track">
          {loop.map((it, i) => {
            const m = tickIcon(it.type);
            return (
              <span className="tick" key={i}>
                <span className="tick__ic" style={{ background: m.bg, color: m.c }}><Icon name={m.ic} size={13} /></span>
                <span>{it.pre}<b>{it.strong}</b>{it.post}</span>
                <span className="tick__time">{it.t}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
