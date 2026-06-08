/* SlaSemaphore.jsx — semáforo SLA (A tiempo / En riesgo / Vencido) */
import { Icon } from './Icon';

export default function SlaSemaphore({ aTiempo = 0, enRiesgo = 0, atrasados = 0 }) {
  const total = aTiempo + enRiesgo + atrasados;
  const pct = n => (total ? Math.round((n / total) * 100) : 0);
  const compliance = pct(aTiempo + enRiesgo);
  const strips = [
    { cls: 'ok', label: 'A tiempo', sub: 'dentro de meta', n: aTiempo, icon: 'check' },
    { cls: 'warn', label: 'En riesgo', sub: 'por vencer', n: enRiesgo, icon: 'hourglass' },
    { cls: 'danger', label: 'Vencido', sub: 'fuera de meta', n: atrasados, icon: 'flame' },
  ];

  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title"><Icon name="target" size={17} /> Semáforo SLA</span>
        <div className="card__tools"><span className="chip-mini">{total} activos</span></div>
      </div>
      <div className="card__body sla-body">
        <div className="sla-summary">
          <div className="sla-summary__metric">
            <span className="sla-summary__big">{compliance}<small>%</small></span>
            <span className="sla-summary__lbl">cumplimiento SLA</span>
          </div>
          <div className="sla-summary__bar" aria-hidden="true">
            <span style={{ width: pct(aTiempo) + '%', background: 'var(--ok)' }} />
            <span style={{ width: pct(enRiesgo) + '%', background: 'var(--warn)' }} />
            <span style={{ width: pct(atrasados) + '%', background: 'var(--danger)' }} />
          </div>
        </div>

        <div className="sla-strips">
          {strips.map(s => (
            <div className={'sla-strip sla-strip--' + s.cls} key={s.cls}>
              <span className="sla-strip__ic"><Icon name={s.icon} size={16} stroke={2.4} /></span>
              <div className="sla-strip__main">
                <span className="sla-strip__label">{s.label}</span>
                <span className="sla-strip__sub">{s.sub} · {pct(s.n)}% de leads</span>
              </div>
              <span className="sla-strip__val">{s.n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
