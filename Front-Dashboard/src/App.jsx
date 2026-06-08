import { useState } from 'react';
import Gerencia from './pages/Gerencia';
import { loginAdmin } from './api/leads';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('isAdmin') === '1' && !!sessionStorage.getItem('adminToken'));
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token } = await loginAdmin(password);
      sessionStorage.setItem('adminToken', token);
      sessionStorage.setItem('isAdmin', '1');
      setIsAdmin(true);
      setShowLogin(false);
      setPassword('');
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isAdmin');
    sessionStorage.removeItem('adminToken');
    setIsAdmin(false);
  };

  const handleClose = () => {
    setShowLogin(false);
    setPassword('');
    setError(false);
  };

  return (
    <>
      <Gerencia
        isAdmin={isAdmin}
        onAdminClick={() => setShowLogin(true)}
        onLogout={handleLogout}
      />

      {showLogin && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(8,14,22,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <form
            onSubmit={handleLogin}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: '32px 36px',
              display: 'flex', flexDirection: 'column', gap: 16, minWidth: 340,
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
              Acceso administrador
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              Ingresa la contraseña para habilitar la edición.
            </div>
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false); }}
              autoFocus
              style={{
                padding: '11px 14px', borderRadius: 'var(--r-sm)', fontSize: 14,
                fontFamily: 'inherit', background: 'var(--surface-2)', color: 'var(--ink)',
                border: error ? '1.5px solid var(--danger)' : '1.5px solid var(--border-2)',
                outline: 'none',
              }}
            />
            {error && (
              <div style={{ color: 'var(--danger-ink)', fontSize: 13, marginTop: -8 }}>
                Contraseña incorrecta
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={handleClose} className="btn btn--ghost" style={{ flex: 1, justifyContent: 'center' }}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary" disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
                {loading ? 'Entrando…' : 'Entrar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
