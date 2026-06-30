/* Topbar.jsx — marca, conexión, reloj Perú, navegación, acciones admin, tema */
import { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';
import { usePeruClock } from '../hooks/useDashboard';

const FULL_LOGO_LIGHT = '/LOGO.png';
const FULL_LOGO_DARK = '/LOGO-BLANCO.png';

const ENLACES = [
  { href: 'http://192.168.1.51:5175', label: 'Vantio Planner', icon: 'https://comutelperu.com/correo-cm/Vantio/LOGO/VANTIO-BLANCO-SHORT.png' },
  { href: 'http://192.168.1.50', label: 'GLPI CM', icon: 'https://comutelperu.com/correo-cm/Iconos/10156352.png' },
  { href: 'https://store.comutelperu.com/web#cids=1&action=menu', label: 'Odoo', icon: 'https://comutelperu.com/correo-cm/Iconos/odoo.png' },
];

const TEST_AUDIO = [
  { tipo: 'nuevo_lead', label: 'Nuevo Lead', color: 'var(--st-atencion)' },
  { tipo: 'sla', label: 'Alerta SLA', color: 'var(--warn)' },
  { tipo: 'venta', label: 'Venta Efectiva', color: 'var(--ok)' },
  { tipo: 'inicio', label: 'Inicio de Jornada', color: 'var(--st-derivado)' },
  { tipo: 'fin', label: 'Fin de Jornada', color: 'var(--neutral)' },
];

function useOutside(ref, onClose, active) {
  useEffect(() => {
    if (!active) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose, active]);
}

function QuarterSelector() {
  const current = Math.floor(new Date().getMonth() / 3); // 0..3 según la fecha actual
  return (
    <div className="qseg" role="group" aria-label={`Trimestre actual: Q${current + 1}`}>
      {[0, 1, 2, 3].map(i => (
        <span key={i}
          className={'qseg__btn' + (i === current ? ' is-current' : '')}
          title={i === current ? 'Trimestre actual' : `Q${i + 1}`}>
          Q{i + 1}
        </span>
      ))}
    </div>
  );
}

export default function Topbar({
  theme, onToggleTheme,
  isAdmin, onAdminClick, onLogout,
  onToggleFilters, filtersOpen,
  onForceReload, onTestGlobal, onTestAlert, onShowVendedores,
  onFullscreen,
}) {
  const { time } = usePeruClock();
  const fullLogo = theme === 'dark' ? FULL_LOGO_DARK : FULL_LOGO_LIGHT;

  const [linksOpen, setLinksOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const linksRef = useRef(null);
  const testRef = useRef(null);
  useOutside(linksRef, () => setLinksOpen(false), linksOpen);
  useOutside(testRef, () => setTestOpen(false), testOpen);

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <button className={'iconbtn' + (filtersOpen ? ' is-active' : '')} onClick={onToggleFilters}
          aria-pressed={filtersOpen} title={filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}>
          <Icon name="menu" />
        </button>
        <span className="topbar__tag">Leads 2.0</span>
        <span className="topbar__divider" />
        <QuarterSelector />
      </div>

      <div className="topbar__spacer" />

      <div className="clock">
        <Icon name="clock" size={15} stroke={2.2} style={{ color: 'var(--ink-3)' }} />
        <span className="clock__time">{time}</span>
      </div>

      {isAdmin && (
        <div className="topbar__center" style={{ gap: 6 }}>
          <button className="btn btn--warn btn--sm" onClick={onTestAlert} title="Probar alertas y sonidos localmente">
            <Icon name="alert" size={15} /> <span className="btn__lbl">Probar</span>
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onForceReload} title="Forzar recarga en todos los clientes">
            <Icon name="refresh" size={15} /> <span className="btn__lbl">Recargar todos</span>
          </button>
          <div ref={testRef} style={{ position: 'relative' }}>
            <button className={'btn btn--sm ' + (testOpen ? 'btn--primary' : 'btn--ghost')}
              onClick={() => setTestOpen(o => !o)} title="Test de audio global (todos los clientes)">
              <Icon name="globe" size={15} /> <span className="btn__lbl">Test global</span>
            </button>
            {testOpen && (
              <div className="menu-pop">
                {TEST_AUDIO.map(({ tipo, label, color }) => (
                  <button key={tipo} className="menu-item" onClick={() => { onTestGlobal(tipo); setTestOpen(false); }}>
                    <span className="menu-item__dot" style={{ background: color }} />{label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="iconbtn" onClick={onShowVendedores} title="Gestionar vendedores">
            <Icon name="users" />
          </button>
        </div>
      )}

      <div ref={linksRef} style={{ position: 'relative' }}>
        <button className={'iconbtn' + (linksOpen ? ' is-active' : '')} onClick={() => setLinksOpen(o => !o)}
          title="Accesos externos">
          <Icon name="globe" />
        </button>
        {linksOpen && (
          <div className="menu-pop">
            {ENLACES.map(({ href, label, icon }) => (
              <a key={href} className="menu-item" href={href} target="_blank" rel="noreferrer" onClick={() => setLinksOpen(false)}>
                <img src={icon} alt={label} />{label}
              </a>
            ))}
          </div>
        )}
      </div>

      <button className="iconbtn" onClick={onToggleTheme} aria-label="Cambiar tema" title="Cambiar tema">
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>

      <button className="iconbtn" onClick={onFullscreen} aria-label="Pantalla completa" title="Pantalla completa">
        <Icon name="expand" />
      </button>

      <button className={isAdmin ? 'admin-pill' : 'iconbtn'} onClick={isAdmin ? onLogout : onAdminClick}
        aria-pressed={isAdmin} title={isAdmin ? 'Cerrar sesión admin' : 'Acceso administrador'}>
        <Icon name={isAdmin ? 'shield' : 'lock'} size={isAdmin ? 15 : 18} />
        {isAdmin && 'Admin'}
      </button>

      <img className="topbar__userlogo" src={fullLogo} alt="Comutel" />
    </header>
  );
}
