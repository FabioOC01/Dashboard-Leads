const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const webhookRoutes = require('./routes/webhook');
const leadsRoutes = require('./routes/leads');
const vendedoresRoutes = require('./routes/vendedores');
const initSocket = require('./socket');
const cronJobs = require('./jobs/cronJobs');
const panelRoutes = require('./routes/panel');


const app = express();
app.set('trust proxy', 1); // Soluciona error de express-rate-limit con SendPulse/Ngrok
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

// Middlewares globales
app.use(cors());
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
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Corriendo en http://localhost:${PORT}`);
    console.log(`[SERVER] Red local: http://192.168.1.114:${PORT}`);
});