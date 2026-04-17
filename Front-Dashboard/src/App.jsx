import { useState } from 'react';
import Gerencia from './pages/Gerencia';

const ADMIN_PASSWORD = 'comutel2024';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('isAdmin') === '1');
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('isAdmin', '1');
      setIsAdmin(true);
      setShowLogin(false);
      setPassword('');
      setError(false);
    } else {
      setError(true);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isAdmin');
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
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <form
            onSubmit={handleLogin}
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 14, padding: '36px 40px',
              display: 'flex', flexDirection: 'column', gap: 18, minWidth: 320,
              boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1e2a3b' }}>
              🔐 Acceso Administrador
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>
              Ingresa la contraseña para habilitar la edición.
            </div>
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false); }}
              autoFocus
              style={{
                padding: '11px 14px', borderRadius: 8, fontSize: 14,
                border: error ? '1.5px solid #E74C3C' : '1.5px solid #ddd',
                outline: 'none',
              }}
            />
            {error && (
              <div style={{ color: '#E74C3C', fontSize: 13, marginTop: -8 }}>
                Contraseña incorrecta
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  border: '1.5px solid #ddd', background: '#fff',
                  cursor: 'pointer', fontSize: 14, color: '#555',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  background: '#2f6fd4', color: '#fff',
                  cursor: 'pointer', fontSize: 14, fontWeight: 600,
                }}
              >
                Entrar
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
