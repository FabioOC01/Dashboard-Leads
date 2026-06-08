# Retail-CM

Sistema de gestión de leads y dashboard de ventas en tiempo real para **Comutel**.

Los leads ingresan vía webhooks desde **SendPulse** (CRM externo), recorren un ciclo de vida con SLAs medidos en **horas hábiles**, y los resultados se visualizan en un dashboard de gerencia ("**Comutel Leads 2.0**") en tiempo real mediante Socket.io.

---

## Arquitectura

```
SendPulse (CRM)
      │ webhook POST (x-webhook-token)
      ▼
Back-Retail  (Node.js / Express 5 / PostgreSQL)
  ├── /webhook/*         → ciclo de vida del lead (auth: x-webhook-token)
  ├── /api/auth/login    → login de administrador (devuelve token de API)
  ├── /api/leads         → lectura (pública) + mutaciones (auth: x-admin-token)
  ├── /api/vendedores    → lectura (pública) + CRUD (auth: x-admin-token)
  ├── /panel/:contact_id → HTML para app móvil del vendedor
  ├── /health            → health check
  └── Socket.io          → push de eventos al dashboard
      │ WebSocket
      ▼
Front-Dashboard  (React 19 / Vite)
  └── App.jsx → Gerencia.jsx + componentes → dashboard de gerencia
```

---

## Stack tecnológico

| Capa        | Tecnología                          |
|-------------|-------------------------------------|
| Backend     | Node.js, Express 5.2, PostgreSQL    |
| Real-time   | Socket.io 4.8                       |
| Scheduling  | node-cron 4.2                       |
| Rate limit  | express-rate-limit 8                |
| Frontend    | React 19, Vite 8                    |
| Gráficos    | SVG propios (sin librería de charts)|
| HTTP Client | Axios 1.13                          |
| DB Driver   | pg 8 (SQL crudo, sin ORM)           |
| UI          | IBM Plex Sans/Mono · paleta azul acero · tema claro/oscuro |
| Extras      | Web Audio API + canvas-confetti     |

---

## Estructura del repositorio

```
Retail-CM/
├── Back-Retail/              # API + WebSocket + Cron
│   ├── schema.sql            # Esquema BD, funciones PL/pgSQL, vista métricas
│   ├── .env.example          # Plantilla de variables de entorno
│   └── src/
│       ├── app.js            # Entry point: Express + Socket.io + Cron + CORS
│       ├── controllers/      # webhookController, leadsController
│       ├── routes/           # webhook, auth, leads, vendedores, panel
│       ├── middleware/       # verificarWebhook, verificarAdmin
│       ├── jobs/             # cronJobs (alertas + auto-cierre)
│       ├── socket/           # inicialización Socket.io
│       └── db/               # pool de conexiones
└── Front-Dashboard/          # Dashboard React (Comutel Leads 2.0)
    └── src/
        ├── App.jsx           # Shell + login de administrador
        ├── pages/Gerencia.jsx# Orquestador del dashboard (datos, socket, filtros)
        ├── components/        # Topbar, FilterSidebar, KpiStrip, SlaSemaphore,
        │                      # Breakdown (estado/canal/tipo rotativo), SellerRanking,
        │                      # CriticalLeads, TemporalChart, OperativeTable,
        │                      # LiveTicker, Toasts, Icon, TablaLeads, Semaforo, ModalVendedores
        ├── hooks/             # useSocket, useDashboard (reloj, contadores, countdown)
        ├── utils/             # domain (estados, canales, SLA hábil), sounds
        └── api/leads.js       # cliente HTTP (login + leads + vendedores)
```

---

## Ciclo de vida de un lead

```
NUEVO ─(1ª respuesta)─► EN_ATENCION ─(cotización)─► COTIZADO ─┐
                              │                               │
                       (derivar a técnico)                    ├─► VENTA_EFECTIVA   (ganado)
                              ▼                               ├─► NEGOCIACION_FUTURO (futuro)
                          DERIVADO ─► COTIZADO_TECNICO ───────┴─► NO_EFECTIVA       (perdido)
```

### SLAs (en minutos hábiles)

- **Primera respuesta:** 15 min desde `ts_efectivo`
- **Cotización enviada:** 240 min desde la primera respuesta
- **Soporte técnico:** 240 min desde la derivación
- **Alerta de inactividad:** ~960 min hábiles sin cierre post-cotización (cron)

> **Fecha efectiva:** los leads que ingresan en fin de semana o fuera de horario se computan
> en el **siguiente momento hábil** (`ts_efectivo`). El dashboard filtra por esa fecha, así un
> lead del sábado/domingo con efectiva el lunes aparece en la semana del lunes.

