import { useEffect, useState, useCallback, useRef } from 'react';
import { getLeads, getMetricas, getMetricasTecnico, getTecnicos, getVendedores } from '../api/leads';
import { useSocket, emitTestAudio } from '../hooks/useSocket';
import TarjetaMetrica from '../components/TarjetaMetrica';
import TablaLeads from '../components/TablaLeads';
import TablaResumen from '../components/TablaResumen';
import DashboardTecnicos from '../components/DashboardTecnicos';
import GraficoTiempo from '../components/GraficoTiempo';
import GraficoBarrasTop from '../components/GraficoBarrasTop';
import GraficoDonut from '../components/GraficoDonut';
import GraficoSLA from '../components/GraficoSLA';
import GraficoEstados from '../components/GraficoEstados';
import ToastContainer, { useToasts } from '../components/ToastContainer';
import { playNuevoLead, playAlertaSLA, playVentaEfectiva, playInicioJornada, playFinJornada } from '../utils/sounds';
import confetti from 'canvas-confetti';
import ModalVendedores from '../components/ModalVendedores';

const MoonIcon = () => <span style={{ fontSize: 20 }}>☾</span>;
const SunIcon = () => <span style={{ fontSize: 20 }}>☀</span>;

function FilterGroup({ label, children, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 14 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        padding: '5px 0', marginBottom: open ? 8 : 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#5a7090', textTransform: 'uppercase' }}>{label}</span>
          {badge && (
            <span style={{ background: '#2f6fd4', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10 }}>{badge}</span>
          )}
        </div>
        <span style={{ color: '#5a7090', fontSize: 10, transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>}
    </div>
  );
}

const SLA_RESPUESTA = 15;
const SLA_COTIZACION = 240;
const SLA_ALERTA_ANTES = 5;

function isHorarioHabil(ts = Date.now()) {
  const t = new Date(new Date(ts).toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const day = t.getDay();
  const min = t.getHours() * 60 + t.getMinutes();
  if (day === 0) return false;
  if (day === 6) return min >= 9 * 60 + 30 && min < 14 * 60;
  return min >= 9 * 60 + 30 && min < 18 * 60 + 30;
}

function businessMinutesSince(fromTs) {
  if (!isHorarioHabil()) return 0;
  const toLima = t => new Date(new Date(t).toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const fromLima = toLima(fromTs);
  const nowLima  = toLima(Date.now());
  const BIZ_START = 9 * 60 + 30;
  const fromMin = fromLima.getHours() * 60 + fromLima.getMinutes() + fromLima.getSeconds() / 60;
  const nowMin  = nowLima.getHours()  * 60 + nowLima.getMinutes()  + nowLima.getSeconds()  / 60;
  return Math.max(0, nowMin - Math.max(fromMin, BIZ_START));
}

const FILTROS_FECHA = [
  { value: 'dia', label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mes' },
  { value: 'todos', label: 'Histórico' },
];

export default function Gerencia({ isAdmin = false, onAdminClick, onLogout }) {
  const [leads, setLeads] = useState([]);
  const [metricas, setMetricas] = useState([]);
  const [metricasTecnico, setMetricasTecnico] = useState([]);
  const [filtroFecha, setFiltroFecha] = useState('mes');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [ultimaActualizacion, setUltima] = useState(new Date());
  const { ultimoEvento, conectado, testAudio } = useSocket();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroVendedor, setFiltroVendedor] = useState('');
  const [filtroCanal, setFiltroCanal] = useState('');
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [refreshKey, setRefreshKey] = useState(0);
  const [tecnicos, setTecnicos] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toasts, addToast, removeToast } = useToasts();
  const alertedLeads = useRef(new Set());
  const ventaConfettiTriggered = useRef(new Set());
  const prevEnHorario = useRef(null);

  const [collapsed, setCollapsed] = useState(true);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'detalle'
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showVendedores, setShowVendedores] = useState(false);
  const [showTestMenu, setShowTestMenu] = useState(false);
  const testMenuRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showTestMenu) return;
    const handler = (e) => {
      if (testMenuRef.current && !testMenuRef.current.contains(e.target)) setShowTestMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTestMenu]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error("Error fullscreen", err));
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const cargarDatos = useCallback(async (silent = false) => {
    const now = new Date();
    const desde = {
      dia: now.toISOString().split('T')[0],
      semana: new Date(now - 7 * 864e5).toISOString().split('T')[0],
      mes: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      todos: null,
    }[filtroFecha] ?? null;

    if (!silent) setIsLoading(true);
    try {
      const [l, m, mt] = await Promise.all([getLeads(desde), getMetricas(), getMetricasTecnico()]);
      setLeads(prev => l.map(newLead => {
        const existing = prev.find(p => p.id === newLead.id);
        const cotAt = existing?._cotizacionAt
          ?? (sessionStorage.getItem(`cot_at_${newLead.id}`)
            ? Number(sessionStorage.getItem(`cot_at_${newLead.id}`))
            : (newLead.ts_primera_respuesta && !newLead.ts_cotizacion_enviada && newLead.min_esperando_cotizacion != null
              ? (() => {
                const ts = Date.now() - parseFloat(newLead.min_esperando_cotizacion) * 60000;
                sessionStorage.setItem(`cot_at_${newLead.id}`, ts);
                return ts;
              })()
              : undefined));
        const respAt = existing?._socketAt
          ?? (sessionStorage.getItem(`resp_at_${newLead.id}`)
            ? Number(sessionStorage.getItem(`resp_at_${newLead.id}`))
            : (!newLead.ts_primera_respuesta && newLead.min_esperando_respuesta != null
              ? (() => {
                const ts = Date.now() - newLead.min_esperando_respuesta * 60000;
                sessionStorage.setItem(`resp_at_${newLead.id}`, ts);
                return ts;
              })()
              : undefined));
        const sopAt = existing?._derivadoAt
          ?? (sessionStorage.getItem(`sop_at_${newLead.id}`)
            ? Number(sessionStorage.getItem(`sop_at_${newLead.id}`))
            : (newLead.estado === 'derivado' && newLead.min_esperando_soporte != null
              ? (() => {
                const ts = Date.now() - parseFloat(newLead.min_esperando_soporte) * 60000;
                sessionStorage.setItem(`sop_at_${newLead.id}`, ts);
                return ts;
              })()
              : undefined));
        return { ...newLead, _socketAt: respAt, _cotizacionAt: cotAt, _derivadoAt: sopAt };
      }));
      setMetricas(m);
      setMetricasTecnico(mt);
      setFetchedAt(Date.now());
      setUltima(new Date());
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [filtroFecha]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);
  useEffect(() => { getTecnicos().then(setTecnicos); }, []);
  useEffect(() => { getVendedores().then(setVendedores); }, []);

  // Auto-refresh cada 60s para mantener los minutos hábiles actualizados
  useEffect(() => {
    const iv = setInterval(() => {
      cargarDatos(true);
      setRefreshKey(k => k + 1);
    }, 60000);
    return () => clearInterval(iv);
  }, [cargarDatos]);

  // Actualizar estado localmente cuando llega evento de Socket
  useEffect(() => {
    if (!ultimoEvento) return;
    const { tipo, data } = ultimoEvento;
    setLeads(prev => {
      const needsRespTimer = !data.ts_primera_respuesta;
      const needsCotTimer = data.ts_primera_respuesta && !data.ts_cotizacion_enviada && data.estado !== 'derivado';
      const needsSoporteTimer = data.estado === 'derivado';

      const dataEnriquecida = {
        ...data,
        ...(needsRespTimer ? (() => {
          const ts = Date.now();
          sessionStorage.setItem(`resp_at_${data.id}`, ts);
          return { min_esperando_respuesta: data.min_esperando_respuesta ?? 0, _socketAt: ts };
        })() : {}),
        ...(needsCotTimer && data.min_esperando_cotizacion == null ? (() => {
          const ts = Date.now();
          sessionStorage.setItem(`cot_at_${data.id}`, ts);
          return { min_esperando_cotizacion: 0, _cotizacionAt: ts };
        })() : {}),
        ...(needsSoporteTimer && data.min_esperando_soporte == null ? (() => {
          const ts = Date.now();
          sessionStorage.setItem(`sop_at_${data.id}`, ts);
          return { min_esperando_soporte: 0, _derivadoAt: ts };
        })() : {}),
      };

      if (tipo === 'nuevo') {
        const existe = prev.find(l => l.id === dataEnriquecida.id);
        if (existe) return prev;
        return [dataEnriquecida, ...prev].sort((a, b) => new Date(b.ts_lead_creado) - new Date(a.ts_lead_creado));
      } else {
        return prev.map(l => {
          if (l.id !== dataEnriquecida.id) return l;
          return {
            ...l,
            ...dataEnriquecida,
            // Preservar timestamps de inicio de timer para que no se reinicien
            _socketAt: l._socketAt ?? dataEnriquecida._socketAt,
            _cotizacionAt: l._cotizacionAt ?? dataEnriquecida._cotizacionAt,
            // Preservar campos computados del fetch anterior si el socket no los trae
            min_esperando_respuesta: dataEnriquecida.min_esperando_respuesta ?? l.min_esperando_respuesta,
            min_esperando_cotizacion: dataEnriquecida.min_esperando_cotizacion ?? l.min_esperando_cotizacion,
            min_primera_respuesta: dataEnriquecida.min_primera_respuesta ?? l.min_primera_respuesta,
            min_cotizacion: dataEnriquecida.min_cotizacion ?? l.min_cotizacion,
            min_esperando_soporte: dataEnriquecida.min_esperando_soporte ?? l.min_esperando_soporte,
            min_soporte_final: dataEnriquecida.min_soporte_final ?? l.min_soporte_final,
            min_cotizacion_final: dataEnriquecida.min_cotizacion_final ?? l.min_cotizacion_final,
          };
        });
      }
    });
    setUltima(new Date());
    // Re-fetch silencioso para restaurar campos computados (min_cotizacion, etc.)
    setTimeout(() => cargarDatos(true), 600);


    // Toast para nuevo lead
    if (tipo === 'nuevo') {
      playNuevoLead(data.vendedor_nombre || '');
      addToast({
        title: '🟢 Nuevo Lead',
        vendor: data.vendedor_nombre || data.asesor_asignado || 'Sin asignar',
        detail: data.nombre || 'Sin nombre',
      }, 'success');
    }

    // Confetti + sonido para venta efectiva (todos los clientes)
    if ((tipo === 'actualizado' || tipo === 'venta_efectiva') &&
      data.estado === 'venta_efectiva' &&
      !ventaConfettiTriggered.current.has(data.id)) {
      ventaConfettiTriggered.current.add(data.id);
      playVentaEfectiva();
      addToast({
        title: '🎉 ¡Venta Efectiva!',
        vendor: data.vendedor_nombre || 'Sin asesor',
        detail: data.nombre || 'Lead',
      }, 'success');
      const duration = 4000;
      const end = Date.now() + duration;
      const colors = ['#27AE60', '#F1C40F', '#E74C3C', '#3498DB', '#9B59B6'];
      (function frame() {
        confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors });
        confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    }
  }, [ultimoEvento, cargarDatos]);

  // ── Alerta SLA por vencer (cada 30s) ──
  useEffect(() => {
    const check = () => {
      leads.forEach(l => {
        const key = `${l.id}-resp`;
        const keyCot = `${l.id}-cot`;

        // SLA Primera Respuesta
        if (l.estado === 'nuevo' && !alertedLeads.current.has(key)) {
          const leadElapsed = l._socketAt != null ? businessMinutesSince(l._socketAt) : businessMinutesSince(fetchedAt);
          let t = 0;
          if (l.min_esperando_respuesta != null) t = l.min_esperando_respuesta + leadElapsed;
          else {
            const ref = new Date(String(l.ts_efectivo || l.ts_lead_creado).replace(' ', 'T'));
            t = isNaN(ref.getTime()) ? 0 : (Date.now() - ref.getTime()) / 60000;
          }
          if (t >= SLA_RESPUESTA - SLA_ALERTA_ANTES && t < SLA_RESPUESTA) {
            alertedLeads.current.add(key);
            playAlertaSLA();
            addToast({
              title: '⚠️ SLA por vencer — 1ra Respuesta',
              vendor: l.vendedor_nombre || 'Sin asignar',
              detail: `${l.nombre} · Quedan ${Math.ceil(SLA_RESPUESTA - t)} min`,
            }, 'warning');
          }
        }

        // SLA Cotización
        if (l.estado === 'en_atencion' && !alertedLeads.current.has(keyCot)) {
          const leadElapsed = l._cotizacionAt != null ? businessMinutesSince(l._cotizacionAt) : businessMinutesSince(fetchedAt);
          let t = 0;
          if (l.min_esperando_cotizacion != null) t = l.min_esperando_cotizacion + leadElapsed;
          else if (l.ts_primera_respuesta) {
            const ref = new Date(String(l.ts_primera_respuesta).replace(' ', 'T'));
            t = isNaN(ref.getTime()) ? 0 : (Date.now() - ref.getTime()) / 60000;
          }
          if (t >= SLA_COTIZACION - SLA_ALERTA_ANTES && t < SLA_COTIZACION) {
            alertedLeads.current.add(keyCot);
            playAlertaSLA();
            addToast({
              title: '⚠️ SLA por vencer — Cotización',
              vendor: l.vendedor_nombre || 'Sin asignar',
              detail: `${l.nombre} · Quedan ${Math.ceil(SLA_COTIZACION - t)} min`,
            }, 'danger');
          }
        }
      });
    };
    const iv = setInterval(check, 30000);
    check(); // ejecutar inmediatamente
    return () => clearInterval(iv);
  }, [leads, fetchedAt, addToast]);

  // ── Test de audio global (broadcast desde admin) ──
  useEffect(() => {
    if (!testAudio) return;
    const { tipo } = testAudio;
    if (tipo === 'nuevo_lead')  { playNuevoLead(''); addToast('🔊 Test global: Nuevo Lead', 'info'); }
    if (tipo === 'sla')         { playAlertaSLA();   addToast('⚠️ Test global: Alerta SLA', 'warning'); }
    if (tipo === 'venta')       { playVentaEfectiva(); addToast('🎉 Test global: Venta Efectiva', 'success'); }
    if (tipo === 'inicio')      { playInicioJornada(); addToast('🟢 Test global: Inicio jornada', 'success'); }
    if (tipo === 'fin')         { playFinJornada();    addToast('🔴 Test global: Fin jornada', 'info'); }
  }, [testAudio]);

  const enHorarioHabil = (() => {
    const t = new Date(currentTime.toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const day = t.getDay();
    const min = t.getHours() * 60 + t.getMinutes();
    if (day === 0) return false;
    if (day === 6) return min >= 9 * 60 + 30 && min < 14 * 60;
    return min >= 9 * 60 + 30 && min < 18 * 60 + 30;
  })();

  // ── Melodía de inicio / fin de jornada ──
  useEffect(() => {
    // Ignorar la primera renderización (no sabemos el estado anterior)
    if (prevEnHorario.current === null) {
      prevEnHorario.current = enHorarioHabil;
      return;
    }
    if (enHorarioHabil && !prevEnHorario.current) {
      playInicioJornada();
      addToast('🟢 ¡Inicio de jornada laboral! Buen día equipo 💪', 'success');
    }
    if (!enHorarioHabil && prevEnHorario.current) {
      playFinJornada();
      addToast('🔴 Fin de la jornada laboral. ¡Buen descanso! 🌙', 'info');
    }
    prevEnHorario.current = enHorarioHabil;
  }, [enHorarioHabil]);

  const tiposUnicos = Array.from(new Set(leads.map(l => l.tipo || 'General')));
  const estadosUnicos = Array.from(new Set(leads.map(l => l.estado || 'nuevo')));
  const vendedoresUnicos = Array.from(new Set(leads.filter(l => l.vendedor_nombre).map(l => l.vendedor_nombre)));
  const canalesUnicos = Array.from(new Set(leads.filter(l => l.canal).map(l => l.canal)));

  const ESTADO_LABELS = {
    nuevo: 'Nuevo', en_atencion: 'En atención', cotizado: 'Cotizado',
    derivado: 'Derivado', cotizado_tecnico: 'Cot. Técnico',
    venta_efectiva: 'Venta efectiva', negociacion_futuro: 'Neg. a futuro', no_efectiva: 'No efectiva'
  };
  const ESTADO_COLORS = {
    nuevo: '#3B82F6', en_atencion: '#F59E0B', cotizado: '#8B5CF6',
    derivado: '#06B6D4', cotizado_tecnico: '#0D9488',
    venta_efectiva: '#22C55E', negociacion_futuro: '#F97316', no_efectiva: '#EF4444',
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
    if (filtroFecha === 'semana') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1; // 0=Sun
      const minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
      minDate.setHours(0, 0, 0, 0);
      return d >= minDate;
    }
    if (filtroFecha === 'mes') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  });

  const ESTADOS_CERRADOS = ['venta_efectiva', 'negociacion_futuro', 'no_efectiva'];
  const activos = leadsFiltrados.filter(l => l.estado === 'nuevo').length;
  const cerrados = leadsFiltrados.filter(l => ESTADOS_CERRADOS.includes(l.estado)).length;
  const leadsAbiertos = leadsFiltrados.filter(l => !ESTADOS_CERRADOS.includes(l.estado));

  let aTiempo = 0;
  let atrasados = 0;

  leadsFiltrados.forEach(l => {
    let t;
    if (l.ts_primera_respuesta) {
      t = parseFloat(l.min_primera_respuesta) || 0;
    } else if (l._socketAt != null) {
      t = businessMinutesSince(l._socketAt);
    } else if (l.min_esperando_respuesta != null) {
      t = parseFloat(l.min_esperando_respuesta) + businessMinutesSince(fetchedAt);
    } else {
      t = 0;
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
  const TIPO_ICONS = {
    'academia': 'https://comutelperu.com/correo-cm/Iconos/academia.png',
    'requerimiento': 'https://comutelperu.com/correo-cm/Iconos/requerimiento.png',
    'soporte': 'https://comutelperu.com/correo-cm/Iconos/soporte-tecnico.png',
    'producto': 'https://comutelperu.com/correo-cm/Iconos/producto.png',
  };
  const dataMotivos = Object.entries(motivosCount)
    .map(([name, value]) => ({ name, value, icon: TIPO_ICONS[name.toLowerCase()] || null }))
    .sort((a, b) => b.value - a.value);

  // Chart Data: Canales
  const CANAL_ICONS = {
    store: 'https://comutelperu.com/correo-cm/Iconos/odoo.png?v=2',
    whatsapp: 'https://comutelperu.com/correo-cm/Iconos/whatsapp.png',
    facebook: 'https://comutelperu.com/correo-cm/Iconos/facebook.png?v=2',
    instagram: 'https://comutelperu.com/correo-cm/Iconos/instagram.png',
    web: 'https://comutelperu.com/correo-cm/Logo/ISO.png',
  };
  const CANAL_COLORS = {
    store: '#7C3AED',
    whatsapp: '#25D366',
    facebook: '#60A5FA',
    instagram: '#EC4899',
    web: '#38BDF8',
    tiktok: '#9CA3AF',
    youtube: '#EF4444',
  };
  const canalesCount = {};
  // Inicializar todos los canales conocidos en 0
  Object.keys(CANAL_COLORS).forEach(c => { canalesCount[c] = 0; });
  leadsFiltrados.forEach(l => {
    const c = (l.canal || 'Desconocido').toLowerCase();
    canalesCount[c] = (canalesCount[c] || 0) + 1;
  });
  const dataCanales = Object.entries(canalesCount)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: CANAL_COLORS[name.toLowerCase()] || '#6B7280',
      icon: CANAL_ICONS[name.toLowerCase()] || null,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-main)', overflow: 'hidden' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {showVendedores && <ModalVendedores onClose={() => setShowVendedores(false)} />}

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
              <div style={{ color: '#8899aa', fontSize: 11, marginTop: 6 }}>Vantio Leads</div>
            </div>
          }
        </div>

        {/* Navegación */}
        <nav style={{ padding: collapsed ? '12px 0' : '12px 12px' }}>
          {[
            { key: 'dashboard', label: 'Dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg> },
            { key: 'detalle', label: 'Detalle Operativo', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg> },
          ].map(item => (
            <button key={item.key} onClick={() => { setView(item.key); if (item.key === 'dashboard') cargarDatos(true); }}
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
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px' }}>

            {/* Limpiar filtros */}
            {(filtroEstado || filtroTipo || filtroVendedor || filtroCanal || filtroFecha !== 'mes') && (
              <button onClick={() => { setFiltroFecha('mes'); setFiltroEstado(''); setFiltroTipo(''); setFiltroVendedor(''); setFiltroCanal(''); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, width: '100%', marginBottom: 14,
                  padding: '6px 10px', borderRadius: 6, border: '1px solid #e74c3c44',
                  background: '#e74c3c11', color: '#e74c3c', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                }}>
                ✕ Limpiar filtros
              </button>
            )}

            {/* Período */}
            <FilterGroup label="Período">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {FILTROS_FECHA.map(f => (
                  <button key={f.value} onClick={() => setFiltroFecha(f.value)} style={{
                    padding: '7px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600, textAlign: 'center', transition: 'all 0.15s',
                    background: filtroFecha === f.value ? '#2f6fd4' : '#253347',
                    color: filtroFecha === f.value ? '#fff' : '#6b84a0',
                  }}>{f.label}</button>
                ))}
              </div>
            </FilterGroup>

            <div style={{ borderTop: '1px solid #1e2d3e', margin: '10px 0' }} />

            {/* Estado */}
            <FilterGroup label="Estado" defaultOpen={false} badge={filtroEstado ? 1 : null}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <button onClick={() => setFiltroEstado('')} style={{
                  gridColumn: '1 / -1', padding: '7px 4px', borderRadius: 6, border: 'none',
                  cursor: 'pointer', fontSize: 11, fontWeight: 600, textAlign: 'center',
                  transition: 'all 0.15s',
                  background: filtroEstado === '' ? '#2f6fd4' : '#253347',
                  color: filtroEstado === '' ? '#fff' : '#6b84a0',
                }}>Todos</button>
                {estadosUnicos.map(e => {
                  const active = filtroEstado === e;
                  const col = ESTADO_COLORS[e] || '#2f6fd4';
                  return (
                    <button key={e} onClick={() => setFiltroEstado(e)} style={{
                      padding: '7px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, textAlign: 'center', transition: 'all 0.15s',
                      background: active ? col : '#253347',
                      color: active ? '#fff' : '#6b84a0',
                    }}>{ESTADO_LABELS[e] || e}</button>
                  );
                })}
              </div>
            </FilterGroup>

            <div style={{ borderTop: '1px solid #1e2d3e', margin: '10px 0' }} />

            {/* Categoría */}
            <FilterGroup label="Categoría" defaultOpen={false} badge={filtroTipo ? 1 : null}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <button onClick={() => setFiltroTipo('')} style={{
                  gridColumn: '1 / -1', padding: '7px 4px', borderRadius: 6, border: 'none',
                  cursor: 'pointer', fontSize: 11, fontWeight: 600, textAlign: 'center',
                  transition: 'all 0.15s',
                  background: filtroTipo === '' ? '#2f6fd4' : '#253347',
                  color: filtroTipo === '' ? '#fff' : '#6b84a0',
                }}>Todas</button>
                {tiposUnicos.map(t => (
                  <button key={t} onClick={() => setFiltroTipo(t)} style={{
                    padding: '7px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600, textAlign: 'center',
                    textTransform: 'capitalize', transition: 'all 0.15s',
                    background: filtroTipo === t ? '#2f6fd4' : '#253347',
                    color: filtroTipo === t ? '#fff' : '#6b84a0',
                  }}>{t}</button>
                ))}
              </div>
            </FilterGroup>

            <div style={{ borderTop: '1px solid #1e2d3e', margin: '10px 0' }} />

            {/* Canal */}
            <FilterGroup label="Canal" defaultOpen={false} badge={filtroCanal ? 1 : null}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <button onClick={() => setFiltroCanal('')} style={{
                  gridColumn: '1 / -1', padding: '7px 4px', borderRadius: 6, border: 'none',
                  cursor: 'pointer', fontSize: 11, fontWeight: 600, textAlign: 'center',
                  transition: 'all 0.15s',
                  background: filtroCanal === '' ? '#2f6fd4' : '#253347',
                  color: filtroCanal === '' ? '#fff' : '#6b84a0',
                }}>Todos</button>
                {canalesUnicos.map(c => {
                  const key = c.toLowerCase();
                  const active = filtroCanal === c;
                  const col = CANAL_COLORS[key] || '#2f6fd4';
                  return (
                    <button key={c} onClick={() => setFiltroCanal(c)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      padding: '7px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
                      background: active ? col : '#253347',
                      color: active ? '#fff' : '#6b84a0',
                    }}>
                      {CANAL_ICONS[key] && (
                        <img src={CANAL_ICONS[key]} alt={c}
                          style={{ width: 13, height: 13, objectFit: 'contain', flexShrink: 0,
                            filter: active ? 'brightness(10)' : 'none', transition: 'filter 0.15s' }} />
                      )}
                      <span style={{ textTransform: 'capitalize' }}>{c}</span>
                    </button>
                  );
                })}
              </div>
            </FilterGroup>

            <div style={{ borderTop: '1px solid #1e2d3e', margin: '10px 0' }} />

            {/* Vendedor */}
            <FilterGroup label="Vendedor" defaultOpen={false} badge={filtroVendedor ? 1 : null}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <button onClick={() => setFiltroVendedor('')} style={{
                  gridColumn: '1 / -1', padding: '7px 4px', borderRadius: 6, border: 'none',
                  cursor: 'pointer', fontSize: 11, fontWeight: 600, textAlign: 'center',
                  transition: 'all 0.15s',
                  background: filtroVendedor === '' ? '#2f6fd4' : '#253347',
                  color: filtroVendedor === '' ? '#fff' : '#6b84a0',
                }}>Todos</button>
                {vendedoresUnicos.map(v => {
                  const active = filtroVendedor === v;
                  const hue = v.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
                  const firstName = v.split(' ')[0];
                  return (
                    <button key={v} onClick={() => setFiltroVendedor(v)} style={{
                      padding: '7px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, textAlign: 'center',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      transition: 'all 0.15s',
                      background: active ? `hsl(${hue},55%,38%)` : '#253347',
                      color: active ? '#fff' : '#6b84a0',
                    }}>{firstName}</button>
                  );
                })}
              </div>
            </FilterGroup>

          </div>
        )}

        {/* Spacer cuando colapsado */}
        {collapsed && <div style={{ flex: 1 }} />}

        {/* Links externos */}
        <div style={{ borderTop: '1px solid #2d3d52', padding: collapsed ? '8px 0' : '8px 12px' }}>
          {[
            { href: `http://${window.location.hostname}:5174`, label: 'Vantio Planner', icon: 'https://comutelperu.com/correo-cm/Vantio/LOGO/VANTIO-BLANCO-SHORT.png' },
            { href: 'http://192.168.1.50', label: 'GLPI CM', icon: 'https://comutelperu.com/correo-cm/Iconos/10156352.png' },
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
              <img src={icon} alt={label} style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} />
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
      <div style={{ flex: 1, overflow: view === 'detalle' ? 'hidden' : 'auto', padding: '24px 40px', display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>

        {isLoading && (
          <div style={{
            position: 'absolute', inset: 0, background: 'var(--bg-main)', opacity: 0.7,
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20
          }}>
            <div className="spinner" />
          </div>
        )}

        {/* Topbar: título + breadcrumb + controles */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
              Gestión de Leads
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, fontWeight: 500, textTransform: 'capitalize' }}>
              {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} - {currentTime.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

            {/* Search Bar Visual -> Trimestres */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '4px', fontSize: 13,
            }}>
              {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => {
                const isCurrent = (i + 1) === (Math.floor(currentTime.getMonth() / 3) + 1);
                return (
                  <button key={q} style={{
                    background: isCurrent ? 'var(--accent)' : 'transparent',
                    border: 'none', borderRadius: 4, cursor: 'pointer',
                    padding: '4px 12px', color: isCurrent ? '#fff' : 'var(--text-main)',
                    fontWeight: 600, fontSize: 12,
                    animation: isCurrent ? 'pulse 2s infinite' : 'none',
                    boxShadow: isCurrent ? '0 2px 8px var(--accent-glow)' : 'none',
                    transition: 'all 0.3s'
                  }}>
                    {q}
                  </button>
                );
              })}
            </div>

            {/* Administrar Vendedores y Probar Alertas (Solo Admin) */}
            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div ref={testMenuRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowTestMenu(v => !v)}
                    title="Prueba de audio global — todos los clientes escuchan"
                    style={{
                      padding: '6px 10px', borderRadius: 6, border: '1px solid #10b98155',
                      background: showTestMenu ? '#10b98130' : '#10b98118', color: '#10b981',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    🌐 Test Global
                  </button>
                  {showTestMenu && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 10, padding: 6, zIndex: 100,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                      display: 'flex', flexDirection: 'column', gap: 3, minWidth: 190,
                    }}>
                      {[
                        { tipo: 'nuevo_lead', label: '🟢 Nuevo Lead',       color: '#38bdf8', play: () => playNuevoLead('') },
                        { tipo: 'sla',        label: '⚠️ Alerta SLA',       color: '#f59e0b', play: () => playAlertaSLA() },
                        { tipo: 'venta',      label: '🎉 Venta Efectiva',    color: '#10b981', play: () => playVentaEfectiva() },
                        { tipo: 'inicio',     label: '☀️ Inicio de Jornada', color: '#a78bfa', play: () => playInicioJornada() },
                        { tipo: 'fin',        label: '🌙 Fin de Jornada',    color: '#6b7280', play: () => playFinJornada() },
                      ].map(({ tipo, label, color, play }) => (
                        <button key={tipo} onClick={() => { play(); emitTestAudio(tipo); setShowTestMenu(false); }} style={{
                          padding: '8px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                          background: 'transparent', color: 'var(--text-main)',
                          fontSize: 13, fontWeight: 600, textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = color + '22'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    playAlertaSLA();
                    addToast("⚠️ Probando alerta crítica de SLA", "error");

                    setTimeout(() => {
                      playNuevoLead('Erimay');
                      addToast("🔊 Probando alerta lead: Erimay", "info");
                    }, 1500);

                    setTimeout(() => {
                      playNuevoLead('Sthefania');
                      addToast("🔊 Probando alerta lead: Sthefania", "info");
                    }, 3000);

                    setTimeout(() => {
                      playNuevoLead('Estefany');
                      addToast("🔊 Probando alerta lead: Estefany", "info");
                    }, 4500);

                    setTimeout(() => {
                      playNuevoLead('Otro');
                      addToast("🔊 Probando alerta lead genérico (beep)", "info");
                    }, 6000);

                    setTimeout(() => {
                      playVentaEfectiva();
                      addToast("🎉 ¡Probando celebración de venta!", "success");
                      const duration = 2500;
                      const end = Date.now() + duration;
                      const colors = ['#27AE60', '#F1C40F', '#E74C3C', '#3498DB', '#9B59B6'];
                      (function frame() {
                        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors });
                        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors });
                        if (Date.now() < end) requestAnimationFrame(frame);
                      })();
                    }, 7500);

                    setTimeout(() => {
                      playInicioJornada();
                      addToast("🟢 Probando: Inicio de jornada laboral 💪", "success");
                    }, 10500);

                    setTimeout(() => {
                      playFinJornada();
                      addToast("🔴 Probando: Fin de jornada laboral 🌙", "info");
                    }, 12500);
                  }}
                  title="Probar sonidos y alertas"
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: '1px solid var(--accent-border)',
                    background: 'var(--bg-card)', color: 'var(--accent)',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center'
                  }}
                >
                  🔊 Test
                </button>
                <button
                  onClick={() => setShowVendedores(true)}
                  title="Gestionar vendedores"
                  style={{
                    padding: '6px 12px', borderRadius: 6, border: '1px solid var(--accent-border)',
                    background: 'var(--accent-glow)', color: 'var(--accent)',
                    cursor: 'pointer', fontSize: 14, fontWeight: 600,
                    display: 'flex', alignItems: 'center'
                  }}
                >
                  👥
                </button>
              </div>
            )}

            {/* Theme Toggle */}
            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-dim)',
              cursor: 'pointer', padding: '6px 10px', borderRadius: 6, fontSize: 16, display: 'flex', alignItems: 'center'
            }}>
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Login / Exportar estilo */}
            
            {/* En vivo / Nuevo Lead Verde */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700,
              color: '#fff',
              background: !conectado ? 'var(--danger)' : enHorarioHabil ? 'var(--accent)' : '#92400E',
              padding: '7px 16px', borderRadius: 6, cursor: 'default'
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: 'currentColor',
                display: 'inline-block', animation: conectado && enHorarioHabil ? 'pulse 2s infinite' : 'none'
              }} />
              {!conectado ? 'Desconectado' : enHorarioHabil ? 'En Vivo' : 'Fuera de horario'}
            </div>

            <button
              onClick={isAdmin ? onLogout : onAdminClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'var(--bg-card)', color: 'var(--text-dim)',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              <span style={{ fontSize: 12 }}>{isAdmin ? '🔓' : '🔒'}</span>
              {isAdmin ? 'Desconectar' : ''}
            </button>

            {/* Fullscreen con color del Sidebar */}
            <button onClick={toggleFullscreen} style={{
              background: '#1e2a3b', color: '#f7fafcff', border: '1px solid var(--border)',
              padding: '7px 11px', borderRadius: 6, cursor: 'pointer',
              fontWeight: 800, fontSize: 16
            }}>
              ⛶
            </button>
          </div>
        </div>

        {view === 'dashboard' ? (
          <>
            {/* KPI Grid (5 cols) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 20, marginBottom: 24 }}>
              <TarjetaMetrica
                titulo="Leads Nuevos"
                valor={activos}
                accentColor="#38bdf8"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>}

                delta={12}
                deltaLabel="vs ayer"
              />
              <TarjetaMetrica
                titulo="En Atención"
                valor={leadsFiltrados.filter(l => l.estado === 'en_atencion').length}
                accentColor="#A78BFA"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>}

                delta={5}
                deltaLabel="vs ayer"
              />
              <TarjetaMetrica
                titulo="A Tiempo"
                valor={aTiempo}
                accentColor="#10b981"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}

                delta={8}
                deltaLabel="vs semana"
              />
              <TarjetaMetrica
                titulo="Atrasados"
                valor={atrasados}
                accentColor="#F43F5E"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>}

                delta={-3}
                deltaLabel="vs ayer"
              />
              <TarjetaMetrica
                titulo="Leads Cerrados"
                valor={cerrados}
                accentColor="#9CA3AF"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}

                delta={6}
                deltaLabel="vs semana"
              />
            </div>

            {/* Charts Row 1: SLA por Vendedor + SLA Atendido + Por Estado */}




            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr', gap: 20, marginBottom: 20 }}>
              <div className="card card-shimmer" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>SLA Atendido (%)</div>
                <div style={{ width: '100%', height: 130 }}>
                  <GraficoSLA key={refreshKey} atendidos={aTiempo} total={total} />
                </div>
              </div>
              <div className="card card-shimmer" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>SLA por Vendedor</div>
                <DashboardTecnicos key={refreshKey} leads={leadsFiltrados} fetchedAt={fetchedAt} vendedores={vendedores} />
              </div>
              <div className="card card-shimmer" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Por Estado</div>
                <GraficoEstados key={refreshKey} leads={leadsFiltrados} />
              </div>
            </div>

            {/* Charts Row 2: Resumen SLA (izq) + Por Tipo / Por Canal (der) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div className="card card-shimmer" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Resumen SLA</div>
                <TablaResumen leads={leadsFiltrados.slice(0, 3)} fetchedAt={fetchedAt} />
              </div>
              <div className="card card-shimmer" style={{ padding: '14px 18px' }}>
                <GraficoBarrasTop key={refreshKey} dataTipo={dataMotivos} dataCanal={dataCanales} colorTipo="#6366f1" />
              </div>
            </div>

            {/* Evolución Temporal (movida abajo) */}
            <div className="card card-shimmer" style={{ padding: '14px 18px', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Evolución Temporal de Leads</div>
              <div style={{ width: '100%', height: 220 }}>
                <GraficoTiempo key={refreshKey} leads={leadsFiltrados} filtroFecha={filtroFecha} />
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
              <TablaLeads leads={leadsFiltrados.slice(0, 3)} fetchedAt={fetchedAt} tecnicos={tecnicos} vendedores={vendedores} onActualizar={() => cargarDatos(true)} onEliminar={id => setLeads(prev => prev.filter(l => l.id !== id))} isAdmin={isAdmin} />
            </div>
          </>
        ) : (
          /* Vista Detalle Operativo completa */
          <div className="card" style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Detalle Operativo — {leadsFiltrados.length} leads</div>
              <button onClick={() => { setView('dashboard'); cargarDatos(true); }} style={{
                background: 'none', border: 'none', color: 'var(--filter-active)',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>
                ← Volver al Dashboard
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <TablaLeads leads={leadsFiltrados} fetchedAt={fetchedAt} tecnicos={tecnicos} vendedores={vendedores} onActualizar={() => cargarDatos(true)} onEliminar={id => setLeads(prev => prev.filter(l => l.id !== id))} isAdmin={isAdmin} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
