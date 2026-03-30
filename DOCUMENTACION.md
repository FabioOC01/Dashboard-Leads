# Retail-CM — Documentación Técnica

**Sistema de gestión de leads y dashboard de ventas en tiempo real para Comutel Perú.**

---

## Índice

1. [Visión General](#1-visión-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Backend — Back-Retail](#3-backend--back-retail)
   - [Stack y dependencias](#31-stack-y-dependencias)
   - [Estructura de archivos](#32-estructura-de-archivos)
   - [Servidor (app.js)](#33-servidor-appjs)
   - [Base de datos — Schema](#34-base-de-datos--schema)
   - [Funciones PL/pgSQL](#35-funciones-plpgsql)
   - [Controladores](#36-controladores)
   - [Rutas](#37-rutas)
   - [Panel Móvil](#38-panel-móvil)
   - [Cron Jobs](#39-cron-jobs)
   - [Socket.io — Eventos](#310-socketio--eventos)
4. [Frontend — Front-Dashboard](#4-frontend--front-dashboard)
   - [Stack y dependencias](#41-stack-y-dependencias)
   - [Estructura de archivos](#42-estructura-de-archivos)
   - [Página principal (Gerencia.jsx)](#43-página-principal-gerenciajsx)
   - [Componentes](#44-componentes)
   - [Hooks y utilidades](#45-hooks-y-utilidades)
   - [Temas (dark / light)](#46-temas-dark--light)
5. [Ciclo de vida de un Lead](#5-ciclo-de-vida-de-un-lead)
6. [Sistema SLA](#6-sistema-sla)
7. [Horario hábil y zonas horarias](#7-horario-hábil-y-zonas-horarias)
8. [Flujo de datos en tiempo real](#8-flujo-de-datos-en-tiempo-real)
9. [API Reference](#9-api-reference)
10. [Configuración y despliegue](#10-configuración-y-despliegue)
11. [Deuda técnica y mejoras pendientes](#11-deuda-técnica-y-mejoras-pendientes)

---

## 1. Visión General

Retail-CM es un sistema interno de Comutel para:

- **Recibir leads** provenientes de SendPulse (CRM externo) vía webhooks
- **Monitorear en tiempo real** el estado y cumplimiento SLA de cada lead desde un dashboard gerencial
- **Permitir a los vendedores** registrar acciones (primera respuesta, cotización, cierre) desde el móvil sin acceso al CRM

El sistema tiene dos partes independientes que se comunican vía HTTP + WebSocket:

| Parte | Tecnología | Puerto |
|-------|-----------|--------|
| Back-Retail | Node.js + PostgreSQL | 3000 |
| Front-Dashboard | React 19 + Vite | 5173 (dev) |

---

## 2. Arquitectura del Sistema

```
SendPulse (CRM externo)
        │
        │ POST /webhook/lead-creado
        │ (x-webhook-token auth)
        ▼
┌─────────────────────────────────────────┐
│           Back-Retail (Node.js)         │
│                                         │
│  Express 5   ─►  webhookController      │
│                       │                 │
│                  PostgreSQL DB          │
│                  (leads, vendedores,    │
│                   eventos_lead)         │
│                       │                 │
│  Socket.io  ◄─────────┘                 │
│      │                                  │
│  Cron Jobs (hourly)                     │
│  /panel/:id  (panel móvil HTML)         │
└──────────────────────────────────────── ┘
        │ WebSocket
        │ REST /api/leads
        ▼
┌─────────────────────────────────────────┐
│        Front-Dashboard (React)          │
│                                         │
│  Gerencia.jsx (página principal)        │
│    ├── KPI cards (TarjetaMetrica)       │
│    ├── Gráficos (Recharts + custom)     │
│    ├── SLA por vendedor (DashboardTec.) │
│    └── Tabla de leads (TablaLeads)      │
│                                         │
│  useSocket.js (Socket.io client)        │
│  api/leads.js (Axios HTTP client)       │
└─────────────────────────────────────────┘
        │ HTTP GET /panel/:contact_id
        ▼
┌─────────────────────────────────────────┐
│         Panel Móvil del Vendedor        │
│  (HTML renderizado en el servidor)      │
│  Acciones: responder / cotizar / cerrar │
└─────────────────────────────────────────┘
```

---

## 3. Backend — Back-Retail

### 3.1 Stack y dependencias

```json
{
  "express": "^5.2.1",
  "pg": "^8.20.0",
  "socket.io": "^4.8.3",
  "node-cron": "^4.2.1",
  "cors": "*",
  "dotenv": "*",
  "express-rate-limit": "*"
}
```

**Node.js** — Runtime principal
**Express 5** — Framework HTTP (async/await nativo en middlewares)
**pg** — Driver PostgreSQL para Node.js
**Socket.io** — WebSockets bidireccionales para actualizaciones en tiempo real
**node-cron** — Tareas programadas (inactividad, auto-cierre)
**express-rate-limit** — Protección de endpoint webhook (60 req/min)

### 3.2 Estructura de archivos

```
Back-Retail/
├── src/
│   ├── app.js                  # Entry point, servidor Express + Socket.io
│   ├── db/
│   │   └── pool.js             # Pool de conexiones PostgreSQL
│   ├── routes/
│   │   ├── webhook.js          # POST /webhook/*
│   │   ├── leads.js            # GET/PATCH /api/leads/*
│   │   ├── vendedores.js       # GET /api/vendedores
│   │   └── panel.js            # GET+POST /panel/:contact_id
│   ├── controllers/
│   │   ├── webhookController.js # Lógica de ciclo de vida del lead
│   │   └── leadsController.js   # Queries del dashboard
│   ├── socket.js               # Inicialización Socket.io
│   └── jobs/
│       └── cronJobs.js         # Tareas horarias automáticas
├── schema.sql                  # Schema completo de la DB
├── .env                        # Variables de entorno (no en git)
└── package.json
```

### 3.3 Servidor (app.js)

El servidor realiza las siguientes tareas al arrancar:

1. Crea la app Express y el servidor HTTP
2. Monta Socket.io con `cors: { origin: '*' }` (ver deuda técnica)
3. Aplica middlewares globales: CORS, JSON parser
4. Configura rate limiter (60 req/min) solo en `/webhook`
5. Inyecta el objeto `io` en `req` para que los controllers puedan emitir eventos
6. Registra todas las rutas
7. Inicializa Socket.io y los cron jobs
8. Escucha en `0.0.0.0:3000`

```
Variables de entorno requeridas:
  DATABASE_URL=postgres://user:pass@host:5432/dbname
  PORT=3000 (opcional, default 3000)
  WEBHOOK_TOKEN=<token_de_sendpulse>
```

### 3.4 Base de datos — Schema

#### Tabla `vendedores`
```sql
id          SERIAL PRIMARY KEY
nombre      VARCHAR(100) NOT NULL
email       VARCHAR(100)
whatsapp    VARCHAR(20)
```
Los vendedores se crean automáticamente en el primer webhook si no existen.

#### Tabla `feriados`
```sql
fecha  DATE PRIMARY KEY
nombre VARCHAR(100)
```
Contiene feriados peruanos 2025–2026. Usado por `business_minutes()` para excluir días no laborables.

#### Tabla `leads` (principal)
```sql
id                          SERIAL PRIMARY KEY
sendpulse_contact_id        VARCHAR(100) UNIQUE  -- ID del contacto en SendPulse
nombre                      VARCHAR(200)
celular                     VARCHAR(30)
canal                       VARCHAR(50)          -- WhatsApp, Instagram, Facebook, etc.
campana                     VARCHAR(100)
requerimiento               TEXT
tipo                        VARCHAR(100)         -- Categoría del pedido
notas                       TEXT
vendedor_id                 INTEGER FK vendedores
estado                      VARCHAR(30)          -- Ver ciclo de vida
resultado                   VARCHAR(30)          -- ganado | futuro | perdido | null
alerta_inactividad_enviada  BOOLEAN DEFAULT false
ts_lead_creado              TIMESTAMP            -- Momento real de creación
ts_efectivo                 TIMESTAMP            -- Primer momento hábil (calculado por siguiente_momento_habil)
ts_primera_respuesta        TIMESTAMP            -- Cuando el vendedor marcó atención
ts_cotizacion_enviada       TIMESTAMP
ts_cierre                   TIMESTAMP
```

#### Tabla `eventos_lead` (auditoría)
```sql
id          SERIAL PRIMARY KEY
lead_id     INTEGER FK leads
vendedor_id INTEGER FK vendedores
tipo        VARCHAR(50)   -- lead_creado | primera_respuesta | cotizacion_enviada | cierre | alerta_inactividad | auto_cierre_30_dias
metadata    JSONB
created_at  TIMESTAMP DEFAULT NOW()
```
Registro inmutable de cada acción realizada sobre un lead.

#### Vista `metricas_vendedor`
Agrega métricas KPI por vendedor:
- Total leads asignados
- % SLA primera respuesta (≤15 min)
- Tiempo promedio de primera respuesta en minutos de negocio
- Tiempo promedio de cotización
- Conteo por estado (ventas, en negociación, perdidos)

### 3.5 Funciones PL/pgSQL

#### `siguiente_momento_habil(ts TIMESTAMP) → TIMESTAMP`

Recibe un timestamp y devuelve el primer momento dentro de horario hábil:

| Día | Horario hábil |
|-----|---------------|
| Lunes – Viernes | 09:30 – 18:30 |
| Sábado | 09:30 – 14:00 |
| Domingo / Feriado | No hábil → lunes/día siguiente 09:30 |

- Si `ts` cae dentro del horario → devuelve el mismo `ts`
- Si cae fuera → devuelve el inicio del próximo bloque hábil
- Excluye fechas en la tabla `feriados`

Esta función se llama al crear un lead para establecer `ts_efectivo`, que es la referencia real del reloj SLA.

#### `business_minutes(desde TIMESTAMP, hasta TIMESTAMP) → NUMERIC`

Calcula la cantidad de minutos **hábiles** entre dos timestamps, excluyendo:
- Fuera del horario hábil (antes de 09:30 y después de 18:30/14:00)
- Sábados después de 14:00
- Domingos
- Feriados de la tabla `feriados`

Retorna `NULL` si alguno de los argumentos es `NULL` (comportamiento `STRICT`).

**Uso en queries:**
```sql
-- Tiempo que tomó la primera respuesta (minutos de negocio)
business_minutes(ts_efectivo, ts_primera_respuesta) AS min_primera_respuesta

-- Minutos esperando primera respuesta actualmente
business_minutes(ts_efectivo, NOW()) AS min_esperando_respuesta

-- Minutos esperando cotización actualmente
business_minutes(ts_primera_respuesta, NOW()) AS min_esperando_cotizacion
```

### 3.6 Controladores

#### `webhookController.js`

Cuatro funciones que cubren el ciclo de vida del lead:

**`leadCreado(req, res)`**
- Busca o crea el `vendedor_id` por nombre (`ILIKE`)
- Calcula `ts_efectivo` con `siguiente_momento_habil(NOW())`
- Inserta el lead en estado `nuevo`
- Registra evento `lead_creado`
- Emite `lead:nuevo` vía Socket.io

**`vendedorRespondio(req, res)`**
- Busca el lead por `lead_id` o `sendpulse_contact_id`
- Actualiza `ts_primera_respuesta = NOW()`, `estado = 'en_atencion'`
- Guard: solo actúa si `ts_primera_respuesta IS NULL` (idempotente)
- Registra evento `primera_respuesta`
- Emite `lead:actualizado`

**`cotizacionEnviada(req, res)`**
- Actualiza `ts_cotizacion_enviada = NOW()`, `estado = 'cotizado'`
- Registra evento `cotizacion_enviada`
- Emite `lead:actualizado`

**`leadCerrado(req, res)`**
- Actualiza `estado` (venta_efectiva | negociacion_futuro | no_efectiva), `resultado`, `ts_cierre`
- Registra evento `cierre` con metadata `{ estado, resultado }`
- Emite `lead:cerrado`

> **Nota:** Todos los controladores aceptan el lead por `lead_id` (int) O por `sendpulse_contact_id` (string), ya que SendPulse puede no enviar el ID interno.

#### `leadsController.js`

**`getLeads(req, res)`** — `GET /api/leads?desde=YYYY-MM-DD`

Devuelve leads con campos calculados:
```sql
SELECT
  l.*,
  v.nombre AS vendedor_nombre,
  business_minutes(ts_efectivo, ts_primera_respuesta)    AS min_primera_respuesta,
  business_minutes(ts_primera_respuesta, ts_cotizacion)  AS min_cotizacion,
  CASE WHEN ts_primera_respuesta IS NULL
    THEN business_minutes(ts_efectivo, NOW())
  END AS min_esperando_respuesta,
  CASE WHEN ts_primera_respuesta IS NOT NULL AND ts_cotizacion IS NULL
    THEN business_minutes(ts_primera_respuesta, NOW())
  END AS min_esperando_cotizacion
FROM leads l LEFT JOIN vendedores v ...
WHERE estado NOT IN ('venta_efectiva','no_efectiva')  -- siempre activos
   OR $1::date IS NULL                                 -- o sin filtro de fecha
   OR ts_lead_creado >= $1::date                       -- o dentro del rango
ORDER BY ts_lead_creado DESC
```

La lógica del filtro de fecha garantiza que los leads activos (no cerrados) **siempre aparecen** en el dashboard sin importar el filtro de periodo, para no perder alertas SLA.

**`getMetricas(req, res)`** — `GET /api/leads/metricas`
Lee directamente la vista `metricas_vendedor`.

**`actualizarEstado(req, res)`** — `PATCH /api/leads/:id/estado`
Actualización manual de estado desde la tabla del dashboard.

### 3.7 Rutas

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/webhook/lead-creado` | `x-webhook-token` header | Nuevo lead desde SendPulse |
| POST | `/webhook/vendedor-respondio` | `x-webhook-token` header | Primera respuesta |
| POST | `/webhook/cotizacion-enviada` | `x-webhook-token` header | Cotización enviada |
| POST | `/webhook/lead-cerrado` | `x-webhook-token` header | Cierre del lead |
| GET | `/api/leads` | Ninguna | Leads con SLA calculado |
| GET | `/api/leads/metricas` | Ninguna | Métricas por vendedor |
| PATCH | `/api/leads/:id/estado` | Ninguna | Cambio manual de estado |
| GET | `/api/vendedores` | Ninguna | Lista de vendedores |
| GET | `/panel/:contact_id` | Ninguna | Panel HTML del vendedor |
| POST | `/panel/:contact_id/accion` | Ninguna | Marcar primera respuesta |
| POST | `/panel/:contact_id/cotizacion` | Ninguna | Marcar cotización |
| POST | `/panel/:contact_id/cerrar` | Ninguna | Cerrar lead |
| GET | `/health` | Ninguna | Health check |

### 3.8 Panel Móvil

Accesible en `http://192.168.1.166:3000/panel/:sendpulse_contact_id`

El servidor renderiza una página HTML responsive directamente en el request. Muestra:
- Información del lead (nombre, celular, requerimiento, canal, vendedor)
- Badge de estado con los colores del sistema
- Botones de acción según el estado actual:
  - `nuevo` → "Iniciar atención"
  - `en_atencion` → "Cotización enviada"
  - `en_atencion` / `cotizado` → "Venta efectiva", "Negociación a futuro", "No efectiva"
  - `venta_efectiva` / `no_efectiva` → Mensaje "Lead cerrado"

Las acciones envían `POST` a rutas del mismo servidor (`/panel/:id/accion`, etc.) que llaman directamente a los controllers. **El token de autenticación nunca llega al cliente.**

### 3.9 Cron Jobs

Se ejecutan **cada hora, lunes a sábado** (`0 * * * 1-6`).

**`verificarInactividad()`**
```sql
SELECT ... FROM leads
WHERE estado = 'cotizado'
  AND alerta_inactividad_enviada = false
  AND business_minutes(ts_primera_respuesta, NOW()) >= 960
```
- 960 min = 2 días hábiles (2 × 8h × 60min)
- Actualiza `alerta_inactividad_enviada = true` (no se repite)
- Registra evento `alerta_inactividad`
- Emite `lead:alerta_inactividad` al dashboard (aparece como toast de advertencia)

**`cerrarNegociacionesFuturo()`**
```sql
UPDATE leads SET estado='no_efectiva', resultado='perdido', ts_cierre=NOW()
WHERE estado = 'negociacion_futuro'
  AND NOW() - creado_en > INTERVAL '30 days'
```
- Cierra automáticamente leads en negociación sin resolución por más de 30 días
- Registra evento `auto_cierre_30_dias`
- Emite `lead:cerrado` por cada lead cerrado

### 3.10 Socket.io — Eventos

El servidor emite los siguientes eventos al canal global (broadcast a todos los clientes):

| Evento | Cuándo se emite | Payload |
|--------|-----------------|---------|
| `lead:nuevo` | `webhookController.leadCreado` | Objeto `lead` completo (`RETURNING *` + `vendedor_nombre`) |
| `lead:actualizado` | `vendedorRespondio`, `cotizacionEnviada`, `actualizarEstado` | Objeto `lead` actualizado |
| `lead:cerrado` | `leadCerrado`, `cerrarNegociacionesFuturo` | Objeto `lead` cerrado |
| `lead:alerta_inactividad` | `verificarInactividad` (cron) | `{ id, nombre, vendedor_id, vendedor_nombre }` |

> **Importante:** Los eventos de socket emiten el resultado de `RETURNING *` de PostgreSQL, que **no incluye** los campos calculados (`min_primera_respuesta`, `min_esperando_respuesta`, etc.). El frontend maneja esto con `_socketAt` y `min_esperando_respuesta: 0` para el timer en vivo.

---

## 4. Frontend — Front-Dashboard

### 4.1 Stack y dependencias

```json
{
  "react": "^19.2.4",
  "vite": "^8.0.1",
  "recharts": "^3.8.0",
  "axios": "^1.13.6",
  "socket.io-client": "^4.8.3"
}
```

**React 19** — UI con hooks
**Vite 8** — Bundler y dev server
**Recharts** — Gráficos (GraficoEstados, GraficoSLA, GraficoTiempo)
**Axios** — Cliente HTTP para la API
**Socket.io-client** — Conexión WebSocket al backend

### 4.2 Estructura de archivos

```
Front-Dashboard/
├── src/
│   ├── pages/
│   │   └── Gerencia.jsx         # Página única del dashboard
│   ├── components/
│   │   ├── TablaLeads.jsx       # Tabla de leads con semáforos SLA
│   │   ├── DashboardTecnicos.jsx# SLA por vendedor (barras de progreso)
│   │   ├── TarjetaMetrica.jsx   # KPI cards (Leads Nuevos, en Atención, etc.)
│   │   ├── Semaforo.jsx         # Indicador de tiempo SLA (verde/amarillo/rojo)
│   │   ├── GraficoEstados.jsx   # Donut chart por estado
│   │   ├── GraficoBarrasTop.jsx # Ranking horizontal (Tipos, Canales)
│   │   ├── GraficoSLA.jsx       # Gauge semicircular % cumplimiento
│   │   ├── GraficoTiempo.jsx    # Área temporal de volumen de leads
│   │   └── ToastContainer.jsx   # Notificaciones pop-up
│   ├── hooks/
│   │   └── useSocket.js         # Hook para eventos Socket.io
│   ├── api/
│   │   └── leads.js             # Funciones Axios (getLeads, getMetricas, updateEstadoLead)
│   ├── utils/
│   │   └── sounds.js            # Sonidos Web Audio API (sin archivos externos)
│   └── index.css                # Variables CSS, clases globales, animaciones
├── .env                         # VITE_API_URL
├── vite.config.js
└── package.json
```

### 4.3 Página principal (Gerencia.jsx)

Componente raíz de ~430 líneas que orquesta todo el dashboard.

#### Estado interno

| Estado | Tipo | Descripción |
|--------|------|-------------|
| `leads` | `Lead[]` | Array completo de leads cargados |
| `metricas` | `Metrica[]` | Datos de la vista metricas_vendedor |
| `filtroFecha` | `'dia'│'semana'│'mes'│'todos'` | Filtro temporal activo |
| `filtroEstado` | `string` | Filtro de estado activo ('' = todos) |
| `filtroTipo` | `string` | Filtro de tipo/motivo |
| `filtroVendedor` | `string` | Filtro de vendedor |
| `filtroCanal` | `string` | Filtro de canal |
| `fetchedAt` | `number` | `Date.now()` de la última carga API (usado para calcular `elapsed`) |
| `isLoading` | `boolean` | Muestra spinner overlay durante carga |
| `theme` | `'dark'│'light'` | Tema visual activo |
| `isSidebarOpen` | `boolean` | Sidebar de filtros visible/oculto |
| `currentTime` | `Date` | Reloj en tiempo real (tick cada 1s) |

#### Carga de datos (`cargarDatos`)

```
cargarDatos() [useCallback, dep: filtroFecha]
  │
  ├── Calcula `desde`:
  │     dia    → hoy YYYY-MM-DD
  │     semana → hace 7 días
  │     mes    → 1° del mes actual
  │     todos  → null (sin filtro)
  │
  ├── setIsLoading(true)
  ├── Promise.all([getLeads(desde), getMetricas()])
  ├── setLeads / setMetricas / setFetchedAt / setUltimaActualizacion
  └── setIsLoading(false) [en finally]
```

Nota: el filtro de fecha es solo para leads cerrados. Los leads activos siempre se devuelven desde la API (lógica en `leadsController`).

#### Actualización por socket

Cuando llega un evento de socket (`ultimoEvento` cambia):

```
lead:nuevo
  → dataEnriquecida = { ...data, min_esperando_respuesta: 0, _socketAt: Date.now() }
     (solo si !ts_primera_respuesta, para que el timer de 1ra respuesta arranque desde 0)
  → Agregar al array si no existe
  → Ordenar por ts_lead_creado DESC
  → getMetricas() silencioso
  → Toast + sonido playNuevoLead()

lead:actualizado
  → dataEnriquecida = { ...data } (sin _socketAt si ya tiene ts_primera_respuesta)
  → Reemplazar el lead en el array (spread: { ...prev, ...nuevo })
  → getMetricas() silencioso

lead:cerrado
  → Mismo que actualizado

lead:alerta_inactividad
  → Toast de advertencia (amarillo)
```

#### Cálculo de KPIs

```javascript
// Sobre leadsFiltrados (post-filtros):
activos   = count(estado === 'nuevo')
total     = leadsFiltrados.length
aTiempo   = leads donde tiempo primera respuesta ≤ 15 min
atrasados = leads donde tiempo primera respuesta > 15 min
```

El cálculo de `aTiempo`/`atrasados` usa la misma lógica de timer que `TablaLeads`:
- Si tiene `min_primera_respuesta` → valor fijo de DB
- Si tiene `min_esperando_respuesta` → `min_esperando_respuesta + elapsedMin`
- Sino → cálculo directo desde timestamps

#### Alertas SLA (check cada 30s)

```
Para cada lead en leads:
  Si estado='nuevo' y no alertado:
    calcular t = minutos esperando primera respuesta
    Si 10 ≤ t < 15 → toast + sonido (SLA por vencer, quedan N min)

  Si estado='en_atencion' y no alertado:
    calcular t = minutos esperando cotización
    Si 115 ≤ t < 120 → toast + sonido
```

El `alertedLeads` es un `Set` en `useRef` que sobrevive re-renders pero no persiste entre recargas de página.

#### Filtros (sidebar)

El sidebar izquierdo (240px, colapsable) tiene 5 `FilterGroup` con flechas desplegables:

- **Tiempo** (abierto por defecto): Hoy / Esta semana / Este mes / Histórico
- **Estado** (cerrado por defecto): Todos + estados únicos de los leads cargados
- **Categoría / Motivo** (cerrado): Todos + tipos únicos
- **Vendedor** (cerrado): Todos + vendedores únicos
- **Canal** (cerrado): Todos + canales únicos

Los filtros de estado/tipo/vendedor/canal son cliente-side sobre el array `leads` ya cargado. El filtro de fecha dispara una nueva llamada a la API.

### 4.4 Componentes

#### `TablaLeads`

Props: `leads`, `fetchedAt`

Tabla con columnas: Cliente, Tipo/Campaña, Vendedor, Canal, Requerimiento, Estado (editable), 1ra Respuesta (Semaforo), Cotización (Semaforo), Fecha.

**Timer tick:** `setInterval` 1s interno que fuerza re-renders para que `Date.now()` sea fresco.

**Cálculo de minutos de primera respuesta:**
```javascript
getMinutosPrimeraRespuesta(lead, elapsed):
  1. Si ts_primera_respuesta está seteado (lead ya atendido):
     → usar min_primera_respuesta de DB (fijo, sin moverse)
     → si no disponible → null (muestra '—')
  2. Si _socketAt está seteado (lead llegó por socket):
     → (Date.now() - _socketAt) / 60000  [avanza cada segundo]
  3. Si min_esperando_respuesta está seteado (cargado por API):
     → min_esperando_respuesta + elapsed  [elapsed crece con tick]
  4. Sino → null
```

**Cálculo de minutos de cotización:**
```javascript
getMinutosCotizacion(lead, elapsed):
  1. Si min_cotizacion > 0 → valor fijo
  2. Si min_esperando_cotizacion != null → min_esperando_cotizacion + elapsed
  3. Si ts_primera_respuesta y !ts_cotizacion_enviada:
     → (Date.now() - parseTS(ts_primera_respuesta)) / 60000
  4. Sino → null
```

`parseTS(ts)`: reemplaza el espacio en timestamps PostgreSQL (`"2026-03-26 18:30:00"`) por `'T'` para compatibilidad cross-browser.

`elapsed`: minutos calendario desde `fetchedAt`. Crece con cada tick de 1s.

**Edición de estado inline:** El `<select>` en cada fila llama `updateEstadoLead(id, nuevoEstado)` al cambiar.

---

#### `DashboardTecnicos`

Props: `leads`, `fetchedAt`

Muestra una tarjeta por vendedor con:
- **Avatar** con iniciales (colores consistentes por índice)
- **Nombre** del vendedor
- **Barra de progreso SLA** (% leads atendidos a tiempo)
  - Verde ≥ 80%, Naranja ≥ 50%, Rojo < 50%
- **Pills de estadísticas**: ✓ a tiempo | ✗ atrasados | 📋 cotizados

Tiene su propio tick de 1s para actualizar tiempos en vivo de los leads de cada vendedor.

---

#### `TarjetaMetrica`

Props: `titulo`, `valor`, `accentColor`, `icon`, `subtitulo`

KPI card con borde superior del `accentColor`. El `icon` puede ser una URL de imagen o un emoji. Muestra `valor` en tamaño grande.

Colores usados:
| Métrica | Color |
|---------|-------|
| Leads Nuevos | `#1B4F72` (azul oscuro) |
| Leads en Atención | `#D97706` (amarillo) |
| Leads a Tiempo | `var(--color-green)` |
| Leads Atrasados | `var(--color-red)` |

---

#### `Semaforo`

Props: `minutos`, `meta`, `tipo`

Indicador de tiempo con colores semafóricos:

| Condición | Color |
|-----------|-------|
| `minutos ≤ meta` | Verde |
| `meta < minutos ≤ 2×meta` | Amarillo |
| `minutos > 2×meta` | Rojo |
| `minutos == null/NaN` | Gris (`'—'`) |

Formato de tiempo: `Xh Ym Zs`, `Ym Zs`, o `Zs`. Si `minutos ≤ 0` muestra `'0s'`.

---

#### `GraficoEstados`

Donut chart (Recharts `PieChart`) con los 6 estados del lead.

Paleta fija:
```javascript
nuevo:              '#1B4F72'  // Azul
en_atencion:        '#D97706'  // Amarillo
cotizado:           '#E67E22'  // Naranja
venta_efectiva:     '#27AE60'  // Verde
negociacion_futuro: '#8E44AD'  // Púrpura
no_efectiva:        '#E74C3C'  // Rojo
```

---

#### `GraficoBarrasTop`

Props: `data` (`[{name, value}]`), `color`

Componente custom (sin Recharts) que muestra un ranking de hasta 4 items:
- Badge de rango (🥇🥈🥉 gris)
- Nombre del item
- Barra proporcional al máximo (el 1° siempre llega al 100%)
- Valor numérico
- El primer puesto tiene fondo y borde destacado

---

#### `GraficoSLA`

Semi-donut gauge (Recharts) mostrando `aTiempo/total * 100` como porcentaje. Si no hay datos, muestra `'—'`.

---

#### `GraficoTiempo`

Area chart (Recharts) con gradiente. Agrupa leads por:
- `dia` → por hora (HH:00)
- `semana` → por día (DD/MM)
- `mes` → por día del mes
- `todos` → por mes (MM/YYYY)

---

#### `ToastContainer` + `useToasts`

Sistema de notificaciones pop-up en esquina inferior derecha.

`useToasts()` devuelve `{ toasts, addToast, removeToast }`.

Tipos: `'success'` (verde), `'warning'` (amarillo), `'danger'` (rojo), `'info'` (azul).

Auto-cierre a los **5 segundos** con animación `slideIn`.

---

### 4.5 Hooks y utilidades

#### `useSocket.js`

Socket único (singleton fuera del componente). Se conecta a `import.meta.env.VITE_API_URL`.

```javascript
// Retorna:
{
  ultimoEvento: { tipo: 'nuevo'|'actualizado'|'cerrado'|'alerta', data: {} } | null,
  conectado: boolean
}
```

Eventos escuchados: `connect`, `disconnect`, `connect_error`, `lead:nuevo`, `lead:actualizado`, `lead:cerrado`, `lead:alerta_inactividad`.

---

#### `api/leads.js`

```javascript
getLeads(desde)        // GET /api/leads?desde=YYYY-MM-DD
getMetricas()          // GET /api/leads/metricas
updateEstadoLead(id, estado) // PATCH /api/leads/:id/estado
```

Base URL: `import.meta.env.VITE_API_URL` (definido en `.env`).

---

#### `utils/sounds.js`

Genera sonidos usando la Web Audio API (sin archivos externos):

- `playNuevoLead()`: Dos beeps ascendentes (880 Hz, onda seno, 0.15s)
- `playAlertaSLA()`: Tres tonos urgentes (440 Hz, onda cuadrada, 0.15s)

Cada llamada crea un `AudioContext` nuevo para evitar bloqueos por política de autoplay.

---

### 4.6 Temas (dark / light)

Se manejan con CSS custom properties en `index.css`. El tema se aplica con `data-theme="dark"` en `document.body`.

| Variable | Light | Dark |
|----------|-------|------|
| `--bg-main` | `#F4F6F8` | `#13151A` |
| `--bg-card` | `#FFFFFF` | `#1F2128` |
| `--text-main` | `#333333` | `#F3F4F6` |
| `--text-muted` | `#888888` | `#9CA3AF` |
| `--header-bg` | `#FFFFFF` | `#1A1C23` |
| `--header-text` | `#333333` | `#FFFFFF` |
| `--filter-bg` | `#F4F6F8` | `#2D303E` |
| `--filter-active` | `#1B4F72` | `#4F46E5` |
| `--border` | `#EEEEEE` | `#2D303E` |
| `--color-green` | `#27AE60` | `#10B981` |
| `--color-red` | `#E74C3C` | `#EF4444` |
| `--color-yellow` | `#F1C40F` | `#F59E0B` |

---

## 5. Ciclo de vida de un Lead

```
SendPulse                Backend                  Dashboard
    │                       │                         │
    │── POST /webhook ──────►│                         │
    │   lead-creado          │── INSERT leads ─────────►│
    │                        │   estado='nuevo'        │
    │                        │── emit lead:nuevo ──────►│ Toast + sonido
    │                        │                         │ Timer 1ra resp. arranca
    │                        │
    │ (Vendedor abre panel)  │
    │── GET /panel/:id ──────►│ HTML
    │◄────────── HTML ───────│
    │                        │
    │── POST /panel/accion ──►│── UPDATE estado='en_atencion'
    │                        │── emit lead:actualizado ►│ Timer 1ra resp. se fija
    │                        │                         │ Timer cotización arranca
    │                        │
    │── POST /panel/cotizacion►│── UPDATE estado='cotizado'
    │                        │── emit lead:actualizado ►│
    │                        │
    │── POST /panel/cerrar ──►│── UPDATE estado='venta_efectiva' | 'negociacion_futuro' | 'no_efectiva'
    │                        │── emit lead:cerrado ─────►│ Lead desaparece del activo
    │                        │
    │                  [CRON hourly]
    │                        │── Si cotizado > 960 min
    │                        │── emit lead:alerta_inactividad ►│ Toast amarillo
    │                        │
    │                        │── Si negociacion_futuro > 30 días
    │                        │── auto-cierre no_efectiva
    │                        │── emit lead:cerrado ─────►│
```

### Estados posibles

```
nuevo ──────────────────────────► en_atencion ──► cotizado ──┐
  │                                    │                      ├──► venta_efectiva
  │                                    │                      ├──► negociacion_futuro ──► (30 días) ──► no_efectiva
  │                                    └──────────────────────┴──► no_efectiva
  └── (si el vendedor cierra directamente sin atender) [no implementado]
```

---

## 6. Sistema SLA

### Umbrales

| Etapa | SLA | Alerta previa |
|-------|-----|---------------|
| Primera respuesta | 15 min hábiles | 5 min antes (al llegar a 10 min) |
| Cotización | 120 min hábiles | 5 min antes (al llegar a 115 min) |
| Inactividad post-cotización | 960 min hábiles (2 días) | Cron job hourly |

Todos los umbrales se calculan en **minutos hábiles** (función `business_minutes`), excluyendo horas fuera de atención, domingos y feriados peruanos.

### Semáforo visual

El componente `Semaforo` muestra el tiempo transcurrido con colores:

| Color | Condición |
|-------|-----------|
| 🟢 Verde | Dentro del SLA (`minutos ≤ meta`) |
| 🟡 Amarillo | SLA superado, pero ≤ 2× meta |
| 🔴 Rojo | Más del doble del SLA |
| ⚪ Gris | Lead ya cerrado o sin datos (`'—'`) |

### Cómo avanza el timer en vivo

El sistema usa una estrategia en dos capas para evitar problemas de zona horaria con timestamps de PostgreSQL:

1. **Leads cargados por API:** Tienen `min_esperando_respuesta` = minutos de negocio calculados por la DB al momento de la carga. El frontend suma `elapsed` (minutos calendario desde la carga) para aproximar el tiempo actual.

2. **Leads llegados por Socket:** No tienen `min_esperando_respuesta`. El frontend inyecta `_socketAt = Date.now()` en el objeto del lead al recibirlo. El timer usa `(Date.now() - _socketAt) / 60000`, comenzando desde 0 en el momento de llegada.

Ambos casos dependen de un intervalo de 1 segundo en `TablaLeads` que fuerza re-renders, asegurando que `Date.now()` se llame con valores frescos.

---

## 7. Horario hábil y zonas horarias

**El backend usa `TIMESTAMP WITHOUT TIME ZONE`**, lo que significa que los timestamps se almacenan como hora local del servidor sin información de zona horaria.

**Zona horaria del servidor:** Debe estar configurada en `America/Lima` (UTC-5, sin DST) para que `NOW()`, `siguiente_momento_habil()` y `business_minutes()` funcionen correctamente.

**Frontend:** Para evitar errores de parsing (`new Date("2026-03-26 18:30:00")` puede dar `Invalid Date` en Firefox o interpretarse como hora local incorrecta), el sistema **evita parsear timestamps del servidor para cálculos de timer en vivo**. Usa `min_esperando_respuesta` (número puro) para leads de API y `_socketAt` (timestamp del browser) para leads de socket.

La función `parseTS(ts)` en `TablaLeads` solo se usa para cálculos históricos fijos (tiempo que tomó la primera respuesta), donde la imprecisión de unos minutos es aceptable.

---

## 8. Flujo de datos en tiempo real

```
1. Dashboard abre → React monta Gerencia.jsx
2. cargarDatos() → GET /api/leads?desde=... + GET /api/leads/metricas
3. Datos en state → leads[], metricas[]
4. useSocket.js conecta Socket.io → conectado=true → badge "En vivo"
5. setInterval(1000) en TablaLeads → re-render cada segundo → timers avanzan
6. setInterval(30000) en Gerencia → check SLA → toast+sonido si vence

Cuando llega socket event:
7. setUltimoEvento({ tipo, data }) → useEffect en Gerencia
8. setLeads(prev => [enriched, ...prev])  ← 1 re-render de Gerencia
9. getMetricas() silencioso               ← actualiza KPIs
10. Toast + sonido si lead:nuevo

Sin socket (datos de API):
11. elapsed crece cada segundo (tick de TablaLeads)
12. min_esperando_respuesta + elapsed → timer avanza
```

---

## 9. API Reference

### GET /api/leads

**Query params:**
- `desde` (opcional): `YYYY-MM-DD` — Fecha desde la cual incluir leads cerrados. Los leads activos siempre se devuelven.

**Response:** `Lead[]`

```typescript
interface Lead {
  id: number;
  sendpulse_contact_id: string;
  nombre: string;
  celular: string;
  canal: string;
  campana: string;
  requerimiento: string;
  tipo: string;
  notas: string;
  vendedor_id: number;
  vendedor_nombre: string;        // JOIN con vendedores
  estado: string;
  resultado: string | null;
  alerta_inactividad_enviada: boolean;
  ts_lead_creado: string;         // "YYYY-MM-DD HH:MM:SS"
  ts_efectivo: string;
  ts_primera_respuesta: string | null;
  ts_cotizacion_enviada: string | null;
  ts_cierre: string | null;
  min_primera_respuesta: number | null;   // business_minutes, fijo
  min_cotizacion: number | null;          // business_minutes, fijo
  min_esperando_respuesta: number | null; // business_minutes hasta NOW()
  min_esperando_cotizacion: number | null;// business_minutes hasta NOW()
}
```

### GET /api/leads/metricas

**Response:** `Metrica[]` (desde la vista `metricas_vendedor`)

### PATCH /api/leads/:id/estado

**Body:**
```json
{
  "estado": "en_atencion",
  "resultado": null,
  "vendedor_id": 3
}
```

### POST /webhook/lead-creado

**Headers:** `x-webhook-token: <token>`

**Body:**
```json
{
  "contact_id": "abc123",
  "nombre": "Juan Pérez",
  "celular": "+51999999999",
  "canal": "WhatsApp",
  "campana": "Campaña Retail",
  "requerimiento": "Laptop gaming",
  "tipo": "Venta",
  "notas": "",
  "asesor_asignado": "María García"
}
```

---

## 10. Configuración y despliegue

### Variables de entorno

**Backend (`Back-Retail/.env`):**
```
DATABASE_URL=postgres://usuario:contraseña@localhost:5432/retail_cm
PORT=3000
WEBHOOK_TOKEN=tu_token_secreto_de_sendpulse
```

**Frontend (`Front-Dashboard/.env`):**
```
VITE_API_URL=http://192.168.1.166:3000
```
Cambiar la IP a la dirección del servidor en la red local (o dominio en producción).

### Arrancar en desarrollo

```bash
# Backend
cd Back-Retail
npm install
npm run dev       # nodemon src/app.js

# Frontend
cd Front-Dashboard
npm install
npm run dev       # vite → http://localhost:5173
```

### Crear schema en PostgreSQL

```bash
psql -U usuario -d retail_cm -f Back-Retail/schema.sql
```

### Producción (sugerido)

```bash
# Backend con PM2
pm2 start src/app.js --name retail-cm-api

# Frontend build
cd Front-Dashboard
npm run build
# Servir dist/ con nginx o express static
```

---

## 11. Deuda técnica y mejoras pendientes

### Seguridad

| # | Problema | Impacto | Acción sugerida |
|---|----------|---------|-----------------|
| S3 | `/api/leads` sin autenticación | Cualquiera en la red puede leer leads | JWT o API key en header |
| S4 | `cors: { origin: '*' }` en Socket.io | Cualquier sitio puede conectarse | Restringir a dominios permitidos |
| S5 | Token `Comutel.2026` en variable de entorno | Riesgo si `.env` se expone | Rotar y usar secreto más largo |

### Calidad de datos

| # | Problema | Impacto | Acción sugerida |
|---|----------|---------|-----------------|
| Q1 | Nombres de vendedor no normalizados | Duplicados en filtros y métricas | Catálogo cerrado de vendedores |
| Q2 | Sin validación de body en webhooks | Datos malformados pueden entrar a la DB | Joi o Zod en routes |
| Q7 | `cotizacionEnviada` no valida estado previo | Puede saltar a cotizado desde nuevo | Guard: `WHERE estado = 'en_atencion'` |

### Arquitectura

| # | Problema | Impacto | Acción sugerida |
|---|----------|---------|-----------------|
| Q4 | Sin paginación en `/api/leads` | Con volumen alto, carga toda la tabla | Cursor-based pagination |
| M2 | Patrón `resolveVendedor` repetido 4 veces | Deuda de mantenimiento | Extraer a `utils/resolveVendedor.js` |
| A1 | IP hardcodeada en `.env` | Requiere cambio manual al mover el servidor | Usar dominio o variable de entorno en CI/CD |
| A2 | Timer usa minutos calendario para API leads | Pequeña imprecisión vs. business minutes | Calcular `min_esperando_respuesta` en el backend al emitir por socket |
| A3 | `ts_efectivo` puede ser futuro (fuera de horario) | Leads de madrugada muestran timer a 0 hasta que inicia jornada | Comportamiento correcto por diseño; documentado |

### Funcionalidad no implementada

- Notificaciones push / WhatsApp cuando SLA está por vencer
- Historial de cambios visible en el panel del vendedor
- Exportar tabla a Excel/CSV
- Múltiples sucursales
