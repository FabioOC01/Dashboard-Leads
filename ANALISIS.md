# Análisis del Proyecto Retail-CM

> Generado: 2026-03-25

## 1. Descripción General

**Retail-CM** es un sistema de gestión de leads y dashboard de ventas en tiempo real para **Comutel** (empresa peruana de retail). Los leads entran vía webhooks desde **SendPulse** (CRM externo), pasan por un ciclo de vida con SLAs medidos en horas hábiles, y los resultados se visualizan en un dashboard React en tiempo real.

---

## 2. Arquitectura

```
SendPulse (CRM)
      │ webhook POST (x-webhook-token)
      ▼
Back-Retail  (Node.js / Express 5 / PostgreSQL)
  ├── /webhook/*         → webhookController.js  → ciclo de vida del lead
  ├── /api/leads         → leadsController.js    → lectura + estado manual
  ├── /api/vendedores    → CRUD vendedores
  ├── /panel/:contact_id → HTML para app móvil del vendedor
  └── Socket.io          → push de eventos al dashboard
      │ WS
      ▼
Front-Dashboard  (React 19 / Vite / Recharts)
  └── Gerencia.jsx + componentes → dashboard de gerencia
```

---

## 3. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Node.js, Express 5.2, PostgreSQL |
| Real-time | Socket.io 4.8 |
| Scheduling | node-cron 4.2 |
| Frontend | React 19, Vite 8, Recharts 3.8 |
| HTTP Client | Axios 1.13 |
| DB Driver | pg (raw SQL, sin ORM) |
| Audio | Web Audio API (notificaciones) |

---

## 4. Ciclo de Vida de un Lead

```
NUEVO ──(primera respuesta)──► EN_ATENCION ──(cotización)──► COTIZADO
                                                                  │
                              ┌───────────────────────────────────┤
                              ▼                                   ▼
                       VENTA_EFECTIVA              NEGOCIACION_FUTURO ──(30 días)──► NO_EFECTIVA
                              │                           resultado: futuro
                         resultado: ganado
                              │
                        NO_EFECTIVA
                         resultado: perdido
```

**SLAs:**
- Primera respuesta: **15 minutos** desde `ts_efectivo`
- Cotización enviada: **120 minutos** desde primera respuesta
- Alerta inactividad: **960 minutos hábiles** (2 días) sin cierre post-cotización

**Horas hábiles:**
- Lunes–Viernes: 9:30–18:30
- Sábado: 9:30–14:00
- Feriados peruanos excluidos (tabla `feriados`)

---

## 5. Archivos Clave

| Archivo | Responsabilidad |
|---|---|
| `Back-Retail/schema.sql` | Esquema BD completo, funciones PL/pgSQL, vista metricas |
| `Back-Retail/src/app.js` | Entry point Express + Socket.io + Cron |
| `Back-Retail/src/controllers/webhookController.js` | Lógica de eventos (crear lead, respuesta, cotización, cierre) |
| `Back-Retail/src/controllers/leadsController.js` | Consultas API + actualización manual de estado |
| `Back-Retail/src/jobs/cronJobs.js` | Cron cada hora: alertas inactividad + auto-cierre 30 días |
| `Back-Retail/src/middleware/verificarWebhook.js` | Autenticación por token de webhook |
| `Back-Retail/src/routes/panel.js` | Panel HTML para vendedores móviles |
| `Front-Dashboard/src/pages/Gerencia.jsx` | Dashboard principal (378 líneas) |
| `Front-Dashboard/src/api/leads.js` | Cliente Axios (URL hardcodeada) |
| `Front-Dashboard/src/hooks/useSocket.js` | Hook Socket.io |
| `Front-Dashboard/src/utils/sounds.js` | Sonidos de alerta Web Audio API |

---

## 6. Puntos de Mejora

### 🔴 CRÍTICO — Seguridad

#### S1. Token del webhook expuesto en el panel HTML
**Archivo:** `Back-Retail/src/routes/panel.js` ~línea 102
```js
// ❌ Actualmente
headers: { 'x-webhook-token': 'Comutel.2026.Comutel.2025' }

// ✅ Solución: generar token temporal por sesión, o no exponer al cliente
```
El token que autentica los webhooks de SendPulse está hardcodeado en HTML visible al cliente. Cualquier vendedor puede leerlo desde el código fuente y enviar webhooks falsos.

#### S2. IP hardcodeada en el frontend
**Archivos:** `Front-Dashboard/src/api/leads.js` y `useSocket.js`
```js
// ❌
const API = 'http://192.168.1.166:3000';

// ✅ Crear Front-Dashboard/.env y usar:
const API = import.meta.env.VITE_API_BASE_URL;
```
Sin variables de entorno, el frontend solo funciona en esa LAN específica.

#### S3. Dashboard sin autenticación
Los endpoints `/api/leads` y `/api/leads/metricas` no requieren ningún token. Cualquier persona en la red puede leer todos los leads. Implementar JWT o sesión básica.

#### S4. CORS abierto totalmente
**Archivo:** `Back-Retail/src/app.js`
```js
// ❌
app.use(cors());  // origin: *

// ✅
app.use(cors({ origin: [process.env.DASHBOARD_ORIGIN] }));
```

#### S5. Secretos en .env con patrones predecibles
`WEBHOOK_SECRET=Comutel.2026.Comutel.2025` y `DB_PASSWORD=Comutel.2026` son predecibles y comparten el mismo patrón. Rotar por valores aleatorios: `openssl rand -hex 32`.

---

### 🟠 IMPORTANTE — Calidad y Robustez

