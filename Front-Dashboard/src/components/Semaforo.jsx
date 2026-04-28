export default function Semaforo({ minutos, meta, tipo, amarilloHasta }) {
  const getColor = () => {
    if (minutos === null || minutos === undefined) return null;
    if (minutos <= meta) return 'verde';
    if (minutos <= (amarilloHasta ?? meta * 2)) return 'amarillo';
    return 'rojo';
  };

  const getTexto = () => {
    const minVal = parseFloat(minutos);
    if (isNaN(minVal)) return '—';

    let totalSeconds = Math.floor(minVal * 60);
    if (totalSeconds <= 0) return '0s';

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    // Ocultar segundos una vez superada la meta
    const superado = meta != null && minVal >= meta;
    if (superado) {
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    }

    if (h > 0) return s > 0 ? `${h}h ${m}m ${s}s` : `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const color = getColor();

  const estilos = {
    verde:    { background: 'var(--color-green-bg)', color: 'var(--color-green)', border: '1px solid var(--color-green)' },
    amarillo: { background: 'var(--color-yellow-bg)', color: 'var(--color-yellow)', border: '1px solid var(--color-yellow)' },
    rojo:     { background: 'var(--color-red-bg)', color: 'var(--color-red)', border: '1px solid var(--color-red)' },
    null:     { background: 'var(--filter-bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
  };

  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column',
      alignItems: 'center', padding: '6px 14px',
      borderRadius: 8, fontSize: 13, fontWeight: 600,
      minWidth: 80, textAlign: 'center',
      ...estilos[color]
    }}>
      <span style={{ fontSize: 11, fontWeight: 400, marginBottom: 2 }}>{tipo}</span>
      <span>{getTexto()}</span>
    </div>
  );
}
