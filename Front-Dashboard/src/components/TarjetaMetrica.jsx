import { useState } from 'react';

export default function TarjetaMetrica({
  titulo,
  valor,
  subtitulo,
  accentColor = 'var(--accent)',
  icon,
  delta,
  deltaLabel,
}) {
  const [hov, setHov] = useState(false);
  const isImage =
    typeof icon === 'string' &&
    (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('/'));

  const hasDelta = typeof delta === 'number';
  const pos = hasDelta && delta > 0;
  const neg = hasDelta && delta < 0;

  return (
    <div
      className="kpi-card"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1,
        minWidth: 0,
        background: 'var(--bg-card)',
        borderRight: `1px solid ${hov ? accentColor + '44' : 'var(--border)'}`,
        borderBottom: `1px solid ${hov ? accentColor + '44' : 'var(--border)'}`,
        borderLeft: `1px solid ${hov ? accentColor + '44' : 'var(--border)'}`,
        borderTop: `4px solid ${accentColor}`,
        borderRadius: 8,
        padding: '12px 16px',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
        transition: 'all 0.2s ease',
        boxShadow: hov
          ? `0 6px 16px rgba(0,0,0,0.15), 0 0 0 1px ${accentColor}18`
          : 'var(--shadow-sm)',
      }}
    >
      {/* Glow blob fondo */}
      <div style={{
        position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%',
        background: accentColor, opacity: hov ? 0.1 : 0.04,
        filter: 'blur(20px)', transition: 'opacity 0.25s', pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{
          fontSize: 10, color: 'var(--text-muted)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: 0.6, lineHeight: 1.2,
        }}>
          {titulo}
        </div>
        {icon && (
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: accentColor + '15',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {isImage
              ? <img src={icon} alt={titulo} style={{ width: 14, height: 14, objectFit: 'contain' }} />
              : <span style={{ fontSize: 15, color: accentColor }}>{icon}</span>}
          </div>
        )}
      </div>

      <div style={{
        fontSize: 32, fontWeight: 800, color: 'var(--text-main)',
        letterSpacing: -1.2, lineHeight: 1, marginBottom: 6,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {valor}
      </div>

      {subtitulo && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: hasDelta ? 8 : 0 }}>
          {subtitulo}
        </div>
      )}

      {hasDelta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 11, fontWeight: 700,
            color: delta === 0 ? 'var(--text-dim)' : (pos ? 'var(--accent)' : 'var(--danger)'),
            background: delta === 0 ? 'transparent' : (pos ? 'var(--accent-glow)' : 'var(--danger-glow)'),
            padding: '2px 6px', borderRadius: 4,
          }}>
            {delta !== 0 && (
              <span style={{ fontSize: 9 }}>{pos ? '▲' : '▼'}</span>
            )}
            {Math.abs(delta)}%
          </span>
          {deltaLabel && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}
