/* domain.js — mapas de dominio + helpers SLA (minutos hábiles) compartidos */

/* ---- estados del pipeline ---- */
export const STATUSES = {
  nuevo:              { key: 'nuevo',              label: 'Nuevo',             cls: 'st-nuevo',    cvar: 'var(--st-nuevo)' },
  en_atencion:        { key: 'en_atencion',        label: 'En atención',       cls: 'st-atencion', cvar: 'var(--st-atencion)' },
  cotizado:           { key: 'cotizado',           label: 'Cotizado',          cls: 'st-cotizado', cvar: 'var(--st-cotizado)' },
  derivado:           { key: 'derivado',           label: 'Derivado',          cls: 'st-derivado', cvar: 'var(--st-derivado)' },
  cotizado_tecnico:   { key: 'cotizado_tecnico',   label: 'Cot. Técnico',      cls: 'st-tecnico',  cvar: 'var(--st-tecnico)' },
  venta_efectiva:     { key: 'venta_efectiva',     label: 'Venta efectiva',    cls: 'st-venta',    cvar: 'var(--st-venta)' },
  negociacion_futuro: { key: 'negociacion_futuro', label: 'Neg. a futuro',     cls: 'st-futuro',   cvar: 'var(--st-futuro)' },
  no_efectiva:        { key: 'no_efectiva',        label: 'No efectiva',       cls: 'st-noefec',   cvar: 'var(--st-noefec)' },
};
export const STATUS_ORDER = ['nuevo', 'en_atencion', 'cotizado', 'derivado', 'cotizado_tecnico', 'venta_efectiva', 'negociacion_futuro', 'no_efectiva'];
/* estados que forman el embudo de conversión (en orden) */
export const FUNNEL_ORDER = ['nuevo', 'en_atencion', 'cotizado', 'derivado', 'cotizado_tecnico', 'venta_efectiva'];
export const ESTADOS_CERRADOS = ['venta_efectiva', 'no_efectiva', 'negociacion_futuro'];

export function statusMeta(estado) {
  return STATUSES[estado] || { key: estado, label: estado || '—', cls: 'st-nuevo', cvar: 'var(--neutral)' };
}

/* ---- canales (iconos + color, reusados del dashboard actual) ---- */
export const CANAL_META = {
  store:     { color: '#7C3AED', icon: '/canales/odoo.png' },
  whatsapp:  { color: '#1c8a5a', icon: '/canales/whatsapp.png' },
  facebook:  { color: '#3257b8', icon: '/canales/facebook.png' },
  instagram: { color: '#c2387a', icon: 'https://comutelperu.com/correo-cm/Iconos/instagram.png' },
  web:       { color: '#0a5b89', icon: '/canales/web.png' },
  tiktok:    { color: '#64748b', icon: null },
  youtube:   { color: '#d23f3f', icon: null },
};
export function canalMeta(canal) {
  const k = (canal || '').toLowerCase();
  return CANAL_META[k] || { color: 'var(--neutral)', icon: null };
}

/* ---- metas de SLA (minutos hábiles) ---- */
export const SLA_RESPUESTA = 15;
export const SLA_COTIZACION = 240;
export const SLA_SOPORTE = 240;

