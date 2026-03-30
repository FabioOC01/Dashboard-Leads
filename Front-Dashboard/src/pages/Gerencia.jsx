import { useEffect, useState, useCallback, useRef } from 'react';
import { getLeads, getMetricas } from '../api/leads';
import { useSocket } from '../hooks/useSocket';
import TarjetaMetrica from '../components/TarjetaMetrica';
import TablaLeads from '../components/TablaLeads';
import DashboardTecnicos from '../components/DashboardTecnicos';
import GraficoTiempo from '../components/GraficoTiempo';
import GraficoBarrasTop from '../components/GraficoBarrasTop';
import GraficoSLA from '../components/GraficoSLA';
import GraficoEstados from '../components/GraficoEstados';
import ToastContainer, { useToasts } from '../components/ToastContainer';
import { playNuevoLead, playAlertaSLA } from '../utils/sounds';

const MoonIcon = () => <span style={{ fontSize: 20 }}>☾</span>;
const SunIcon = () => <span style={{ fontSize: 20 }}>☀</span>;

function FilterGroup({ label, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 20 }}>
      <button className="filter-group-header" onClick={() => setOpen(o => !o)}
        style={{ marginBottom: open ? 10 : 0 }}>
        <span className="filter-group-label">{label}</span>
        <span className="filter-group-arrow"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {children}
        </div>
      )}
    </div>
  );
}

const SLA_RESPUESTA = 15; // minutos
const SLA_COTIZACION = 240; // minutos (4 horas)
const SLA_ALERTA_ANTES = 5; // alertar X minutos antes

