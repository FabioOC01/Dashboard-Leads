const path = require('path');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const pool = require('./db/pool');
const webhookRoutes = require('./routes/webhook');
const leadsRoutes = require('./routes/leads');
const vendedoresRoutes = require('./routes/vendedores');
const authRoutes = require('./routes/auth');
const initSocket = require('./socket');
const cronJobs = require('./jobs/cronJobs');
const panelRoutes = require('./routes/panel');

// Orígenes permitidos para CORS. Si CORS_ORIGINS no está definido, se permite todo
// (compatibilidad). Define CORS_ORIGINS="https://dash.tu-dominio,http://192.168.x.x:5173" para restringir.
function getLocalViteOrigins() {
    const origins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
    const interfaces = os.networkInterfaces();

    Object.values(interfaces).forEach((entries = []) => {
        entries
            .filter(entry => entry.family === 'IPv4' && !entry.internal)
            .forEach(entry => origins.push(`http://${entry.address}:5173`));
    });

    return origins;
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
const allowedOrigins = unique([...configuredOrigins, ...getLocalViteOrigins()]);
const corsOrigin = configuredOrigins.length ? allowedOrigins : true;
const corsOptions = { origin: corsOrigin };

const app = express();
app.set('trust proxy', 1); // Soluciona error de express-rate-limit con SendPulse/Ngrok
const server = http.createServer(app);
const io = new Server(server, {
    cors: corsOptions
});

// Middlewares globales
app.use(cors(corsOptions));
app.use(express.json());

// Rate limiting solo en webhooks
const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Demasiadas solicitudes' }
});

// Pasar io a controllers vía req
app.use((req, res, next) => { req.io = io; next(); });

// Rutas
app.use('/webhook', webhookLimiter, webhookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/vendedores', vendedoresRoutes);
app.use('/panel', panelRoutes);

// Health check
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date() }));

// Socket.io
initSocket(io);

// Cron jobs
cronJobs.init(io);

const PORT = process.env.PORT || 3000;
let shuttingDown = false;
const listener = server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Corriendo en http://localhost:${PORT}`);
    getLocalViteOrigins()
        .filter(origin => !origin.includes('localhost') && !origin.includes('127.0.0.1'))
        .forEach(origin => {
            const backendUrl = origin.replace(':5173', `:${PORT}`);
            console.log(`[SERVER] Red local: ${backendUrl}`);
        });
});

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[SERVER] Cerrando por ${signal}...`);
    io.close();
    listener.close(async () => {
        try {
            await pool.end();
            process.exit(0);
        } catch (err) {
            console.error('[SERVER] Error cerrando conexiones:', err.message);
            process.exit(1);
        }
    });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