### Horas hábiles

- Lunes a viernes: 9:30 – 18:30
- Sábado: 9:30 – 14:00
- Domingos y feriados peruanos excluidos (tabla `feriados`)

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
cp .env.example .env   # y completa los valores
```

Variables del `.env` (ver `Back-Retail/.env.example`):

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=comutel
DB_USER=postgres
DB_PASSWORD=<tu-password>

WEBHOOK_SECRET=<token-secreto-aleatorio>     # auth de /webhook/*
ADMIN_PASSWORD=<contraseña del login admin>  # la ingresa gerencia en el dashboard
ADMIN_API_TOKEN=<token-aleatorio-largo>      # protege las mutaciones de /api
CORS_ORIGINS=                                # opcional: orígenes permitidos (coma-separados)
CRM_WEBHOOK_URL=                             # opcional: reenvío de cotización al CRM
CRM_WEBHOOK_TOKEN=
```

> Genera secretos/tokens con `openssl rand -hex 32` (o `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
> Si `ADMIN_PASSWORD`/`ADMIN_API_TOKEN` no están definidos, el login y las mutaciones responden `500` (a propósito, para no quedar abierto).

```bash
npm run dev     # desarrollo (nodemon)
npm start       # producción
```

### 3. Frontend (`Front-Dashboard`)

```bash
cd Front-Dashboard
npm install
```

Crea `Front-Dashboard/.env`:

```env
VITE_API_URL=http://localhost:3000   # URL del backend
```

```bash
npm run dev     # servidor de desarrollo Vite
npm run build   # build de producción (genera dist/)
npm run preview # previsualizar el build
npm run lint    # ESLint
```

---

## Autenticación y seguridad

- **Webhooks** (`/webhook/*`): requieren cabecera `x-webhook-token` = `WEBHOOK_SECRET`. Rate limit 60 req/min.
- **Administrador**: `POST /api/auth/login` valida `ADMIN_PASSWORD` **en el servidor** y devuelve el `ADMIN_API_TOKEN`. El dashboard lo guarda en `sessionStorage` y lo envía como `x-admin-token` en cada mutación. La contraseña y el token nunca viven en el frontend.
- **Endpoints protegidos** (requieren `x-admin-token`): `PATCH/DELETE /api/leads/*` y `POST/PUT/DELETE /api/vendedores`. Las lecturas (`GET`) quedan públicas para el dashboard.
- **CORS**: configurable con `CORS_ORIGINS` (Express y Socket.io). Vacío = permite todo (no recomendado en producción).
- El panel del vendedor (`/panel/:contact_id`) escapa todos los datos del lead (sin XSS); el ticker del dashboard renderiza con JSX (sin `dangerouslySetInnerHTML`).

---

## API

| Método | Ruta                          | Descripción                               | Auth              |
|--------|-------------------------------|-------------------------------------------|-------------------|
| POST   | `/webhook/*`                  | Eventos del lead desde SendPulse          | `x-webhook-token` |
| POST   | `/api/auth/login`             | Login admin → devuelve `{ token }`        | —                 |
| GET    | `/api/leads`                  | Lista de leads                            | —                 |
| GET    | `/api/leads/metricas`         | Métricas agregadas por vendedor           | —                 |
| PATCH  | `/api/leads/:id/{estado,tiempos,vendedor,info}` | Actualización manual          | `x-admin-token`   |
| DELETE | `/api/leads/:id`              | Eliminar lead                             | `x-admin-token`   |
| GET    | `/api/vendedores`             | Lista de vendedores                       | —                 |
| POST/PUT/DELETE | `/api/vendedores[/:id]` | CRUD de vendedores                      | `x-admin-token`   |
| GET    | `/panel/:contact_id`          | Panel HTML para la app móvil del vendedor | —                 |
| GET    | `/health`                     | Health check (`{ ok: true, ts }`)         | —                 |

El backend emite eventos por Socket.io (`lead:nuevo`, `lead:actualizado`, `lead:venta_efectiva`, `lead:cerrado`, `test:audio`, `force:reload`) que el dashboard consume en tiempo real.

---

## Despliegue (servidor con pm2)

```bash
# en tu máquina: commitea y sube los cambios
git add -A && git commit -m "..." && git push

# en el servidor
cd ~/Retail-CM && git pull
cd Back-Retail   && nano .env   # añade ADMIN_PASSWORD / ADMIN_API_TOKEN / CORS_ORIGINS
pm2 restart retail-back
cd ../Front-Dashboard && npm install && npm run build
pm2 restart retail-front
```

> El `.env` no se versiona (`.gitignore`): configúralo una vez en cada entorno; los `pull` no lo tocan.