const FILTROS_FECHA = [
  { value: 'dia', label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mes' },
  { value: 'todos', label: 'Histórico' },
];

export default function Gerencia() {
  const [leads, setLeads] = useState([]);
  const [metricas, setMetricas] = useState([]);
  const [filtroFecha, setFiltroFecha] = useState('mes');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [ultimaActualizacion, setUltima] = useState(new Date());
  const { ultimoEvento, conectado } = useSocket();
  const [theme, setTheme] = useState('light');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroVendedor, setFiltroVendedor] = useState('');
  const [filtroCanal, setFiltroCanal] = useState('');
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const { toasts, addToast, removeToast } = useToasts();
  const alertedLeads = useRef(new Set());

  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'detalle'
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error("Error fullscreen", err));
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  // Inicialización de Tema
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const cargarDatos = useCallback(async () => {
    const now = new Date();
    const desde = {
      dia:    now.toISOString().split('T')[0],
      semana: new Date(now - 7 * 864e5).toISOString().split('T')[0],
      mes:    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      todos:  null,
    }[filtroFecha] ?? null;

    setIsLoading(true);
    try {
      const [l, m] = await Promise.all([getLeads(desde), getMetricas()]);
      setLeads(l);
      setMetricas(m);
      setFetchedAt(Date.now());
      setUltima(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [filtroFecha]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // Actualizar estado localmente cuando llega evento de Socket
  useEffect(() => {
    if (!ultimoEvento) return;
    const { tipo, data } = ultimoEvento;
    setLeads(prev => {
      const needsTimerRef = !data.ts_primera_respuesta;
      const dataEnriquecida = {
        ...data,
        ...(needsTimerRef ? {
          min_esperando_respuesta: data.min_esperando_respuesta ?? 0,
          _socketAt: Date.now(),
        } : {}),
      };

      if (tipo === 'nuevo') {
        const existe = prev.find(l => l.id === dataEnriquecida.id);
        if (existe) return prev;
        return [dataEnriquecida, ...prev].sort((a, b) => new Date(b.ts_lead_creado) - new Date(a.ts_lead_creado));
      } else {
        return prev.map(l => l.id === dataEnriquecida.id ? { ...l, ...dataEnriquecida } : l);
      }
    });
    getMetricas().then(setMetricas).catch(() => { });
    setUltima(new Date());

    // Toast para nuevo lead
    if (tipo === 'nuevo') {
      playNuevoLead();
      addToast(`🟢 Nuevo lead: ${data.nombre || 'Sin nombre'} — Asesor: ${data.vendedor_nombre || data.asesor_asignado || 'Sin asignar'}`, 'success');
    }
  }, [ultimoEvento]);

  // ── Alerta SLA por vencer (cada 30s) ──
  useEffect(() => {
    const check = () => {
      const elapsed = (Date.now() - fetchedAt) / 60000;
      leads.forEach(l => {
        const key = `${l.id}-resp`;
        const keyCot = `${l.id}-cot`;

        // SLA Primera Respuesta
        if (l.estado === 'nuevo' && !alertedLeads.current.has(key)) {
          const leadElapsed = l._socketAt != null ? (Date.now() - l._socketAt) / 60000 : elapsed;
          let t = 0;
          if (l.min_esperando_respuesta != null) t = l.min_esperando_respuesta + leadElapsed;
          else {
            const ref = new Date(String(l.ts_efectivo || l.ts_lead_creado).replace(' ', 'T'));
            t = isNaN(ref.getTime()) ? 0 : (Date.now() - ref.getTime()) / 60000;
          }
          if (t >= SLA_RESPUESTA - SLA_ALERTA_ANTES && t < SLA_RESPUESTA) {
            alertedLeads.current.add(key);
            playAlertaSLA();
            addToast(`⚠️ SLA por vencer: ${l.nombre} — 1ra Respuesta — Quedan ${Math.ceil(SLA_RESPUESTA - t)} min`, 'warning');
          }
        }

        // SLA Cotización
        if (l.estado === 'en_atencion' && !alertedLeads.current.has(keyCot)) {
          const leadElapsed = l._socketAt != null ? (Date.now() - l._socketAt) / 60000 : elapsed;
          let t = 0;
          if (l.min_esperando_cotizacion != null) t = l.min_esperando_cotizacion + leadElapsed;
          else if (l.ts_primera_respuesta) {
            const ref = new Date(String(l.ts_primera_respuesta).replace(' ', 'T'));
            t = isNaN(ref.getTime()) ? 0 : (Date.now() - ref.getTime()) / 60000;
          }
          if (t >= SLA_COTIZACION - SLA_ALERTA_ANTES && t < SLA_COTIZACION) {
            alertedLeads.current.add(keyCot);
            playAlertaSLA();
            addToast(`⚠️ SLA por vencer: ${l.nombre} — Cotización — Quedan ${Math.ceil(SLA_COTIZACION - t)} min`, 'danger');
          }
        }
      });
    };
    const iv = setInterval(check, 30000);
    check(); // ejecutar inmediatamente
    return () => clearInterval(iv);
  }, [leads, fetchedAt, addToast]);

  const tiposUnicos = Array.from(new Set(leads.map(l => l.tipo || 'General')));
  const estadosUnicos = Array.from(new Set(leads.map(l => l.estado || 'nuevo')));
  const vendedoresUnicos = Array.from(new Set(leads.filter(l => l.vendedor_nombre).map(l => l.vendedor_nombre)));
  const canalesUnicos = Array.from(new Set(leads.filter(l => l.canal).map(l => l.canal)));

  const ESTADO_LABELS = {
    nuevo: 'Nuevo', en_atencion: 'En atención', cotizado: 'Cotizado',
    venta_efectiva: 'Venta efectiva', negociacion_futuro: 'Neg. a futuro', no_efectiva: 'No efectiva'
  };

  // Cálculos y Filtros Principales
  const now = new Date();
  const leadsFiltrados = leads.filter(l => {
    const tipoReal = l.tipo || 'General';
    if (filtroTipo !== '' && tipoReal !== filtroTipo) return false;
    if (filtroEstado !== '' && l.estado !== filtroEstado) return false;
    if (filtroVendedor !== '' && l.vendedor_nombre !== filtroVendedor) return false;
    if (filtroCanal !== '' && l.canal !== filtroCanal) return false;

    if (!l.ts_lead_creado) return true;
    const d = new Date(l.ts_lead_creado);
    if (filtroFecha === 'dia') return d.toDateString() === now.toDateString();
    if (filtroFecha === 'semana') return (now - d) / (24 * 60 * 60 * 1000) <= 7;
    if (filtroFecha === 'mes') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  });

  const activos = leadsFiltrados.filter(l => l.estado === 'nuevo').length;

  // Offset en minutos transcurridos desde la última carga de la API
  const elapsedMin = (currentTime.getTime() - fetchedAt) / 60000;

  let aTiempo = 0;
  let atrasados = 0;

  leadsFiltrados.forEach(l => {
    let t = 0;
    if (l.min_primera_respuesta != null) {
      t = l.min_primera_respuesta;
    } else if (l.min_esperando_respuesta != null) {
      t = l.min_esperando_respuesta + elapsedMin;
    } else if (l.ts_primera_respuesta) {
      t = (new Date(l.ts_primera_respuesta).getTime() - new Date(l.ts_efectivo || l.ts_lead_creado).getTime()) / 60000;
    } else {
      t = (currentTime.getTime() - new Date(l.ts_efectivo || l.ts_lead_creado).getTime()) / 60000;
    }

    if (t <= 15) aTiempo++; else atrasados++;
  });
  const total = leadsFiltrados.length;

  // Chart Data: Motivos (Tipos)
  const motivosCount = {};
  leadsFiltrados.forEach(l => {
    const t = l.tipo || 'General';
    motivosCount[t] = (motivosCount[t] || 0) + 1;
  });
  const dataMotivos = Object.entries(motivosCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Chart Data: Canales
  const canalesCount = {};
  leadsFiltrados.forEach(l => {
    const c = l.canal || 'Desconocido';
    canalesCount[c] = (canalesCount[c] || 0) + 1;
  });
  const dataCanales = Object.entries(canalesCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-main)', overflow: 'hidden' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Sidebar colapsable (estilo Front-CRM) */}
      <aside className="sidebar-dark" style={{
        width: collapsed ? 62 : 240, transition: 'width 0.25s ease',
        background: '#1e2a3b', display: 'flex', flexDirection: 'column',
        flexShrink: 0, overflow: 'hidden', zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? '16px 0' : '16px 20px',
          borderBottom: '1px solid #2d3d52',
          display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 64,
        }}>
          {collapsed
            ? <img src="https://comutelperu.com/correo-cm/Logo/ISO%20BLANCO.png" alt="Comutel" style={{ width: 36, display: 'block' }} />
            : <div style={{ width: '100%' }}>
                <img src="https://comutelperu.com/correo-cm/Logo/LOGO-BLANCO.png" alt="Comutel" style={{ width: '100%', maxWidth: 160, display: 'block' }} />
                <div style={{ color: '#8899aa', fontSize: 11, marginTop: 6 }}>Retail Leads Dashboard</div>
              </div>
          }
        </div>

        {/* Navegación */}
        <nav style={{ padding: collapsed ? '12px 0' : '12px 12px' }}>
          {[
            { key: 'dashboard', label: 'Dashboard', icon: '📊' },
            { key: 'detalle',   label: 'Detalle Operativo', icon: '📋' },
          ].map(item => (
            <button key={item.key} onClick={() => setView(item.key)}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex', alignItems: 'center', width: '100%',
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '10px 0' : '9px 12px',
                borderRadius: collapsed ? 0 : 8, marginBottom: 4,
                color: view === item.key ? '#fff' : '#8899aa',
                background: view === item.key ? '#2f6fd4' : 'transparent',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Separador */}
        <div style={{ borderTop: '1px solid #2d3d52', margin: collapsed ? '0' : '0 12px' }} />

        {/* Filtros — solo cuando está expandido */}
        {!collapsed && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            <FilterGroup label="Tiempo">
              {FILTROS_FECHA.map(f => (
                <button key={f.value} className={`btn-filter ${filtroFecha === f.value ? 'active' : ''}`} onClick={() => setFiltroFecha(f.value)}>
                  {f.label}
                </button>
              ))}
            </FilterGroup>

            <FilterGroup label="Estado" defaultOpen={false}>
              <button className={`btn-filter ${filtroEstado === '' ? 'active' : ''}`} onClick={() => setFiltroEstado('')}>Todos</button>
              {estadosUnicos.map(e => (
                <button key={e} className={`btn-filter ${filtroEstado === e ? 'active' : ''}`} onClick={() => setFiltroEstado(e)}>{ESTADO_LABELS[e] || e}</button>
              ))}
            </FilterGroup>

            <FilterGroup label="Categoría / Motivo" defaultOpen={false}>
              <button className={`btn-filter ${filtroTipo === '' ? 'active' : ''}`} onClick={() => setFiltroTipo('')}>Todos</button>
              {tiposUnicos.map(t => (
                <button key={t} className={`btn-filter ${filtroTipo === t ? 'active' : ''}`} onClick={() => setFiltroTipo(t)}>{t}</button>
              ))}
            </FilterGroup>

            <FilterGroup label="Vendedor" defaultOpen={false}>
              <button className={`btn-filter ${filtroVendedor === '' ? 'active' : ''}`} onClick={() => setFiltroVendedor('')}>Todos</button>
              {vendedoresUnicos.map(v => (
                <button key={v} className={`btn-filter ${filtroVendedor === v ? 'active' : ''}`} onClick={() => setFiltroVendedor(v)}>{v}</button>
              ))}
            </FilterGroup>

            <FilterGroup label="Canal" defaultOpen={false}>
              <button className={`btn-filter ${filtroCanal === '' ? 'active' : ''}`} onClick={() => setFiltroCanal('')}>Todos</button>
              {canalesUnicos.map(c => (
                <button key={c} className={`btn-filter ${filtroCanal === c ? 'active' : ''}`} onClick={() => setFiltroCanal(c)}>{c}</button>
              ))}
            </FilterGroup>
          </div>
        )}

        {/* Spacer cuando colapsado */}
        {collapsed && <div style={{ flex: 1 }} />}

        {/* Links externos */}
        <div style={{ borderTop: '1px solid #2d3d52', padding: collapsed ? '8px 0' : '8px 12px' }}>
          {[
            { href: `http://${window.location.hostname}:5174`, label: 'CRM Empresas', icon: '💼' },
            { href: 'http://192.168.1.50', label: 'GLPI', icon: '🛠' },
          ].map(({ href, label, icon }) => (
            <a key={href} href={href} target="_blank" rel="noreferrer"
              title={collapsed ? label : undefined}
              style={{
                display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '10px 0' : '9px 12px',
                borderRadius: collapsed ? 0 : 8,
                marginBottom: 4,
                color: '#8899aa', textDecoration: 'none', fontSize: 13, fontWeight: 500,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = '#8899aa'}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              {!collapsed && <span>{label}</span>}
            </a>
          ))}
        </div>

        {/* Botón contraer */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expandir menú' : 'Contraer menú'}
          style={{
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8, padding: collapsed ? '14px 0' : '14px 20px',
            background: 'none', border: 'none',
            borderTop: '1px solid #2d3d52',
            color: '#8899aa', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            width: '100%', transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = '#8899aa'}
        >
          <span style={{ fontSize: 16 }}>{collapsed ? '»' : '«'}</span>
          {!collapsed && <span>Contraer menú</span>}
        </button>
      </aside>

      {/* Contenido Principal Derecho */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 40px', display: 'flex', flexDirection: 'column', position: 'relative' }}>

        {isLoading && (
          <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-main)', opacity: 0.7,
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
            <div className="spinner" />
          </div>
        )}

        {/* Topbar: título + breadcrumb + controles */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2 }}>
              {view === 'dashboard' ? 'Dashboard' : 'Detalle Operativo'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', opacity: 0.7, padding: 4, fontSize: 20, display: 'flex', alignItems: 'center' }}>
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
              color: conectado ? 'var(--color-green)' : 'var(--color-red)',
              background: conectado ? 'var(--color-green-bg)' : 'var(--color-red-bg)',
              padding: '5px 10px', borderRadius: 20 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor',
                display: 'inline-block', animation: conectado ? 'pulse 2s infinite' : 'none' }} />
              {conectado ? 'En vivo' : 'Desconectado'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              🕒 {currentTime.toLocaleTimeString('es-PE')}
            </div>
            <button onClick={toggleFullscreen} style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', padding: '7px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 16, opacity: 0.7 }}>
              ⛶
            </button>
          </div>
        </div>

        {view === 'dashboard' ? (
          <>
            {/* KPI Grid (4 cols) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
              <TarjetaMetrica
                titulo="Leads Nuevos"
                valor={activos}
                accentColor="#1B4F72"
                icon="https://comutelperu.com/correo-cm/Iconos/nuevo.png"
                subtitulo="Sin atender"
              />
              <TarjetaMetrica
                titulo="Leads en Atención"
                valor={total}
                accentColor="#D97706"
                icon="https://comutelperu.com/correo-cm/Iconos/enatencion.png"
                subtitulo="Periodo completo"
              />
              <TarjetaMetrica
                titulo="Leads a Tiempo"
                valor={aTiempo}
                accentColor="var(--color-green)"
                icon="https://comutelperu.com/correo-cm/Iconos/atiempo.png"
                subtitulo="SLA ≤ 15 min"
              />
              <TarjetaMetrica
                titulo="Leads Atrasados"
                valor={atrasados}
                accentColor="var(--color-red)"
                icon="https://comutelperu.com/correo-cm/Iconos/atrasado.png"
                subtitulo="SLA > 15 min"
              />
            </div>

            {/* Charts Row 1: SLA por Vendedor + SLA Atendido + Por Estado */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 20 }}>
              <div className="card" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>SLA por Vendedor</div>
                <DashboardTecnicos leads={leadsFiltrados} fetchedAt={fetchedAt} />
              </div>
              <div className="card" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>SLA Atendido (%)</div>
                <div style={{ width: '100%', height: 160 }}>
                  <GraficoSLA atendidos={aTiempo} total={total} />
                </div>
              </div>
              <div className="card" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Por Estado</div>
                <div style={{ width: '100%', height: 160 }}>
                  <GraficoEstados leads={leadsFiltrados} />
                </div>
              </div>
            </div>

            {/* Charts Row 2: Evolución Temporal (izq) + Por Tipo / Por Canal (der) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div className="card" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Evolución Temporal de Leads</div>
                <div style={{ width: '100%', height: 220 }}>
                  <GraficoTiempo leads={leadsFiltrados} filtroFecha={filtroFecha} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div className="card" style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Por Tipo</div>
                  <GraficoBarrasTop data={dataMotivos} color="#1e2a3b" />
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Por Canal</div>
                  <GraficoBarrasTop data={dataCanales} color="#1e2a3b" />
                </div>
              </div>
            </div>

            {/* Listado / Tabla (limitado a 5) */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Detalle Operativo</div>
                <button onClick={() => setView('detalle')} style={{
                  background: 'none', border: 'none', color: 'var(--filter-active)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>
                  Ver todo ({leadsFiltrados.length}) →
                </button>
              </div>
              <TablaLeads leads={leadsFiltrados.slice(0, 5)} fetchedAt={fetchedAt} />
            </div>
          </>
        ) : (
          /* Vista Detalle Operativo completa */
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Detalle Operativo — {leadsFiltrados.length} leads</div>
              <button onClick={() => setView('dashboard')} style={{
                background: 'none', border: 'none', color: 'var(--filter-active)',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>
                ← Volver al Dashboard
              </button>
            </div>
            <TablaLeads leads={leadsFiltrados} fetchedAt={fetchedAt} />
          </div>
        )}

      </div>
    </div>
  );
}
