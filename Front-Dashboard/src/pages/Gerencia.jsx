import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { getLeads, getMetricas, getMetricasTecnico, getTecnicos, getVendedores } from '../api/leads';
import { useSocket, emitTestAudio, emitForceReload } from '../hooks/useSocket';
import { playNuevoLead, playAlertaSLA, playVentaEfectiva, playInicioJornada, playFinJornada } from '../utils/sounds';
import confetti from 'canvas-confetti';

import Topbar from '../components/Topbar';
import FilterSidebar from '../components/FilterSidebar';
import LiveTicker from '../components/LiveTicker';
import KpiStrip from '../components/KpiStrip';
import CriticalLeads from '../components/CriticalLeads';
import SlaSemaphore from '../components/SlaSemaphore';
import Breakdown from '../components/Breakdown';
import SellerRanking from '../components/SellerRanking';
import TemporalChart from '../components/TemporalChart';
import OperativeTable from '../components/OperativeTable';
import TablaLeads from '../components/TablaLeads';
import ToastContainer, { useToasts } from '../components/ToastContainer';
import ModalVendedores from '../components/ModalVendedores';
import { Icon } from '../components/Icon';
import {
  STATUS_ORDER, ESTADOS_CERRADOS, businessMinutesSince, statusMeta, canalMeta,
  getMinutosPrimeraRespuesta, slaLevel,
} from '../utils/domain';

const TIPO_PALETTE = ['var(--primary)', 'var(--st-derivado)', 'var(--st-venta)', 'var(--warn)', 'var(--st-cotizado)', 'var(--st-tecnico)', 'var(--neutral)'];

const SLA_RESPUESTA = 15;
const SLA_COTIZACION = 240;
const SLA_ALERTA_ANTES = 5;

function pctChange(arr) {
  if (!arr || arr.length < 2) return null;
  const prev = arr[arr.length - 2], last = arr[arr.length - 1];
  if (!prev) return null;
  return Math.round((last - prev) / prev * 100);
}

/* mapea un lead a un evento del ticker (un icono/tipo por estado)
   Campos separados (pre / strong / post) — se renderizan como JSX, sin HTML crudo. */
function leadToTick(l) {
  const t = l.ts_lead_creado
    ? new Date(l.ts_lead_creado).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' })
    : '';
  const nombre = l.nombre || 'Lead';
  const base = { id: l.id, t, post: '' };
  switch (l.estado) {
    case 'venta_efectiva':   return { ...base, type: 'venta',    pre: 'Venta efectiva · ',     strong: l.vendedor_nombre || nombre };
    case 'derivado':
    case 'cotizado_tecnico': return { ...base, type: 'derivado', pre: 'Derivado a técnico · ', strong: nombre };
    case 'cotizado':         return { ...base, type: 'cotizado', pre: 'Cotizado · ',           strong: nombre };
    case 'en_atencion':      return { ...base, type: 'atencion', pre: 'En atención · ',        strong: nombre };
    default:                 return { ...base, type: 'nuevo',    pre: 'Nuevo lead · ',         strong: nombre, post: l.canal ? ` · ${l.canal}` : '' };
  }
}