#### Q1. Auto-creación silenciosa de vendedores
**Archivo:** `webhookController.js` (todos los handlers)
```js
// Si el vendedor no existe, se crea automáticamente
const { rows: newV } = await pool.query(
  `INSERT INTO vendedores (nombre) VALUES ($1) RETURNING id`, [asesor_asignado]
);
```
Esto genera duplicados por variaciones de nombre (mayúsculas, espacios, tildes). Añadir normalización o validar contra lista aprobada.

#### Q2. Sin validación de entrada en webhooks
No hay validación de campos requeridos (`contact_id`, `nombre`, etc.). Un payload malformado puede insertar datos nulos en la BD. Usar `joi` o `zod`:
```js
const schema = Joi.object({
  contact_id: Joi.string().required(),
  nombre: Joi.string().max(200).required(),
  // ...
});
```

#### Q3. Log del payload completo
**Archivo:** `webhookController.js` línea 1 del handler `leadCreado`
```js
console.log("PAYLOAD COMPLETO DESDE SENDPULSE:", req.body);
```
Loggea datos de contacto (nombre, celular). Usar logger estructurado y filtrar PII.

#### Q4. Sin paginación en `/api/leads`
**Archivo:** `leadsController.js`
Con miles de leads, la consulta carga todo en memoria. Añadir `LIMIT` / `OFFSET` o cursor-based pagination.

#### Q5. Pool de BD sin configuración
**Archivo:** `db/pool.js`
```js
// ❌ Usa defaults (max: 10)
const pool = new Pool({ host, port, database, user, password });

// ✅
const pool = new Pool({ ..., max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000 });
```

#### Q6. Rate limiting solo en webhooks
El endpoint `/api/leads` no tiene rate limiting. Podría ser scrapeado o causar DoS involuntario.

#### Q7. `cotizacionEnviada` no valida estado previo
```js
// Actualiza sin verificar que el lead esté en estado 'en_atencion'
WHERE id = $1 OR sendpulse_contact_id = $2  -- sin filtro de estado
```
Podría registrar cotización en un lead ya cerrado.

---

### 🟡 MEJORAS — Mantenibilidad

#### M1. Variables de entorno en el frontend
Crear `Front-Dashboard/.env` con:
```env
VITE_API_BASE_URL=http://192.168.1.166:3000
```

#### M2. Código duplicado en webhookController (resolve-vendor pattern)
Los 4 handlers repiten el mismo bloque para buscar/crear vendedor. Extraer a función:
```js
async function resolveVendedor(pool, id, nombre) { ... }
```

#### M3. Sin sistema de migraciones
El esquema se gestiona manualmente con `schema.sql`. Con el tiempo esto se complica. Considerar `node-postgres-migrate` o Flyway.

#### M4. Sin tests
`package.json` tiene `"test": "echo \"Error: no test specified\""`. Los controllers son la lógica de negocio crítica y deberían tener tests de integración con BD de prueba.

#### M5. Lógica de negocio mezclada con acceso a datos
Los controllers mezclan validaciones, consultas SQL y emisión de eventos. Separar en capa de servicios haría el código más testeable.

#### M6. `Gerencia.jsx` con 378 líneas — candidato a refactor
Tiene estado, efectos, polling, lógica de filtros y renderizado todo mezclado. Extraer hooks (`useDashboardData`, `useFilters`) y separar secciones.

---

### 🟢 FUTURO — Escalabilidad y Operaciones

#### O1. HTTPS
Actualmente todo va en HTTP. En producción añadir TLS (Let's Encrypt o certificado interno).

#### O2. Logging estructurado
Reemplazar `console.log` con `winston` o `pino` para niveles, contexto y exportación a sistema de logs.

#### O3. Health check del frontend
El backend tiene `/health` pero el dashboard no muestra si está desconectado del socket o si la API falló.

#### O4. Docker / docker-compose
No hay configuración de contenedores. Añadir `Dockerfile` + `docker-compose.yml` facilitaría el despliegue.

#### O5. Métricas cacheadas
La vista `metricas_vendedor` recalcula en cada petición. Para dashboards con múltiples usuarios simultáneos, cachear con Redis (TTL 30s–1min).

#### O6. Rooms en Socket.io
Actualmente todos los eventos se emiten a todos los clientes conectados. Con roles (gerente, supervisor, vendedor) se podrían usar rooms para filtrar qué ve cada uno.

---

## 7. Resumen de Prioridades

| Prioridad | Item | Esfuerzo |
|---|---|---|
| 🔴 Inmediato | S1 — Token expuesto en panel HTML | Bajo |
| 🔴 Inmediato | S2 — IP hardcodeada → variables de entorno | Muy bajo |
| 🔴 Inmediato | S3 — Auth en dashboard API | Medio |
| 🔴 Inmediato | S4/S5 — CORS + rotar secretos | Bajo |
| 🟠 Próxima iteración | Q1 — Normalizar/validar vendedores | Bajo |
| 🟠 Próxima iteración | Q2 — Validación de payload (joi/zod) | Medio |
| 🟠 Próxima iteración | Q4 — Paginación en leads | Bajo |
| 🟠 Próxima iteración | Q7 — Validar estado en cotizacionEnviada | Muy bajo |
| 🟡 Deuda técnica | M2 — Extraer resolveVendedor | Muy bajo |
| 🟡 Deuda técnica | M4 — Tests de integración | Alto |
| 🟡 Deuda técnica | M5 — Capa de servicios | Alto |
| 🟢 Futuro | O1 — HTTPS | Medio |
| 🟢 Futuro | O2 — Logging estructurado | Bajo |
| 🟢 Futuro | O4 — Docker | Medio |
