/* FilterSidebar.jsx — panel overlay de filtros (período, estado, vendedor, canal, tipo) */
import { Icon } from './Icon';
import { statusMeta, canalMeta } from '../utils/domain';

const FILTROS_FECHA = [
  { value: 'dia', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'mes_pasado', label: 'Mes pasado' },
  { value: 'todos', label: 'Histórico' },
];

export default function FilterSidebar({
  view, onSetView,
  filtroFecha, setFiltroFecha,
  filtroEstado, setFiltroEstado,
  filtroVendedor, setFiltroVendedor,
  filtroCanal, setFiltroCanal,
  filtroTipo, setFiltroTipo,
  estadosUnicos = [], tiposUnicos = [], vendedoresUnicos = [], canalesUnicos = [],
  estadoCounts = {}, activeCount = 0, onClear,
}) {
  const toggleEstado = (e) => setFiltroEstado(filtroEstado === e ? '' : e);
  const toggleCanal = (c) => setFiltroCanal(filtroCanal === c ? '' : c);

  return (
    <aside className="sidebar">
      <div className="fgroup">
        <span className="fgroup__label">Vista</span>
        <div className="seg">
          <button className={view === 'dashboard' ? 'is-active' : ''} onClick={() => onSetView('dashboard')}>
            <Icon name="layers" size={14} /> Dashboard
          </button>
          <button className={view === 'detalle' ? 'is-active' : ''} onClick={() => onSetView('detalle')}>
            <Icon name="filter" size={14} /> Detalle
          </button>
        </div>
      </div>

      <div className="filter-head">
        <span className="filter-head__title">
          <Icon name="filter" size={16} /> Filtros
          {activeCount > 0 && <span className="filter-head__count">{activeCount}</span>}
        </span>
        <button className="filter-clear" onClick={onClear}>Limpiar</button>
      </div>

      <div className="fgroup">
        <span className="fgroup__label">Período</span>
        <div className="seg">
          {FILTROS_FECHA.map(r => (
            <button key={r.value} className={filtroFecha === r.value ? 'is-active' : ''}
              onClick={() => setFiltroFecha(r.value)}>{r.label}</button>
          ))}
        </div>
      </div>

      <div className="fgroup">
        <span className="fgroup__label">Estado del lead</span>
        <div className="checklist">
          {estadosUnicos.map(e => {
            const s = statusMeta(e);
            const checked = filtroEstado === e;
            return (
              <label key={e} className="checkrow">
                <input type="checkbox" checked={checked} onChange={() => toggleEstado(e)} />
                <span className="checkrow__box"><Icon name="check" size={12} stroke={3} /></span>
                <span className="checkrow__dot" style={{ background: s.cvar }} />
                <span className="checkrow__txt">{s.label}</span>
                <span className="checkrow__n">{estadoCounts[e] ?? ''}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="fgroup">
        <span className="fgroup__label">Vendedor</span>
        <div className="field">
          <Icon name="user" size={15} />
          <select value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}>
            <option value="">Todos los vendedores</option>
            {vendedoresUnicos.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <Icon name="chevDown" size={15} />
        </div>
      </div>

      <div className="fgroup">
        <span className="fgroup__label">Canal</span>
        <div className="checklist">
          {canalesUnicos.map(c => {
            const meta = canalMeta(c);
            const checked = filtroCanal === c;
            return (
              <label key={c} className="checkrow">
                <input type="checkbox" checked={checked} onChange={() => toggleCanal(c)} />
                <span className="checkrow__box"><Icon name="check" size={12} stroke={3} /></span>
                {meta.icon
                  ? <img className="checkrow__ic" src={meta.icon} alt="" />
                  : <span className="checkrow__dot" style={{ background: meta.color }} />}
                <span className="checkrow__txt">{c}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="fgroup">
        <span className="fgroup__label">Tipo</span>
        <div className="field">
          <Icon name="layers" size={15} />
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {tiposUnicos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <Icon name="chevDown" size={15} />
        </div>
      </div>
    </aside>
  );
}
