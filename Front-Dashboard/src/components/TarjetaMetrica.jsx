export default function TarjetaMetrica({
  titulo,
  valor,
  subtitulo,
  accentColor = 'var(--text-heavy)',
  icon,
  iconBg,
}) {
  const isImage =
    typeof icon === 'string' &&
    (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('/'));

  return (
    <div
      className="card"
      style={{
        padding: '14px 18px',
        flex: 1,
        minWidth: 140,
        borderTop: `4px solid ${accentColor}`,
        background: '#f4f6f8',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{
          fontSize: 10, color: 'var(--text-muted)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: 0.8, lineHeight: 1.4,
          flex: 1, paddingRight: 6,
        }}>
          {titulo}
        </div>
        {icon && (
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: iconBg || 'var(--bg-main)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isImage ? (
              <img src={icon} alt={titulo} style={{ width: 20, height: 20, objectFit: 'contain', display: 'block' }} />
            ) : (
              <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
            )}
          </div>
        )}
      </div>

      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)', margin: '2px 0 0' }}>
        {valor}
      </div>

      {subtitulo && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
          {subtitulo}
        </div>
      )}
    </div>
  );
}
