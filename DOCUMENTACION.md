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
   - [App.jsx — Modo Admin](#43-appjsx--modo-admin)
   - [Página principal (Gerencia.jsx)](#44-página-principal-gerenciajsx)
   - [Componentes](#45-componentes)
   - [Hooks y utilidades](#46-hooks-y-utilidades)
   - [Temas (dark / light)](#47-temas-dark--light)
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
- **Derivar leads técnicos** al área de soporte (área Técnica/Elias) con su propio circuito de SLA

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
        │ POST /webhook/lead-derivado        ← nuevo
        │ POST /webhook/cotizacion-tecnico   ← nuevo
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
│  App.jsx (modo admin + login)           │
│  Gerencia.jsx (página principal)        │
│    ├── KPI cards (TarjetaMetrica)       │
│    ├── Gráficos (Recharts + custom)     │
│    ├── SLA por vendedor (DashboardTec.) │
│    ├── Tabla de leads (TablaLeads)      │
│    ├── Tabla resumen lateral            │
│    └── Modal gestión vendedores         │
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
│   │   └── pool.js             # Pool de conexiones PostgreSQL + fix de timezone
│   ├── routes/
│   │   ├── webhook.js          # POST /webhook/*
│   │   ├── leads.js            # GET/PATCH/DELETE /api/leads/*
│   │   ├── vendedores.js       # GET/POST/PUT/DELETE /api/vendedores
│   │   └── panel.js            # GET+POST /panel/:contact_id
│   ├── controllers/
│   │   ├── webhookController.js # Lógica de ciclo de vida del lead
│   │   └── leadsController.js   # Queries del dashboard + CRUD admin
│   ├── socket.js               # Inicialización Socket.io
│   └── jobs/
│       └── cronJobs.js         # Tareas horarias automáticas
├── schema.sql                  # Schema completo de la DB
├── .env                        # Variables de entorno (no en git)
└── package.json
```

### 3.3 Servidor (app.js)

El servidor realiza las siguientes tareas al arrancar:

1. Carga `.env` con path absoluto (`path.join(__dirname, '../.env')`) para evitar errores al iniciar desde directorios distintos
2. Crea la app Express y el servidor HTTP
3. Monta Socket.io con `cors: { origin: '*' }` (ver deuda técnica)
4. Aplica middlewares globales: CORS, JSON parser
5. Configura rate limiter (60 req/min) solo en `/webhook`
6. Inyecta el objeto `io` en `req` para que los controllers puedan emitir eventos
7. Registra todas las rutas
8. Inicializa Socket.io y los cron jobs
9. Escucha en `0.0.0.0:3000`

```
Variables de entorno requeridas:
  DATABASE_URL=postgres://user:pass@host:5432/dbname   (o variables separadas)
  DB_HOST / DB_USER / DB_PASSWORD / DB_NAME / DB_PORT
  PORT=3000 (opcional, default 3000)
  WEBHOOK_TOKEN=<token_de_sendpulse>
```

### 3.4 Base de datos — Schema

#### Tabla `vendedores`
```sql
id       SERIAL PRIMARY KEY
nombre   VARCHAR(100) NOT NULL
email    VARCHAR(100)
whatsapp VARCHAR(20)
rol      VARCHAR(20) DEFAULT 'vendedor'   -- 'vendedor' | 'tecnico'
activo   BOOLEAN DEFAULT true             -- soft delete
```
Los vendedores se crean automáticamente en el primer webhook si no existen.  
Los técnicos tienen `rol = 'tecnico'` y se consultan por `/api/vendedores/tecnicos`.

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
observaciones               TEXT                 -- Notas libres del vendedor/técnico
notas                       TEXT
vendedor_id                 INTEGER FK vendedores
tecnico_id                  INTEGER FK vendedores -- Técnico asignado (cuando se deriva)
estado                      VARCHAR(30)          -- Ver ciclo de vida
resultado                   VARCHAR(30)          -- ganado | futuro | perdido | null
alerta_inactividad_enviada  BOOLEAN DEFAULT false
ts_lead_creado              TIMESTAMP            -- Momento real de creación
ts_efectivo                 TIMESTAMP            -- Primer momento hábil (siguiente_momento_habil)
ts_primera_respuesta        TIMESTAMP            -- Cuando el vendedor marcó atención
ts_cotizacion_enviada       TIMESTAMP
ts_derivado                 TIMESTAMP            -- Cuando se derivó al técnico
ts_cotizacion_tecnico       TIMESTAMP            -- Cuando el técnico envió su cotización
ts_cierre                   TIMESTAMP
```

#### Tabla `eventos_lead` (auditoría)
```sql
id          SERIAL PRIMARY KEY
lead_id     INTEGER FK leads
vendedor_id INTEGER FK vendedores
tipo        VARCHAR(50)   -- lead_creado | primera_respuesta | cotizacion_enviada |
                          --   derivado | cotizacion_tecnico | cierre |
                          --   alerta_inactividad | auto_cierre_30_dias
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

#### Vista `metricas_tecnico`
Agrega métricas del área técnica:
- Total leads atendidos (derivados)
- % SLA cotización técnica
- Tiempo promedio de cotización técnica en minutos hábiles

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

Se llama al crear un lead para establecer `ts_efectivo`, la referencia real del reloj SLA.

#### `momento_habil_vigente(ts TIMESTAMP) → TIMESTAMP`

Similar a `siguiente_momento_habil` pero orientado a calcular el "ahora hábil": si se llama fuera de horario hábil devuelve el último cierre de jornada (no el próximo inicio). Usado en `getLeads` para calcular `min_esperando_respuesta` y `min_esperando_cotizacion` de forma que los timers no avancen cuando está fuera de horario.

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

-- Minutos esperando primera respuesta actualmente (usando momento hábil vigente)
business_minutes(ts_efectivo, momento_habil_vigente(NOW()::timestamp)) AS min_esperando_respuesta

-- Minutos de soporte esperando cotización técnica
business_minutes(ts_derivado, momento_habil_vigente(NOW()::timestamp)) AS min_esperando_soporte
```

### 3.6 Controladores

#### `webhookController.js`

Seis funciones que cubren el ciclo de vida completo del lead:

**`leadCreado(req, res)`**
- Busca o crea el `vendedor_id` por nombre (`ILIKE`)
- Calcula `ts_efectivo` inline con `siguiente_momento_habil(NOW()::timestamp)` (sin query extra)
- Inserta el lead en estado `nuevo`
- Registra evento `lead_creado`
- Emite `lead:nuevo` vía Socket.io

**`vendedorRespondio(req, res)`**
- Busca el lead por `lead_id` o `sendpulse_contact_id`
- Actualiza `ts_primera_respuesta = NOW()`, `estado = 'en_atencion'`
- Guard: solo actúa si `ts_primera_respuesta IS NULL` (idempotente)
- Devuelve `min_primera_respuesta` calculado en `RETURNING`
- Registra evento `primera_respuesta`
- Emite `lead:actualizado`

**`cotizacionEnviada(req, res)`**
- Acepta `observaciones` opcionales
- Actualiza `ts_cotizacion_enviada = NOW()`, `estado = 'cotizado'`
- Devuelve `min_primera_respuesta` y `min_cotizacion` calculados en `RETURNING`
- Registra evento `cotizacion_enviada`
- Emite `lead:actualizado`

**`leadDerivado(req, res)`** ← nuevo
- Recibe `asesor_asignado` (nombre del técnico) o usa el técnico por defecto (id=3)
- Actualiza `estado = 'derivado'`, `ts_derivado = NOW()`, `tecnico_id`
- Guard: solo actúa si `ts_derivado IS NULL` (idempotente)
- Registra evento `derivado`
- Emite `lead:actualizado`

**`cotizacionTecnico(req, res)`** ← nuevo
- Resuelve `tecnico_id` por nombre sin tocar `vendedor_id`
- Actualiza `ts_cotizacion_tecnico = NOW()`, `estado = 'cotizado_tecnico'`
- Acepta `observaciones` opcionales
- Devuelve campos de SLA calculados en `RETURNING`
- Registra evento `cotizacion_tecnico`
- Emite `lead:actualizado`

**`leadCerrado(req, res)`**
- Detecta si el lead fue derivado (`ts_derivado IS NOT NULL`) para actualizar `tecnico_id` en lugar de `vendedor_id`
- Acepta `observaciones` opcionales
- Actualiza `estado` (venta_efectiva | negociacion_futuro | no_efectiva), `resultado`, `ts_cierre`
- Registra evento `cierre` con metadata `{ estado, resultado }`
- Emite `lead:cerrado`

> **Nota:** Todos los controladores aceptan el lead por `lead_id` (int) O por `sendpulse_contact_id` (string), ya que SendPulse puede no enviar el ID interno.

---

#### `leadsController.js`

**`getLeads(req, res)`** — `GET /api/leads?desde=YYYY-MM-DD`

Devuelve leads con campos calculados, incluyendo los nuevos campos de soporte técnico:
```sql
SELECT
  l.*,
  v.nombre AS vendedor_nombre,
  t.nombre AS tecnico_nombre,
  business_minutes(ts_efectivo, ts_primera_respuesta)    AS min_primera_respuesta,
  business_minutes(ts_primera_respuesta, ts_cotizacion_enviada) AS min_cotizacion,
  -- Timers en vivo usando momento_habil_vigente (se detienen fuera de horario)
  CASE WHEN ts_primera_respuesta IS NULL THEN
    business_minutes(ts_efectivo, momento_habil_vigente(NOW()::timestamp))
  END AS min_esperando_respuesta,
  CASE WHEN ts_primera_respuesta IS NOT NULL AND ts_cotizacion_enviada IS NULL
       AND estado NOT IN ('derivado','venta_efectiva','no_efectiva','negociacion_futuro') THEN
    business_minutes(ts_primera_respuesta, momento_habil_vigente(NOW()::timestamp))
  END AS min_esperando_cotizacion,
  -- Soporte técnico
  CASE WHEN estado = 'derivado' AND ts_derivado IS NOT NULL THEN
    business_minutes(ts_derivado, NOW()::timestamp)
  END AS min_esperando_soporte,
  CASE WHEN ts_derivado IS NOT NULL AND ts_cotizacion_tecnico IS NOT NULL THEN
    business_minutes(ts_derivado, ts_cotizacion_tecnico)
  WHEN ts_derivado IS NOT NULL AND ts_cotizacion_tecnico IS NULL AND estado = 'derivado' THEN
    business_minutes(ts_derivado, momento_habil_vigente(NOW()::timestamp))
  END AS min_soporte_cotizacion,
  -- Campos de cierre definitivo
  CASE WHEN estado IN ('venta_efectiva','no_efectiva') AND ts_derivado IS NOT NULL THEN
    business_minutes(ts_derivado, ts_cierre)
  END AS min_soporte_final,
  CASE WHEN estado IN ('venta_efectiva','no_efectiva','negociacion_futuro')
       AND ts_primera_respuesta IS NOT NULL AND ts_cotizacion_enviada IS NULL THEN
    business_minutes(ts_primera_respuesta, ts_cierre)
  END AS min_cotizacion_final
FROM leads l
  LEFT JOIN vendedores v ON v.id = l.vendedor_id
  LEFT JOIN vendedores t ON t.id = l.tecnico_id
WHERE l.estado NOT IN ('venta_efectiva', 'no_efectiva')
   OR $1::date IS NULL
   OR l.ts_lead_creado >= $1::date
ORDER BY l.ts_lead_creado DESC
```

**`getMetricas(req, res)`** — `GET /api/leads/metricas`  
Lee la vista `metricas_vendedor`.

**`getMetricasTecnico(req, res)`** — `GET /api/leads/metricas-tecnico` ← nuevo  
Lee la vista `metricas_tecnico` (solo técnicos con leads atendidos).

**`actualizarEstado(req, res)`** — `PATCH /api/leads/:id/estado`  
Actualización manual de estado. Mejoras:
- Acepta `tecnico_id` para asignar técnico al derivar
- Auto-setea `ts_primera_respuesta` si el estado es `en_atencion/cotizado/derivado` y no estaba seteado
- Auto-setea `ts_derivado` si el estado es `derivado` y no estaba seteado
- Asigna `tecnico_id` por defecto (3) si se deriva sin especificar técnico
- Devuelve campos calculados en `RETURNING`
- Emite `lead:venta_efectiva` adicionalmente cuando el estado es `venta_efectiva`

**`actualizarVendedor(req, res)`** — `PATCH /api/leads/:id/vendedor` ← nuevo  
Reasigna el vendedor de un lead. Emite `lead:actualizado`.

**`actualizarTiempos(req, res)`** — `PATCH /api/leads/:id/tiempos` ← nuevo  
Permite corregir timestamps manualmente (`ts_efectivo`, `ts_primera_respuesta`, `ts_cotizacion_enviada`, `ts_derivado`). Devuelve campos calculados actualizados.

**`actualizarInfo(req, res)`** — `PATCH /api/leads/:id/info` ← nuevo  
Actualiza `tipo`, `campana`, `canal`, `observaciones` de un lead.

**`eliminarLead(req, res)`** — `DELETE /api/leads/:id` ← nuevo  
Elimina el lead y sus eventos. Emite `lead:eliminado`.

### 3.7 Rutas

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/webhook/lead-creado` | `x-webhook-token` | Nuevo lead desde SendPulse |
| POST | `/webhook/vendedor-respondio` | `x-webhook-token` | Primera respuesta |
| POST | `/webhook/cotizacion-enviada` | `x-webhook-token` | Cotización enviada |
| POST | `/webhook/lead-derivado` | `x-webhook-token` | **nuevo** Lead derivado a técnico |
| POST | `/webhook/cotizacion-tecnico` | `x-webhook-token` | **nuevo** Técnico envía cotización |
| POST | `/webhook/lead-cerrado` | `x-webhook-token` | Cierre del lead |
| GET | `/api/leads` | Ninguna | Leads con SLA calculado |
| GET | `/api/leads/metricas` | Ninguna | Métricas por vendedor |
| GET | `/api/leads/metricas-tecnico` | Ninguna | **nuevo** Métricas área técnica |
| PATCH | `/api/leads/:id/estado` | Ninguna | Cambio manual de estado |
| PATCH | `/api/leads/:id/vendedor` | Ninguna | **nuevo** Reasignar vendedor |
| PATCH | `/api/leads/:id/tiempos` | Ninguna | **nuevo** Corregir timestamps |
| PATCH | `/api/leads/:id/info` | Ninguna | **nuevo** Actualizar tipo/campaña/canal |
| DELETE | `/api/leads/:id` | Ninguna | **nuevo** Eliminar lead |
| GET | `/api/vendedores` | Ninguna | Lista de vendedores activos |
| GET | `/api/vendedores/tecnicos` | Ninguna | **nuevo** Lista de técnicos activos |
| POST | `/api/vendedores` | Ninguna | **nuevo** Crear vendedor/técnico |
| PUT | `/api/vendedores/:id` | Ninguna | **nuevo** Editar vendedor/técnico |
| DELETE | `/api/vendedores/:id` | Ninguna | **nuevo** Desactivar (soft delete) |
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

Las acciones envían `POST` a rutas del mismo servidor que llaman directamente a los controllers. **El token de autenticación nunca llega al cliente.**

### 3.9 Cron Jobs

Se ejecutan **cada hora, lunes a sábado** (`0 * * * 1-6`).

**`verificarInactividad()`**
```sql
SELECT ... FROM leads
WHERE estado = 'cotizado'
  AND alerta_inactividad_enviada = false
  AND ts_primera_respuesta IS NOT NULL
  AND business_minutes(ts_primera_respuesta, NOW()::timestamp) >= 960
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

El servidor emite los siguientes eventos al canal global (broadcast):

| Evento | Cuándo se emite | Payload |
|--------|-----------------|---------|
| `lead:nuevo` | `leadCreado` | Objeto `lead` + `vendedor_nombre` |
| `lead:actualizado` | `vendedorRespondio`, `cotizacionEnviada`, `leadDerivado`, `cotizacionTecnico`, `actualizarEstado`, `actualizarVendedor`, `actualizarTiempos`, `actualizarInfo` | Objeto `lead` actualizado |
| `lead:venta_efectiva` | `actualizarEstado` cuando `estado='venta_efectiva'` | Objeto `lead` — dispara confetti + sonido festivo |
| `lead:cerrado` | `leadCerrado`, `cerrarNegociacionesFuturo` | Objeto `lead` cerrado |
| `lead:eliminado` | `eliminarLead` | `{ id }` — el frontend quita el lead del array |
| `lead:alerta_inactividad` | `verificarInactividad` (cron) | `{ id, nombre, vendedor_id, vendedor_nombre }` |

> **Importante:** Los eventos de socket emiten el resultado de `RETURNING *` de PostgreSQL, que no siempre incluye los campos calculados. El frontend maneja esto preservando los valores anteriores y haciendo un re-fetch silencioso 600ms después de recibir el evento.

---

## 4. Frontend — Front-Dashboard

### 4.1 Stack y dependencias

```json
{
  "react": "^19.2.4",
  "vite": "^8.0.1",
  "recharts": "^3.8.0",
  "axios": "^1.13.6",
  "socket.io-client": "^4.8.3",
  "canvas-confetti": "^1.x"
}
```

**React 19** — UI con hooks  
**Vite 8** — Bundler y dev server  
**Recharts** — Gráficos (GraficoEstados, GraficoSLA, GraficoTiempo, GraficoDonut)  
**Axios** — Cliente HTTP para la API  
**Socket.io-client** — Conexión WebSocket al backend  
**canvas-confetti** — Animación de celebración en venta efectiva

### 4.2 Estructura de archivos

```
Front-Dashboard/
├── src/
│   ├── pages/
│   │   └── Gerencia.jsx         # Página única del dashboard
│   ├── components/
│   │   ├── TablaLeads.jsx       # Tabla completa de leads con semáforos SLA
│   │   ├── TablaResumen.jsx     # Tabla compacta de leads activos (nuevo)
│   │   ├── DashboardTecnicos.jsx# SLA por vendedor (barras de progreso)
│   │   ├── TarjetaMetrica.jsx   # KPI cards (Leads Nuevos, en Atención, etc.)
│   │   ├── Semaforo.jsx         # Indicador de tiempo SLA (verde/amarillo/rojo)
│   │   ├── GraficoEstados.jsx   # Donut chart por estado
│   │   ├── GraficoBarrasTop.jsx # Ranking horizontal (Tipos, Canales)
│   │   ├── GraficoDonut.jsx     # Bar chart con paleta de 10 colores (nuevo)
│   │   ├── GraficoSLA.jsx       # Gauge semicircular % cumplimiento
│   │   ├── GraficoTiempo.jsx    # Área temporal de volumen de leads
│   │   ├── ModalVendedores.jsx  # CRUD de vendedores/técnicos (nuevo)
│   │   └── ToastContainer.jsx   # Notificaciones pop-up
│   ├── hooks/
│   │   └── useSocket.js         # Hook para eventos Socket.io
│   ├── api/
│   │   └── leads.js             # Funciones Axios (13 funciones)
│   ├── utils/
│   │   └── sounds.js            # Sonidos Web Audio API
│   └── index.css                # Variables CSS, clases globales, animaciones
├── .env                         # VITE_API_URL
├── vite.config.js
└── package.json
```

### 4.3 App.jsx — Modo Admin

`App.jsx` gestiona el modo administrador con contraseña. La sesión persiste en `sessionStorage`.

- **Vista pública:** El dashboard es completamente funcional para monitoreo (solo lectura implícita)
- **Vista admin:** Habilita edición inline (eliminar leads, cambiar vendedor, corregir timestamps, etc.)
- La contraseña se valida en el cliente (`ADMIN_PASSWORD` hardcodeada)

```
Botón 🔐 en header → modal login → sessionStorage.setItem('isAdmin','1')
Botón Cerrar sesión → sessionStorage.removeItem('isAdmin')
```

> **Nota de seguridad:** La contraseña está en el bundle JS del cliente. Para uso interno en red local es aceptable; para exponer en internet, mover la autenticación al backend.

### 4.4 Página principal (Gerencia.jsx)

Componente raíz que orquesta todo el dashboard. Recibe props del modo admin.

#### Estado interno

| Estado | Tipo | Descripción |
|--------|------|-------------|
| `leads` | `Lead[]` | Array completo de leads cargados |
| `metricas` | `Metrica[]` | Datos de la vista metricas_vendedor |
| `metricasTecnico` | `MetricaTecnico[]` | Datos de la vista metricas_tecnico |
| `filtroFecha` | `'dia'│'semana'│'mes'│'todos'` | Filtro temporal activo |
| `filtroEstado` | `string` | Filtro de estado |
| `filtroTipo` | `string` | Filtro de tipo/motivo |
| `filtroVendedor` | `string` | Filtro de vendedor |
| `filtroCanal` | `string` | Filtro de canal |
| `fetchedAt` | `number` | `Date.now()` de la última carga API |
| `tecnicos` | `[{id, nombre}]` | Lista de técnicos activos |
| `vendedores` | `[{id, nombre, ...}]` | Lista de vendedores activos |
| `isLoading` | `boolean` | Spinner overlay durante carga inicial |
| `theme` | `'dark'│'light'` | Tema visual activo |
| `collapsed` | `boolean` | Sidebar de filtros (default: colapsado) |
| `showVendedores` | `boolean` | Modal de gestión de vendedores |

#### Carga de datos (`cargarDatos`)

```
cargarDatos(silent = false) [useCallback, dep: filtroFecha]
  │
  ├── Calcula `desde` según filtroFecha
  ├── Si !silent → setIsLoading(true)
  ├── Promise.all([getLeads(desde), getMetricas(), getMetricasTecnico()])
  ├── setLeads: merge inteligente con anchors de timer existentes (_socketAt, _cotizacionAt, _derivadoAt)
  │   Para cada lead nuevo, restaura timestamps de inicio de timer desde sessionStorage
  ├── setMetricas / setMetricasTecnico / setFetchedAt / setUltimaActualizacion
  └── Si !silent → setIsLoading(false) [en finally]
```

**Auto-refresh:** `setInterval(cargarDatos, 60000)` para mantener los minutos hábiles sincronizados con la DB.

#### Anchoring de timers con sessionStorage

Para que los timers no salten al hacer refresh de página, `cargarDatos` calcula el timestamp de inicio de cada timer a partir de `min_esperando_*` y lo guarda en `sessionStorage`:

```javascript
// Para timer de 1ra respuesta:
_socketAt = Date.now() - min_esperando_respuesta * 60000
sessionStorage.setItem(`resp_at_${lead.id}`, _socketAt)

// Para timer de cotización:
_cotizacionAt = Date.now() - min_esperando_cotizacion * 60000
sessionStorage.setItem(`cot_at_${lead.id}`, _cotizacionAt)

// Para timer de soporte técnico:
_derivadoAt = Date.now() - min_esperando_soporte * 60000
sessionStorage.setItem(`sop_at_${lead.id}`, _derivadoAt)
```

#### Actualización por socket

Cuando llega un evento de socket:

```
lead:nuevo
  → Inyectar _socketAt si !ts_primera_respuesta
  → Inyectar _cotizacionAt si tiene ts_primera_respuesta y !ts_cotizacion_enviada
  → Inyectar _derivadoAt si estado='derivado'
  → Preservar todos los timestamps en sessionStorage
  → Agregar al array si no existe, ordenar por ts_lead_creado DESC
  → Re-fetch silencioso en 600ms
  → Toast + playNuevoLead()

lead:actualizado
  → Merge inteligente: preservar _socketAt/_cotizacionAt anteriores
  → Preservar campos computados del fetch anterior si el socket no los trae
  → Re-fetch silencioso en 600ms

lead:cerrado
  → Mismo que actualizado

lead:venta_efectiva
  → Toast "¡Venta efectiva!"
  → playVentaEfectiva() (melodía festiva)
  → confetti() (animación de cañón de confeti)
  → Solo se dispara una vez por lead (ventaConfettiTriggered Set en useRef)

lead:eliminado
  → Quitar el lead del array por id

lead:alerta_inactividad
  → Toast de advertencia amarillo
```

#### Preservación de campos computados en merge de socket

```javascript
return {
  ...leadAnterior,
  ...dataSocket,
  // Los anchors de timer nunca se sobreescriben desde el socket
  _socketAt: leadAnterior._socketAt ?? dataSocket._socketAt,
  _cotizacionAt: leadAnterior._cotizacionAt ?? dataSocket._cotizacionAt,
  // Campos computados: usar el del socket si vino, si no el anterior
  min_esperando_respuesta: dataSocket.min_esperando_respuesta ?? leadAnterior.min_esperando_respuesta,
  min_esperando_cotizacion: dataSocket.min_esperando_cotizacion ?? leadAnterior.min_esperando_cotizacion,
  min_primera_respuesta: dataSocket.min_primera_respuesta ?? leadAnterior.min_primera_respuesta,
  min_cotizacion: dataSocket.min_cotizacion ?? leadAnterior.min_cotizacion,
  min_esperando_soporte: dataSocket.min_esperando_soporte ?? leadAnterior.min_esperando_soporte,
  min_soporte_final: dataSocket.min_soporte_final ?? leadAnterior.min_soporte_final,
  min_cotizacion_final: dataSocket.min_cotizacion_final ?? leadAnterior.min_cotizacion_final,
};
```

#### Alertas SLA (check cada 30s)

```
Para cada lead:
  Si estado='nuevo' y no alertado:
    t = minutos esperando primera respuesta
    Si 10 ≤ t < 15 → toast + playAlertaSLA() (SLA por vencer)

  Si estado='en_atencion' y no alertado:
    t = minutos esperando cotización
    Si 115 ≤ t < 120 → toast + playAlertaSLA()
```

### 4.5 Componentes

#### `TablaLeads`

Props: `leads`, `fetchedAt`, `isAdmin`, `tecnicos`, `vendedores`

Tabla completa con columnas: Cliente, Tipo/Campaña, Vendedor, Técnico, Canal, Requerimiento, Estado, 1ra Resp., Cotización, Soporte, Fecha.

**Conciencia de horario hábil:** `isHorarioHabil()` verifica la hora actual en `America/Lima`. Los timers en vivo solo avanzan durante horario hábil; fuera de él se congelan.

**Tres timers por lead:**
1. **Primera respuesta** (`getMinutosPrimeraRespuesta`): usa `_socketAt` → `min_esperando_respuesta` → fijo si ya respondió
2. **Cotización** (`getMinutosCotizacion`): usa `_cotizacionAt` → `min_esperando_cotizacion` → `min_cotizacion_final` si cerrado
3. **Soporte técnico** (`getMinutosSoporte`): usa `_derivadoAt` → `min_esperando_soporte` → `min_soporte_cotizacion` si cotizó → `min_soporte_final` si cerrado

**Edición inline (modo admin):**
- `<select>` de estado → llama `updateEstadoLead`
- Botón cambiar vendedor → abre selector
- Botón corregir timestamps → abre modal con inputs datetime-local
- Botón eliminar lead → confirmación + `deleteLead`

---

#### `TablaResumen` ← nuevo

Props: `leads`, `fetchedAt`

Tabla compacta (4 columnas: Vendedor, Estado, 1ra Resp., Cotiz.) para uso como panel lateral o vista de TV. Usa las mismas funciones de timer que `TablaLeads` pero sin las columnas de soporte ni edición. Tiene su propio tick de 1s.

---

#### `DashboardTecnicos`

Props: `leads`, `fetchedAt`

Muestra una tarjeta por vendedor con:
- **Avatar** con iniciales (colores consistentes por índice)
- **Barra de progreso SLA** (% leads atendidos a tiempo)
  - Verde ≥ 80%, Naranja ≥ 50%, Rojo < 50%
- **Pills de estadísticas**: ✓ a tiempo | ✗ atrasados | 📋 cotizados

Tiene su propio tick de 1s para actualizar tiempos en vivo.

---

#### `TarjetaMetrica`

Props: `titulo`, `valor`, `accentColor`, `icon`, `subtitulo`

KPI card con borde superior del `accentColor`. El `icon` puede ser una URL de imagen o un emoji.

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

Formato: `Xh Ym Zs`, `Ym Zs`, o `Zs`.

---

#### `GraficoEstados`

Donut chart (Recharts `PieChart`) con los estados del lead.

Paleta:
```javascript
nuevo:              '#1B4F72'
en_atencion:        '#D97706'
cotizado:           '#E67E22'
derivado:           '#0C7A8B'
cotizado_tecnico:   '#0369A1'
venta_efectiva:     '#27AE60'
negociacion_futuro: '#8E44AD'
no_efectiva:        '#E74C3C'
```

---

#### `GraficoDonut` ← nuevo

Props: `data` (`[{name, value, color?}]`)

Bar chart vertical (Recharts `BarChart`) con paleta de 10 colores predefinidos. Útil para distribuciones por categoría, canal, etc. Etiquetas inclinadas -35° para legibilidad con nombres largos.

---

#### `GraficoBarrasTop`

Props: `data` (`[{name, value}]`), `color`

Ranking horizontal de hasta 4 items con medallas (🥇🥈🥉) y barras proporcionales al máximo.

---

#### `GraficoSLA`

Semi-donut gauge (Recharts) mostrando `aTiempo/total * 100`. Si no hay datos, muestra `'—'`.

---

#### `GraficoTiempo`

Area chart (Recharts) con gradiente. Agrupa leads por hora/día/semana/mes según `filtroFecha`.

---

#### `ModalVendedores` ← nuevo

Componente modal de gestión de vendedores y técnicos. Accesible desde el header (botón 👥, solo en modo admin).

- **Lista** de vendedores activos con nombre, rol, email, whatsapp
- **Formulario** de creación/edición con campos: nombre, rol (vendedor|técnico), email, whatsapp
- **Desactivar** (soft delete) con confirmación
- Llama a `createVendedor`, `updateVendedor`, `deleteVendedor` de `api/leads.js`

---

#### `ToastContainer` + `useToasts`

Sistema de notificaciones pop-up en esquina inferior derecha.

Tipos: `'success'` (verde), `'warning'` (amarillo), `'danger'` (rojo), `'info'` (azul).

Auto-cierre a los **5 segundos** con animación `slideIn`.

---

### 4.6 Hooks y utilidades

#### `useSocket.js`

Socket único (singleton fuera del componente). Se conecta a `import.meta.env.VITE_API_URL`.

```javascript
// Retorna:
{
  ultimoEvento: { tipo: 'nuevo'|'actualizado'|'cerrado'|'venta_efectiva'|'alerta'|null, data: {} },
  conectado: boolean
}
```

Eventos escuchados: `connect`, `disconnect`, `connect_error`, `lead:nuevo`, `lead:actualizado`, `lead:venta_efectiva`, `lead:cerrado`, `lead:alerta_inactividad`.

---

#### `api/leads.js`

```javascript
// Leads
getLeads(desde)                     // GET /api/leads?desde=YYYY-MM-DD
getMetricas()                       // GET /api/leads/metricas
getMetricasTecnico()                // GET /api/leads/metricas-tecnico
updateEstadoLead(id, estado, tec)   // PATCH /api/leads/:id/estado
updateTiemposLead(id, tiempos)      // PATCH /api/leads/:id/tiempos
updateVendedorLead(id, vendedor_id) // PATCH /api/leads/:id/vendedor
updateInfoLead(id, data)            // PATCH /api/leads/:id/info
deleteLead(id)                      // DELETE /api/leads/:id

// Vendedores
getVendedores()                     // GET /api/vendedores
getTecnicos()                       // GET /api/vendedores/tecnicos
createVendedor(data)                // POST /api/vendedores
updateVendedor(id, data)            // PUT /api/vendedores/:id
deleteVendedor(id)                  // DELETE /api/vendedores/:id
```

---

#### `utils/sounds.js`

Genera sonidos usando la Web Audio API (sin archivos externos):

- `playNuevoLead()`: Dos beeps ascendentes (880 Hz, onda seno, 0.15s)
- `playAlertaSLA()`: Tres tonos urgentes (440 Hz, onda cuadrada, 0.15s)
- `playVentaEfectiva()` ← nuevo: Melodía festiva Do-Mi-Sol-Do (523→659→784→1047 Hz, onda triangular, 0.35s al final)

---

### 4.7 Temas (dark / light)

Se manejan con CSS custom properties en `index.css`. El tema se aplica con `data-theme="dark"` en `document.body`.

| Variable | Light | Dark |
|----------|-------|------|
| `--bg-main` | `#F4F6F8` | `#13151A` |
| `--bg-card` | `#FFFFFF` | `#1F2128` |
| `--text-main` | `#333333` | `#F3F4F6` |
| `--text-muted` | `#888888` | `#9CA3AF` |
| `--header-bg` | `#FFFFFF` | `#1A1C23` |
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
    │── POST /panel/accion ──►│── UPDATE estado='en_atencion'
    │                        │── emit lead:actualizado ►│ Timer cotiz. arranca
    │                        │
    │── POST /panel/cotizacion►│── UPDATE estado='cotizado'
    │                        │── emit lead:actualizado ►│
    │                        │
    ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (rama técnica) ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
    │                        │
    │── POST /webhook ────────►│── UPDATE estado='derivado', ts_derivado
    │   lead-derivado         │── emit lead:actualizado ►│ Timer soporte arranca
    │                        │
    │── POST /webhook ────────►│── UPDATE estado='cotizado_tecnico'
    │   cotizacion-tecnico    │── emit lead:actualizado ►│
    ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
    │                        │
    │── POST /webhook ────────►│── UPDATE estado='venta_efectiva' | ...
    │   lead-cerrado          │── emit lead:cerrado ─────►│ Lead sale de activos
    │                        │── emit lead:venta_efectiva►│ Confetti + fanfarria
    │                        │
    │                  [CRON hourly]
    │                        │── cotizado > 960 min hábiles
    │                        │── emit lead:alerta_inactividad ►│ Toast amarillo
    │                        │── negociacion_futuro > 30 días
    │                        │── auto-cierre no_efectiva
```

### Estados posibles

```
nuevo ──────────────────────────► en_atencion ──► cotizado ──┐
  │                                    │                      ├──► venta_efectiva
  │                                    │                      ├──► negociacion_futuro ──► (30 días) ──► no_efectiva
  │                                    │                      ├──► no_efectiva
  │                                    └──► derivado ──► cotizado_tecnico ──► venta_efectiva / no_efectiva
  │
  └── (Cierre directo sin atender — no implementado en panel)
```

---

## 6. Sistema SLA

### Umbrales

| Etapa | SLA | Alerta previa |
|-------|-----|---------------|
| Primera respuesta (vendedor) | 15 min hábiles | 5 min antes (al llegar a 10 min) |
| Cotización (vendedor) | 120 min hábiles | 5 min antes (al llegar a 115 min) |
| Cotización técnica (soporte) | configurable — ver `metricas_tecnico` | — |
| Inactividad post-cotización | 960 min hábiles (2 días) | Cron job hourly |

### Semáforo visual

| Color | Condición |
|-------|-----------|
| 🟢 Verde | Dentro del SLA (`minutos ≤ meta`) |
| 🟡 Amarillo | SLA superado, pero ≤ 2× meta |
| 🔴 Rojo | Más del doble del SLA |
| ⚪ Gris | Lead cerrado o sin datos (`'—'`) |

### Timers en vivo — Estrategia de anclas

El sistema usa tres "anchors" (timestamps de inicio calculados en el cliente) para que los timers avancen suavemente sin depender de parsear timestamps PostgreSQL:

| Campo | Anchor | Cómo se establece |
|-------|--------|-------------------|
| `_socketAt` | Inicio del timer de 1ra respuesta | `Date.now()` al recibir lead vía socket; o `Date.now() - min_esperando_respuesta*60000` al cargar por API |
| `_cotizacionAt` | Inicio del timer de cotización | `Date.now()` al recibir evento de atención; o calculado desde `min_esperando_cotizacion` |
| `_derivadoAt` | Inicio del timer de soporte | `Date.now()` al recibir evento derivado; o calculado desde `min_esperando_soporte` |

Los anchors se persisten en **`sessionStorage`** para sobrevivir refrescos de página.

Los timers se **congelan fuera de horario hábil** (`isHorarioHabil()` en el cliente), evitando que acumulen minutos de madrugada/domingo.

---

## 7. Horario hábil y zonas horarias

**El backend usa `TIMESTAMP WITHOUT TIME ZONE`**, almacenados en hora Lima.

**Fix de timezone en `db/pool.js`:**
```javascript
// Al conectar cada cliente del pool:
client.query("SET timezone = 'America/Lima'");

// Fix para que el driver pg no interprete los TIMESTAMP como UTC:
types.setTypeParser(1114, (val) => {
  if (!val) return null;
  return new Date(val.replace(' ', 'T') + '-05:00');
});
```
Esto garantiza que los objetos `Date` que llegan al frontend ya estén en hora Lima (UTC-5), eliminando el desfase de +5 horas que ocurría antes.

**Zona horaria del servidor:** Debe estar configurada en `America/Lima` (UTC-5, sin DST).

**Frontend:** Los timers en vivo usan anchors de `Date.now()` (hora del browser) y se congelan fuera de horario hábil. La función `parseTS(ts)` (en `TablaLeads`) solo se usa para cálculos históricos fijos donde una pequeña imprecisión es aceptable.

---

## 8. Flujo de datos en tiempo real

```
1. Dashboard abre → React monta App.jsx → Gerencia.jsx
2. cargarDatos() → GET /api/leads + GET /api/leads/metricas + GET /api/leads/metricas-tecnico
3. Para cada lead, calcular anchors (_socketAt, _cotizacionAt, _derivadoAt) desde min_esperando_*
4. Anchors se guardan en sessionStorage por lead id
5. setLeads con leads enriquecidos / setFetchedAt(Date.now())
6. useSocket.js conecta Socket.io → conectado=true → badge "En vivo"
7. setInterval(1000) en TablaLeads/TablaResumen → re-render → timers avanzan (si horario hábil)
8. setInterval(30000) en Gerencia → check SLA → toast+sonido si vence
9. setInterval(60000) en Gerencia → cargarDatos(silent=true) → sync con DB

Cuando llega socket event:
10. setUltimoEvento({ tipo, data }) → useEffect en Gerencia
11. Enriquecer data con anchors si aplica, guardar en sessionStorage
12. Merge preservando anchors y campos computados anteriores
13. setTimeout(600ms) → cargarDatos(silent=true) para restaurar campos calculados
14. Toast + sonido según tipo de evento
15. Confetti si lead:venta_efectiva (una sola vez por lead)
```

---

## 9. API Reference

### GET /api/leads

**Query params:**
- `desde` (opcional): `YYYY-MM-DD`

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
  observaciones: string | null;
  vendedor_id: number;
  vendedor_nombre: string;
  tecnico_id: number | null;
  tecnico_nombre: string | null;
  estado: string;
  resultado: string | null;
  alerta_inactividad_enviada: boolean;
  ts_lead_creado: string;
  ts_efectivo: string;
  ts_primera_respuesta: string | null;
  ts_cotizacion_enviada: string | null;
  ts_derivado: string | null;
  ts_cotizacion_tecnico: string | null;
  ts_cierre: string | null;
  // Campos calculados (business_minutes)
  min_primera_respuesta: number | null;
  min_cotizacion: number | null;
  min_esperando_respuesta: number | null;
  min_esperando_cotizacion: number | null;
  min_esperando_soporte: number | null;
  min_soporte_cotizacion: number | null;
  min_soporte_final: number | null;
  min_cotizacion_final: number | null;
}
```

### GET /api/leads/metricas

**Response:** `Metrica[]` (desde la vista `metricas_vendedor`)

### GET /api/leads/metricas-tecnico

**Response:** `MetricaTecnico[]` (desde la vista `metricas_tecnico`, solo con `leads_atendidos > 0`)

### PATCH /api/leads/:id/estado

**Body:**
```json
{
  "estado": "derivado",
  "resultado": null,
  "tecnico_id": 3
}
```

### PATCH /api/leads/:id/tiempos

**Body:** (todos opcionales, se aplican con COALESCE)
```json
{
  "ts_efectivo": "2026-04-17 09:30:00",
  "ts_primera_respuesta": "2026-04-17 09:45:00",
  "ts_cotizacion_enviada": null,
  "ts_derivado": null
}
```

### PATCH /api/leads/:id/info

**Body:**
```json
{
  "tipo": "Soporte técnico",
  "campana": "Campaña Retail",
  "canal": "WhatsApp",
  "observaciones": "Cliente prefiere llamada"
}
```

### DELETE /api/leads/:id

Elimina lead y sus eventos. Emite `lead:eliminado`.

### POST /webhook/lead-derivado

**Headers:** `x-webhook-token: <token>`

**Body:**
```json
{
  "lead_id": 42,
  "contact_id": "abc123",
  "asesor_asignado": "Elias Torres"
}
```

### POST /webhook/cotizacion-tecnico

**Body:**
```json
{
  "lead_id": 42,
  "contact_id": "abc123",
  "asesor_asignado": "Elias Torres",
  "observaciones": "Requiere instalación on-site"
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
DB_HOST=localhost
DB_PORT=5432
DB_NAME=retail_cm
DB_USER=usuario
DB_PASSWORD=contraseña
PORT=3000
WEBHOOK_TOKEN=tu_token_secreto_de_sendpulse
```

**Frontend (`Front-Dashboard/.env`):**
```
VITE_API_URL=http://192.168.1.166:3000
```

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

# Exponer backend a SendPulse
ngrok http 3000
```

### Crear/actualizar schema en PostgreSQL

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
| S1 | Contraseña admin en bundle JS del cliente | Cualquiera con DevTools puede verla | Mover autenticación al backend con JWT |
| S2 | `/api/leads` sin autenticación | Cualquiera en la red puede leer leads | JWT o API key en header |
| S3 | `cors: { origin: '*' }` en Socket.io | Cualquier sitio puede conectarse | Restringir a dominios permitidos |

### Calidad de datos

| # | Problema | Impacto | Acción sugerida |
|---|----------|---------|-----------------|
| Q1 | Nombres de vendedor no normalizados en webhooks | Pueden crearse duplicados | Catálogo cerrado de vendedores |
| Q2 | Sin validación de body en webhooks | Datos malformados pueden entrar a la DB | Joi o Zod en routes |
| Q3 | `cotizacionEnviada` no valida estado previo | Puede saltar a cotizado desde nuevo | Guard: `WHERE estado = 'en_atencion'` |

### Arquitectura

| # | Problema | Impacto | Acción sugerida |
|---|----------|---------|-----------------|
| A1 | IP hardcodeada en `.env` | Requiere cambio manual al mover el servidor | Usar dominio o variable CI/CD |
| A2 | Timer usa minutos calendario para el elapsed | Pequeña imprecisión fuera de horario | `momento_habil_vigente` mitiga esto; timer congelado fuera de horario |
| A3 | `ts_efectivo` puede ser futuro (fuera de horario) | Leads de madrugada muestran timer a 0 hasta inicio de jornada | Comportamiento correcto por diseño |
| A4 | Sin paginación en `/api/leads` | Con volumen alto, carga toda la tabla | Cursor-based pagination |
| A5 | Patrón `resolveVendedor` repetido en varios controllers | Deuda de mantenimiento | Extraer a `utils/resolveVendedor.js` |

### Funcionalidad no implementada

- Notificaciones push / WhatsApp cuando SLA está por vencer
- Historial de cambios visible en el panel del vendedor
- Exportar tabla a Excel/CSV
- Múltiples sucursales
- Dashboard específico del área técnica (métricas de `metricas_tecnico`)
- Tests automatizados (unitarios e integración)
