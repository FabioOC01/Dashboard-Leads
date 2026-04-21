import { useState, useCallback } from 'react';

let toastId = 0;

export function useToasts() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 30000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

const PALETTE = {
  success: { bar: '#10b981', glow: 'rgba(16,185,129,0.18)' },
  warning: { bar: '#f59e0b', glow: 'rgba(245,158,11,0.18)' },
  danger:  { bar: '#f43f5e', glow: 'rgba(244,63,94,0.18)'  },
  error:   { bar: '#f43f5e', glow: 'rgba(244,63,94,0.18)'  },
  info:    { bar: '#38bdf8', glow: 'rgba(56,189,248,0.18)' },
};

function Toast({ t, onRemove }) {
  const pal = PALETTE[t.type] || PALETTE.info;
  const isObj = t.message && typeof t.message === 'object';

  return (
    <div style={{
      background: '#0d1625',
      border: `1px solid ${pal.bar}44`,
      borderLeft: `3px solid ${pal.bar}`,
      borderRadius: 10,
      boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${pal.bar}18`,
      overflow: 'hidden',
      minWidth: 300, maxWidth: 380,
      animation: 'toastIn 0.28s cubic-bezier(.22,1,.36,1)',
      position: 'relative',
    }}>
      {/* Glow fondo */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at top left, ${pal.glow}, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ padding: '12px 14px', position: 'relative' }}>
        {isObj ? (
          <>
            {/* Título */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              marginBottom: 8,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: 0.8, color: pal.bar,
              }}>
                {t.message.title}
              </span>
              <button onClick={() => onRemove(t.id)} style={{
                background: 'rgba(255,255,255,0.08)', border: 'none',
                color: '#8b9cbf', borderRadius: 4, cursor: 'pointer',
                fontSize: 12, padding: '1px 6px', lineHeight: 1.4, flexShrink: 0,
              }}>✕</button>
            </div>

            {/* Vendedor destacado */}
            {t.message.vendor && (
              <div style={{
                fontSize: 20, fontWeight: 800, color: '#ffffff',
                letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 6,
                textShadow: `0 0 20px ${pal.bar}88`,
              }}>
                {t.message.vendor}
              </div>
            )}

            {/* Detalle */}
            {t.message.detail && (
              <div style={{ fontSize: 11, color: '#8b9cbf', lineHeight: 1.4 }}>
                {t.message.detail}
              </div>
            )}
          </>
        ) : (
          /* Mensaje simple (string) — backward compat */
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#eef2ff' }}>{t.message}</span>
            <button onClick={() => onRemove(t.id)} style={{
              background: 'rgba(255,255,255,0.08)', border: 'none',
              color: '#8b9cbf', borderRadius: 4, cursor: 'pointer',
              fontSize: 12, padding: '2px 7px', lineHeight: 1.4, flexShrink: 0,
            }}>✕</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(24px) scale(0.96); }
          to   { opacity: 1; transform: translateX(0)    scale(1); }
        }
      `}</style>
      <div style={{
        position: 'fixed', top: 16, right: 16,
        zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <Toast t={t} onRemove={onRemove} />
          </div>
        ))}
      </div>
    </>
  );
}
