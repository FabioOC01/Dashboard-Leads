# Retail-CM

Sistema de gestión de leads y dashboard de ventas en tiempo real para **Comutel** (retail, Perú).

Los leads ingresan vía webhooks desde **SendPulse** (CRM externo), recorren un ciclo de vida con SLAs medidos en **horas hábiles**, y los resultados se visualizan en un dashboard de gerencia en tiempo real mediante Socket.io.

---

## Arquitectura

```
SendPulse (CRM)
      │ webhook POST (x-webhook-token)
      ▼
Back-Retail  (Node.js / Express 5 / PostgreSQL)
  ├── /webhook/*         → ciclo de vida del lead
  ├── /api/leads         → lectura + actualización manual de estado
  ├── /api/vendedores    → CRUD vendedores
  ├── /panel/:contact_id → HTML para app móvil del vendedor
  ├── /health            → health check
  └── Socket.io          → push de eventos al dashboard
      │ WebSocket
      ▼
Front-Dashboard  (React 19 / Vite / Recharts)
  └── Gerencia.jsx + componentes → dashboard de gerencia
```

---

## Stack tecnológico

| Capa        | Tecnología                          |
|-------------|-------------------------------------|
| Backend     | Node.js, Express 5.2, PostgreSQL    |
| Real-time   | Socket.io 4.8                       |
| Scheduling  | node-cron 4.2                       |
| Rate limit  | express-rate-limit 8                |
| Frontend    | React 19, Vite 8, Recharts 3.8      |
| HTTP Client | Axios 1.13                          |
| DB Driver   | pg 8 (SQL crudo, sin ORM)           |
| Audio       | Web Audio API (notificaciones)      |

---

## Estructura del repositorio

```
Retail-CM/
├── Back-Retail/              # API + WebSocket + Cron
│   ├── schema.sql            # Esquema BD, funciones PL/pgSQL, vista métricas
│   └── src/
│       ├── app.js            # Entry point: Express + Socket.io + Cron
│       ├── controllers/      # webhookController, leadsController
│       ├── routes/           # webhook, leads, vendedores, panel
│       ├── middleware/       # verificarWebhook (auth por token)
│       ├── jobs/             # cronJobs (alertas + auto-cierre)
│       ├── socket/           # inicialización Socket.io
│       └── db/               # pool de conexiones
└── Front-Dashboard/          # Dashboard React
    └── src/
        ├── pages/Gerencia.jsx
        ├── components/       # gráficos, tablas, semáforos, toasts
        ├── hooks/useSocket.js
        ├── api/leads.js
        └── utils/sounds.js
```

---

## Ciclo de vida de un lead

```
NUEVO ──(primera respuesta)──► EN_ATENCION ──(cotización)──► COTIZADO
                                                                  │
                              ┌───────────────────────────────────┤
                              ▼                                   ▼
                       VENTA_EFECTIVA              NEGOCIACION_FUTURO ──(30 días)──► NO_EFECTIVA
                       resultado: ganado                  resultado: futuro
                              │
                        NO_EFECTIVA
                       resultado: perdido
```

### SLAs

- **Primera respuesta:** 15 minutos desde `ts_efectivo`
- **Cotización enviada:** 120 minutos desde la primera respuesta
- **Alerta de inactividad:** 960 minutos hábiles (≈2 días) sin cierre post-cotización

### Horas hábiles

- Lunes a viernes: 9:30 – 18:30
- Sábado: 9:30 – 14:00
- Feriados peruanos excluidos (tabla `feriados`)

---

## Requisitos previos

- Node.js 18+
- PostgreSQL 14+

---

## Puesta en marcha

### 1. Base de datos

```bash
createdb comutel
psql -d comutel -f Back-Retail/schema.sql
```

### 2. Backend (`Back-Retail`)

```bash
cd Back-Retail
npm install
```

Crea un archivo `.env` en `Back-Retail/`:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nombre    
DB_USER=user
DB_PASSWORD=<tu-password>
WEBHOOK_SECRET=<token-secreto-aleatorio>
```

> Genera un secreto seguro con `openssl rand -hex 32`.

Arranca el servidor:

```bash
npm run dev     # desarrollo (nodemon, recarga automática)
npm start       # producción
```

El backend queda escuchando en `http://localhost:3000`.

### 3. Frontend (`Front-Dashboard`)

```bash
cd Front-Dashboard
npm install
npm run dev     # servidor de desarrollo Vite
```

Otros scripts:

```bash
npm run build   # build de producción
npm run preview # previsualizar el build
npm run lint    # ESLint
```

---

## API

| Método | Ruta                     | Descripción                              | Auth            |
|--------|--------------------------|------------------------------------------|-----------------|
| POST   | `/webhook/*`             | Eventos del lead desde SendPulse         | `x-webhook-token` |
| GET    | `/api/leads`             | Lista de leads                           | —               |
| GET    | `/api/leads/metricas`    | Métricas agregadas por vendedor          | —               |
| PATCH  | `/api/leads/:id`         | Actualización manual de estado           | —               |
| —      | `/api/vendedores`        | CRUD de vendedores                       | —               |
| GET    | `/panel/:contact_id`     | Panel HTML para la app móvil del vendedor | —              |
| GET    | `/health`                | Health check (`{ ok: true, ts }`)        | —               |

Los webhooks tienen rate limiting (60 req/min). El backend emite eventos por Socket.io que el dashboard consume en tiempo real.

---


