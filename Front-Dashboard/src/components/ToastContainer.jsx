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

export default function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  const bgColors = {
    success: 'linear-gradient(135deg, #059669, #10B981)',
    warning: 'linear-gradient(135deg, #D97706, #F59E0B)',
    danger:  'linear-gradient(135deg, #DC2626, #EF4444)',
    info:    'linear-gradient(135deg, #2563EB, #3B82F6)',
  };

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      right: 16,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      maxWidth: 420,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            background: bgColors[t.type] || bgColors.info,
            color: '#FFF',
            padding: '14px 20px',
            borderRadius: 10,
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            fontSize: 14,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            pointerEvents: 'auto',
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          <span>{t.message}</span>
          <button
            onClick={() => onRemove(t.id)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#FFF',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 16,
              padding: '2px 8px',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >✕</button>
        </div>
      ))}
    </div>
  );
}