export default function Gerencia({ isAdmin = false, onAdminClick, onLogout }) {
  const [leads, setLeads] = useState([]);
  const [metricas, setMetricas] = useState([]);
  const [metricasTecnico, setMetricasTecnico] = useState([]);
  const [filtroFecha, setFiltroFecha] = useState('mes');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [ultimaActualizacion, setUltima] = useState(new Date());
  const { ultimoEvento, conectado, testAudio } = useSocket();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
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

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'detalle'
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showVendedores, setShowVendedores] = useState(false);
  const [query, setQuery] = useState('');
  const [detalleQuery, setDetalleQuery] = useState('');
  const [newIds, setNewIds] = useState(() => new Set());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error('Error fullscreen', err));
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-density', 'balanced');
  }, []);

  const cargarDatos = useCallback(async (silent = false) => {
    const now = new Date();
    const primerDiaMesPasado = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const desde = {
      dia: now.toISOString().split('T')[0],
      semana: new Date(now - 7 * 864e5).toISOString().split('T')[0],
      mes: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      mes_pasado: `${primerDiaMesPasado.getFullYear()}-${String(primerDiaMesPasado.getMonth() + 1).padStart(2, '0')}-01`,
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
            _socketAt: l._socketAt ?? dataEnriquecida._socketAt,
            _cotizacionAt: l._cotizacionAt ?? dataEnriquecida._cotizacionAt,
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

    // ── Resaltado de filas nuevas (el ticker se deriva de leadsFiltrados) ──
    if (tipo === 'nuevo') {
      setNewIds(s => { const n = new Set(s); n.add(data.id); return n; });
      setTimeout(() => setNewIds(s => { const n = new Set(s); n.delete(data.id); return n; }), 1600);
    }

    // Toast para nuevo lead
    if (tipo === 'nuevo') {
      playNuevoLead(data.vendedor_nombre || '');
      addToast({
        title: 'Nuevo Lead',
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
        title: '¡Venta Efectiva!',
        vendor: data.vendedor_nombre || 'Sin asesor',
        detail: data.nombre || 'Lead',
      }, 'success');
      const duration = 4000;
      const end = Date.now() + duration;
      const colors = ['#0a5b89', '#1c8a5a', '#bd7a08', '#3257b8', '#7a4fcf'];
      (function frame() {
        confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors });
        confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    }
  }, [ultimoEvento, cargarDatos, addToast]);

  // ── Alerta SLA por vencer (cada 30s) ──
  useEffect(() => {
    const check = () => {
      leads.forEach(l => {
        const key = `${l.id}-resp`;
        const keyCot = `${l.id}-cot`;

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
              title: 'SLA por vencer — 1ra Respuesta',
              vendor: l.vendedor_nombre || 'Sin asignar',
              detail: `${l.nombre} · Quedan ${Math.ceil(SLA_RESPUESTA - t)} min`,
            }, 'warning');
          }
        }

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
              title: 'SLA por vencer — Cotización',
              vendor: l.vendedor_nombre || 'Sin asignar',
              detail: `${l.nombre} · Quedan ${Math.ceil(SLA_COTIZACION - t)} min`,
            }, 'danger');
          }
        }
      });
    };
    const iv = setInterval(check, 30000);
    check();
    return () => clearInterval(iv);
  }, [leads, fetchedAt, addToast]);

  // ── Test de audio global (broadcast desde admin) ──
  useEffect(() => {
    if (!testAudio) return;
    const { tipo } = testAudio;
    if (tipo === 'nuevo_lead') { playNuevoLead(''); addToast('Test global: Nuevo Lead', 'info'); }
    if (tipo === 'sla') { playAlertaSLA(); addToast('Test global: Alerta SLA', 'warning'); }
    if (tipo === 'venta') { playVentaEfectiva(); addToast('Test global: Venta Efectiva', 'success'); }
    if (tipo === 'inicio') { playInicioJornada(); addToast('Test global: Inicio jornada', 'success'); }
    if (tipo === 'fin') { playFinJornada(); addToast('Test global: Fin jornada', 'info'); }
  }, [testAudio, addToast]);

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
    if (prevEnHorario.current === null) {
      prevEnHorario.current = enHorarioHabil;
      return;
    }
    if (enHorarioHabil && !prevEnHorario.current) {
      playInicioJornada();
      addToast('¡Inicio de jornada laboral! Buen día equipo 💪', 'success');
    }
    if (!enHorarioHabil && prevEnHorario.current) {
      playFinJornada();
      addToast('Fin de la jornada laboral. ¡Buen descanso! 🌙', 'info');
    }
    prevEnHorario.current = enHorarioHabil;
  }, [enHorarioHabil, addToast]);

  // ── Acciones admin ──
  const handleForceReload = () => {
    if (confirm('¿Forzar recarga de dashboard en todos los clientes conectados?')) emitForceReload();
  };
  const handleTestGlobal = (tipo) => {
    if (tipo === 'nuevo_lead') playNuevoLead('');
    if (tipo === 'sla') playAlertaSLA();
    if (tipo === 'venta') playVentaEfectiva();
    if (tipo === 'inicio') playInicioJornada();
    if (tipo === 'fin') playFinJornada();
    emitTestAudio(tipo);
  };
  const handleTestAlert = () => {
    playAlertaSLA();
    addToast('Probando alerta crítica de SLA', 'error');
    setTimeout(() => { playNuevoLead('Erimay'); addToast('Probando alerta lead: Erimay', 'info'); }, 1500);
    setTimeout(() => { playNuevoLead('Sthefania'); addToast('Probando alerta lead: Sthefania', 'info'); }, 3000);
    setTimeout(() => { playNuevoLead('Estefany'); addToast('Probando alerta lead: Estefany', 'info'); }, 4500);
    setTimeout(() => { playNuevoLead('Otro'); addToast('Probando alerta lead genérico (beep)', 'info'); }, 6000);
    setTimeout(() => {
      playVentaEfectiva();
      addToast('¡Probando celebración de venta!', 'success');
      const duration = 2500;
      const end = Date.now() + duration;
      const colors = ['#0a5b89', '#1c8a5a', '#bd7a08', '#3257b8', '#7a4fcf'];
      (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    }, 7500);
    setTimeout(() => { playInicioJornada(); addToast('Probando: Inicio de jornada laboral 💪', 'success'); }, 10500);
    setTimeout(() => { playFinJornada(); addToast('Probando: Fin de jornada laboral 🌙', 'info'); }, 12500);
  };

  // ── Filtros / listas ──
  const tiposUnicos = Array.from(new Set(leads.map(l => l.tipo || 'General')));
  const estadosUnicos = Array.from(new Set(leads.map(l => l.estado || 'nuevo')));
  const vendedoresUnicos = Array.from(new Set(leads.filter(l => l.vendedor_nombre).map(l => l.vendedor_nombre)));
  const canalesUnicos = Array.from(new Set(leads.filter(l => l.canal).map(l => l.canal)));
  const estadoCounts = useMemo(() => {
    const c = {};
    leads.forEach(l => { c[l.estado] = (c[l.estado] || 0) + 1; });
    return c;
  }, [leads]);

  const limpiarFiltros = () => {
    setFiltroFecha('mes'); setFiltroEstado(''); setFiltroTipo(''); setFiltroVendedor(''); setFiltroCanal('');
  };
  const activeFilterCount =
    (filtroEstado ? 1 : 0) + (filtroVendedor ? 1 : 0) + (filtroCanal ? 1 : 0) +
    (filtroTipo ? 1 : 0) + (filtroFecha !== 'mes' ? 1 : 0);

  // ── Leads filtrados ──
  const now = new Date();
  const leadsFiltrados = leads.filter(l => {
    const tipoReal = l.tipo || 'General';
    if (filtroTipo !== '' && tipoReal !== filtroTipo) return false;
    if (filtroEstado !== '' && l.estado !== filtroEstado) return false;
    if (filtroVendedor !== '' && l.vendedor_nombre !== filtroVendedor) return false;
    if (filtroCanal !== '' && l.canal !== filtroCanal) return false;

    // Fecha de referencia = fecha efectiva (mueve fines de semana / fuera de horario al
    // siguiente día hábil), con fallback a la fecha de creación.
    const refDate = l.ts_efectivo || l.ts_lead_creado;
    if (!refDate) return true;
    const d = new Date(refDate);
    if (filtroFecha === 'dia') return d.toDateString() === now.toDateString();
    if (filtroFecha === 'semana') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
      minDate.setHours(0, 0, 0, 0);
      return d >= minDate;
    }
    if (filtroFecha === 'mes') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (filtroFecha === 'mes_pasado') {
      const primerDiaMesPasado = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === primerDiaMesPasado.getMonth() && d.getFullYear() === primerDiaMesPasado.getFullYear();
    }
    return true;
  });

  // ── Conteos / SLA ──
  const cerrados = leadsFiltrados.filter(l => ESTADOS_CERRADOS.includes(l.estado)).length;
  const ventasCount = leadsFiltrados.filter(l => l.estado === 'venta_efectiva').length;

  let aTiempo = 0, enRiesgo = 0, atrasados = 0;
  leadsFiltrados.forEach(l => {
    let t;
    if (l.ts_primera_respuesta) t = parseFloat(l.min_primera_respuesta) || 0;
    else if (l._socketAt != null) t = businessMinutesSince(l._socketAt);
    else if (l.min_esperando_respuesta != null) t = parseFloat(l.min_esperando_respuesta) + businessMinutesSince(fetchedAt);
    else t = 0;
    if (t > 20) atrasados++;
    else if (t > 15) enRiesgo++;
    else aTiempo++;
  });
  const total = leadsFiltrados.length;
  const slaPct = total ? Math.round(((aTiempo + enRiesgo) / total) * 100) : 0;

  // ── Series temporales (leads / ventas por hora o por día) ──
  const series = useMemo(() => {
    if (filtroFecha === 'dia') {
      const hours = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18'];
      const idx = h => hours.indexOf(String(h).padStart(2, '0'));
      const L = hours.map(() => 0), V = hours.map(() => 0), B = hours.map(() => 0);
      leadsFiltrados.forEach(l => {
        const ref = l.ts_efectivo || l.ts_lead_creado;
        if (ref) { const i = idx(new Date(ref).getHours()); if (i >= 0) L[i]++; }
        if (l.estado === 'venta_efectiva' && l.ts_cierre) { const i = idx(new Date(l.ts_cierre).getHours()); if (i >= 0) V[i]++; }
      });
      return { labels: hours, leads: L, ventas: V, breach: B };
    }
    const map = new Map();
    leadsFiltrados.forEach(l => {
      const ref = l.ts_efectivo || l.ts_lead_creado;
      if (!ref) return;
      const key = new Date(ref).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, { leads: 0, ventas: 0 });
      const b = map.get(key);
      b.leads++;
      if (l.estado === 'venta_efectiva') b.ventas++;
    });
    const keys = [...map.keys()].sort().slice(-14);
    return {
      labels: keys.map(k => { const d = new Date(k + 'T00:00'); return `${d.getDate()}/${d.getMonth() + 1}`; }),
      leads: keys.map(k => map.get(k).leads),
      ventas: keys.map(k => map.get(k).ventas),
      breach: keys.map(() => 0),
    };
  }, [leadsFiltrados, filtroFecha]);

  // ── KPIs ──
  const kpis = [
    { key: 'leads', label: filtroFecha === 'dia' ? 'Leads hoy' : 'Leads', value: total, icon: 'layers', accent: 'var(--primary)', spark: series.leads, trend: pctChange(series.leads), good: 'up' },
    { key: 'sales', label: 'Ventas efectivas', value: ventasCount, icon: 'check2', accent: 'var(--st-venta)', spark: series.ventas, trend: pctChange(series.ventas), good: 'up' },
    { key: 'sla', label: 'SLA cumplido', value: slaPct, suffix: '%', icon: 'target', accent: 'var(--ok)', good: 'up', note: '1ª resp.' },
  ];

  // ── Embudo ──
  // Ticker derivado de los leads filtrados (respeta filtros) — eventos por estado + alertas SLA
  const tickerItems = useMemo(() => {
    // alertas SLA de 1ª respuesta (pendientes, por vencer o vencidos)
    const slaItems = leadsFiltrados
      .filter(l => l.estado === 'nuevo' && !l.ts_primera_respuesta)
      .map(l => {
        const rem = SLA_RESPUESTA - (getMinutosPrimeraRespuesta(l, fetchedAt) ?? 0);
        if (rem > 5) return null;
        const nombre = l.nombre || 'Lead';
        return rem < 0
          ? { id: 'sla' + l.id, type: 'breach', t: '', pre: 'SLA vencido · ', strong: nombre, post: ' · 1ª resp.' }
          : { id: 'sla' + l.id, type: 'sla', t: '', pre: 'SLA por vencer · ', strong: nombre, post: '' };
      })
      .filter(Boolean);
    // eventos por estado (sin no efectiva / negociación a futuro)
    const estadoItems = leadsFiltrados
      .filter(l => !['no_efectiva', 'negociacion_futuro'].includes(l.estado))
      .slice(0, 16)
      .map(leadToTick);
    return [...slaItems, ...estadoItems];
  }, [leadsFiltrados, fetchedAt]);

  const breakdownViews = useMemo(() => {
    // Por estado
    const estado = STATUS_ORDER.map(key => {
      const m = statusMeta(key);
      return { key, label: m.label, color: m.cvar, n: leadsFiltrados.filter(l => l.estado === key).length };
    });
    // Por canal
    const canalMap = new Map();
    leadsFiltrados.forEach(l => {
      const k = (l.canal || 'Sin canal');
      canalMap.set(k, (canalMap.get(k) || 0) + 1);
    });
    const canal = [...canalMap.entries()]
      .map(([k, n]) => ({ key: k, label: k, color: canalMeta(k).color, icon: canalMeta(k).icon, n }))
      .sort((a, b) => b.n - a.n);
    // Por tipo
    const tipoMap = new Map();
    leadsFiltrados.forEach(l => {
      const k = (l.tipo || 'General');
      tipoMap.set(k, (tipoMap.get(k) || 0) + 1);
    });
    const tipo = [...tipoMap.entries()]
      .map(([k, n], i) => ({ key: k, label: k, color: TIPO_PALETTE[i % TIPO_PALETTE.length], n }))
      .sort((a, b) => b.n - a.n);

    return [
      { id: 'estado', title: 'Por estado', icon: 'funnel', data: estado },
      { id: 'canal', title: 'Por canal', icon: 'globe', data: canal },
      { id: 'tipo', title: 'Por tipo', icon: 'layers', data: tipo },
    ];
  }, [leadsFiltrados]);

  // ── Ranking de vendedores (desde leads filtrados) ──
  const ranking = useMemo(() => {
    const byV = new Map();
    leadsFiltrados.forEach(l => {
      const name = l.vendedor_nombre;
      if (!name) return;
      if (!byV.has(name)) byV.set(name, { name, ventas: 0, leads: 0, ok: 0, total: 0, verde: 0, amarillo: 0, rojo: 0 });
      const v = byV.get(name);
      v.leads++;
      if (l.estado === 'venta_efectiva') v.ventas++;
      let t;
      if (l.ts_primera_respuesta) t = parseFloat(l.min_primera_respuesta) || 0;
      else if (l._socketAt != null) t = businessMinutesSince(l._socketAt);
      else if (l.min_esperando_respuesta != null) t = parseFloat(l.min_esperando_respuesta) + businessMinutesSince(fetchedAt);
      else t = 0;
      v.total++;
      if (t <= 20) v.ok++;
      const nivel = slaLevel(t, SLA_RESPUESTA, 20);
      if (nivel === 'sla-ok') v.verde++;
      else if (nivel === 'sla-warn') v.amarillo++;
      else v.rojo++;
    });
    return [...byV.values()]
      .map(v => ({
        id: v.name, name: v.name, ventas: v.ventas, leads: v.leads,
        sla: v.total ? Math.round(v.ok / v.total * 100) : 0,
        verde: v.verde, amarillo: v.amarillo, rojo: v.rojo,
      }))
      .sort((a, b) => b.ventas - a.ventas || b.leads - a.leads)
      .slice(0, 6);
  }, [leadsFiltrados, fetchedAt]);

  const detalleLeads = useMemo(() => {
    const q = detalleQuery.trim().toLowerCase();
    if (!q) return leadsFiltrados;
    return leadsFiltrados.filter(r =>
      (r.nombre || '').toLowerCase().includes(q) ||
      String(r.id).includes(q) ||
      (r.requerimiento || '').toLowerCase().includes(q) ||
      (r.vendedor_nombre || '').toLowerCase().includes(q) ||
      (r.canal || '').toLowerCase().includes(q));
  }, [leadsFiltrados, detalleQuery]);

  const fechaLabel = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="app">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {showVendedores && <ModalVendedores onClose={() => setShowVendedores(false)} />}

      <Topbar
        conectado={conectado}
        enHorarioHabil={enHorarioHabil}
        theme={theme}
        onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
        onLogout={onLogout}
        onToggleFilters={() => setFiltersOpen(o => !o)}
        filtersOpen={filtersOpen}
        onForceReload={handleForceReload}
        onTestGlobal={handleTestGlobal}
        onTestAlert={handleTestAlert}
        onShowVendedores={() => setShowVendedores(true)}
        onFullscreen={toggleFullscreen}
      />

      <div className={'app__body' + (filtersOpen ? '' : ' filters-closed')}>
        <FilterSidebar
          view={view}
          onSetView={(v) => { setView(v); if (v === 'dashboard') cargarDatos(true); }}
          filtroFecha={filtroFecha} setFiltroFecha={setFiltroFecha}
          filtroEstado={filtroEstado} setFiltroEstado={setFiltroEstado}
          filtroVendedor={filtroVendedor} setFiltroVendedor={setFiltroVendedor}
          filtroCanal={filtroCanal} setFiltroCanal={setFiltroCanal}
          filtroTipo={filtroTipo} setFiltroTipo={setFiltroTipo}
          estadosUnicos={estadosUnicos} tiposUnicos={tiposUnicos}
          vendedoresUnicos={vendedoresUnicos} canalesUnicos={canalesUnicos}
          estadoCounts={estadoCounts} activeCount={activeFilterCount}
          onClear={limpiarFiltros}
        />
        {filtersOpen && <div className="filter-scrim" onClick={() => setFiltersOpen(false)} />}

        <main className="main">
          <div className="main__inner">
            {view === 'dashboard' ? (
              <>
                <LiveTicker items={tickerItems} conectado={conectado} enHorarioHabil={enHorarioHabil} />
                <KpiStrip kpis={kpis} />

                <div className="grid grid--ops">
                  <SellerRanking data={ranking} onVerTodos={isAdmin ? () => setShowVendedores(true) : undefined} />
                  <SlaSemaphore aTiempo={aTiempo} enRiesgo={enRiesgo} atrasados={atrasados} />
                  <CriticalLeads leads={leadsFiltrados} fetchedAt={fetchedAt} onVerDetalle={() => setView('detalle')} />
                </div>

                <div className="grid grid--analysis">
                  <TemporalChart series={series} titulo="Evolución del período" subtitulo={filtroFecha === 'dia' ? 'leads · ventas por hora' : 'leads · ventas por día'} />
                  <Breakdown views={breakdownViews} />
                </div>

                <OperativeTable
                  rows={leadsFiltrados.slice(0, 5)} showSearch={false} totalCount={leadsFiltrados.length}
                  fetchedAt={fetchedAt} isAdmin={isAdmin} newIds={newIds}
                  onVerDetalle={() => setView('detalle')}
                  onEliminar={id => setLeads(prev => prev.filter(l => l.id !== id))}
                />
              </>
            ) : (
              <div className="card">
                <div className="card__head">
                  <span className="card__title"><Icon name="layers" size={17} /> Detalle operativo</span>
                  <div className="card__tools">
                    <button className="card__link" onClick={() => { setView('dashboard'); cargarDatos(true); }}>
                      <Icon name="arrowRight" size={13} style={{ transform: 'rotate(180deg)' }} /> Volver al dashboard
                    </button>
                  </div>
                </div>
                <div className="table-toolbar">
                  <div className="search">
                    <Icon name="search" size={15} />
                    <input placeholder="Buscar lead, cliente, vendedor…" value={detalleQuery} onChange={e => setDetalleQuery(e.target.value)} />
                  </div>
                  <span className="pillcount"><b>{detalleLeads.length}</b> de {leadsFiltrados.length} leads</span>
                </div>
                <div className="card__body" style={{ paddingTop: 0 }}>
                  <div className="tablewrap">
                    <TablaLeads
                      leads={detalleLeads} fetchedAt={fetchedAt} tecnicos={tecnicos} vendedores={vendedores}
                      onActualizar={() => cargarDatos(true)}
                      onEliminar={id => setLeads(prev => prev.filter(l => l.id !== id))}
                      isAdmin={isAdmin}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {isLoading && (
            <div style={{
              position: 'fixed', inset: 'var(--topbar-h) 0 0 0', background: 'color-mix(in srgb, var(--bg) 70%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
            }}>
              <div className="spinner" />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
