import { useState, useCallback } from 'react';
import { Icon } from './Icon';

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
  success: { c: 'var(--ok)',      bg: 'var(--ok-bg)',      ink: 'var(--ok-ink)',     icon: 'check2' },
  warning: { c: 'var(--warn)',    bg: 'var(--warn-bg)',    ink: 'var(--warn-ink)',   icon: 'alert' },
  danger:  { c: 'var(--danger)',  bg: 'var(--danger-bg)',  ink: 'var(--danger-ink)', icon: 'flame' },
  error:   { c: 'var(--danger)',  bg: 'var(--danger-bg)',  ink: 'var(--danger-ink)', icon: 'alert' },
  info:    { c: 'var(--primary)', bg: 'var(--primary-tint)', ink: 'var(--primary)',  icon: 'refresh' },
};

function Toast({ t, onRemove }) {
  const pal = PALETTE[t.type] || PALETTE.info;
  const isObj = t.message && typeof t.message === 'object';
  const title = isObj ? t.message.title : t.message;
  const msg = isObj
    ? [t.message.vendor, t.message.detail].filter(Boolean).join(' · ')
    : null;

  return (
    <div className="toast" style={{ '--toast-c': pal.c, '--toast-bg': pal.bg }}>
      <span className="toast__ic"><Icon name={pal.icon} size={18} /></span>
      <div className="toast__body">
        <div className="toast__title">{title}</div>
        {msg && <div className="toast__msg">{msg}</div>}
      </div>
      <button className="toast__close" onClick={() => onRemove(t.id)} aria-label="Cerrar">
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toasts">
      {toasts.map(t => <Toast key={t.id} t={t} onRemove={onRemove} />)}
    </div>
  );
}
