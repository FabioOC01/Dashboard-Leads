const crypto = require('crypto');
require('dotenv').config();

// Compara dos strings en tiempo constante (evita timing attacks)
function safeEqual(a, b) {
    const ba = Buffer.from(String(a || ''));
    const bb = Buffer.from(String(b || ''));
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
}

// Protege endpoints de administrador: exige cabecera x-admin-token válida
module.exports = (req, res, next) => {
    const expected = process.env.ADMIN_API_TOKEN;
    if (!expected) {
        console.error('[AUTH] ADMIN_API_TOKEN no configurado');
        return res.status(500).json({ error: 'Autenticación no configurada' });
    }
    const token = req.headers['x-admin-token'];
    if (!token || !safeEqual(token, expected)) {
        console.warn(`[AUTH] Token admin inválido desde ${req.ip}`);
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
};

module.exports.safeEqual = safeEqual;