/* ---- avatar: iniciales + color estable por nombre ---- */
export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
export function avatarColor(name = '') {
  const hue = String(name).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue}, 55%, 42%)`;
}

export function normalizePersonName(name = '') {
  return String(name).trim().replace(/\s+/g, ' ').toLowerCase();
}

/* slug del nombre: minúsculas, sin tildes, espacios -> guion.
   "María Fernanda Villacorta" -> "maria-fernanda-villacorta" */
export function slugNombre(name = '') {
  return String(name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* Fotos locales en public/vendedores/. La clave es el nombre del vendedor
   slugificado (minúsculas, sin tildes, espacios -> guion). Se admite tanto
   el nombre corto que usa la BD ('christian') como el nombre completo
   ('christian-cabrera'). Para añadir uno nuevo: sube la foto a
   public/vendedores/ y agrega su(s) línea(s) aquí. */
export const VENDEDOR_FOTOS = {
  'christian':                 '/vendedores/christian-cabrera.jpeg',
  'christian-cabrera':         '/vendedores/christian-cabrera.jpeg',
  'elias':                     '/vendedores/elias-buitron.png',
  'elias-buitron':             '/vendedores/elias-buitron.png',
  'erimay':                    '/vendedores/erimay-torres.png',
  'erimay-torres':             '/vendedores/erimay-torres.png',
  'estefany':                  '/vendedores/estefany-condori.png',
  'estefany-condori':          '/vendedores/estefany-condori.png',
  'maria-fernanda':            '/vendedores/maria-fernanda-villacorta.jpeg',
  'maria-fernanda-villacorta': '/vendedores/maria-fernanda-villacorta.jpeg',
  'sthefania':                 '/vendedores/sthefania-villalobos.png',
  'sthefania-villalobos':      '/vendedores/sthefania-villalobos.png',
};

export function getVendedorFotoUrl(leadOrSeller = {}, vendedores = []) {
  const rawName = leadOrSeller.vendedor_nombre || leadOrSeller.name || leadOrSeller.nombre || '';

  // La foto local tiene prioridad: reemplaza los foto_url remotos (rotos) de la BD.
  const local = VENDEDOR_FOTOS[slugNombre(rawName)];
  if (local) return local;

  if (leadOrSeller.vendedor_foto_url) return leadOrSeller.vendedor_foto_url;
  if (leadOrSeller.foto_url) return leadOrSeller.foto_url;

  const vendedorId = leadOrSeller.vendedor_id ?? leadOrSeller.id;
  const byId = vendedorId != null ? vendedores.find(v => Number(v.id) === Number(vendedorId)) : null;
  if (byId?.foto_url) return byId.foto_url;

  if (!rawName) return null;
  const name = normalizePersonName(rawName);
  return vendedores.find(v => normalizePersonName(v.nombre) === name)?.foto_url || null;
}

/* =========================================================
   Cálculo de SLA en minutos hábiles (Lima)
   Extraído de TablaLeads.jsx / Gerencia.jsx — fuente única.
   ========================================================= */
export function isHorarioHabil(ts = Date.now()) {
  const t = new Date(new Date(ts).toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const day = t.getDay();
  const min = t.getHours() * 60 + t.getMinutes();
  if (day === 0) return false;
  if (day === 6) return min >= 9 * 60 + 30 && min < 14 * 60;
  return min >= 9 * 60 + 30 && min < 18 * 60 + 30;
}

/* Minutos hábiles reales entre fromTs y ahora (empieza a contar desde las 9:30). */
export function businessMinutesSince(fromTs) {
  if (!isHorarioHabil()) return 0;
  const toLima = t => new Date(new Date(t).toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const fromLima = toLima(fromTs);
  const nowLima = toLima(Date.now());
  const BIZ_START = 9 * 60 + 30;
  const fromMin = fromLima.getHours() * 60 + fromLima.getMinutes() + fromLima.getSeconds() / 60;
  const nowMin = nowLima.getHours() * 60 + nowLima.getMinutes() + nowLima.getSeconds() / 60;
  return Math.max(0, nowMin - Math.max(fromMin, BIZ_START));
}

/* Minutos transcurridos de cada etapa (null si no aplica / aún no inicia el reloj). */
export function getMinutosPrimeraRespuesta(lead, fetchedAt) {
  if (lead.ts_primera_respuesta) {
    if (lead.min_primera_respuesta != null) return parseFloat(lead.min_primera_respuesta);
    return null;
  }
  if (lead._socketAt != null) return businessMinutesSince(lead._socketAt);
  if (lead.min_esperando_respuesta != null) return parseFloat(lead.min_esperando_respuesta) + businessMinutesSince(fetchedAt);
  return null;
}
export function getMinutosCotizacion(lead, fetchedAt) {
  if (lead.min_cotizacion != null && parseFloat(lead.min_cotizacion) > 0) return parseFloat(lead.min_cotizacion);
  if (ESTADOS_CERRADOS.includes(lead.estado)) {
    return lead.min_cotizacion_final != null ? parseFloat(lead.min_cotizacion_final) : null;
  }
  if (lead._cotizacionAt != null) {
    return isHorarioHabil() ? (Date.now() - lead._cotizacionAt) / 60000 : parseFloat(lead.min_esperando_cotizacion) || 0;
  }
  if (lead.min_esperando_cotizacion != null) return parseFloat(lead.min_esperando_cotizacion) + businessMinutesSince(fetchedAt);
  return null;
}
export function getMinutosSoporte(lead, fetchedAt) {
  if (ESTADOS_CERRADOS.includes(lead.estado)) {
    return lead.min_soporte_final != null ? parseFloat(lead.min_soporte_final) : null;
  }
  if (lead.estado === 'cotizado_tecnico') {
    return lead.min_soporte_cotizacion != null ? parseFloat(lead.min_soporte_cotizacion) : null;
  }
  if (lead.estado !== 'derivado') return null;
  if (lead._derivadoAt != null) {
    return isHorarioHabil() ? (Date.now() - lead._derivadoAt) / 60000 : parseFloat(lead.min_esperando_soporte) || 0;
  }
  if (lead.min_esperando_soporte != null) return parseFloat(lead.min_esperando_soporte) + businessMinutesSince(fetchedAt);
  return null;
}

/* Devuelve la etapa de SLA "viva" de un lead abierto: {tipo, meta, transcurrido} o null. */
export function slaActivo(lead, fetchedAt) {
  if (ESTADOS_CERRADOS.includes(lead.estado)) return null;
  if (lead.estado === 'nuevo') {
    const m = getMinutosPrimeraRespuesta(lead, fetchedAt);
    if (m == null) return null;
    return { tipo: 'primera', label: '1ª respuesta', meta: SLA_RESPUESTA, transcurrido: m };
  }
  if (lead.estado === 'derivado') {
    const m = getMinutosSoporte(lead, fetchedAt);
    if (m == null) return null;
    return { tipo: 'tecnico', label: 'Soporte técnico', meta: SLA_SOPORTE, transcurrido: m };
  }
  // en_atencion / cotizado → cotización
  const m = getMinutosCotizacion(lead, fetchedAt);
  if (m == null) return null;
  return { tipo: 'cotizacion', label: 'Cotización', meta: SLA_COTIZACION, transcurrido: m };
}

/* nivel a partir de minutos transcurridos vs meta (para sla-tag). */
export function slaLevel(min, meta, amarilloHasta) {
  if (min == null || isNaN(min)) return 'sla-closed';
  if (min <= meta * 0.75) return 'sla-ok';
  if (min <= (amarilloHasta ?? meta)) return 'sla-warn';
  return 'sla-danger';
}
