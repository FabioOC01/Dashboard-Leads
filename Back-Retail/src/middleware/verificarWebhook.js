require('dotenv').config();

module.exports = (req, res, next) => {
    const token = req.headers['x-webhook-token'];

    if (!token || token !== process.env.WEBHOOK_SECRET) {
        console.warn(`[WEBHOOK] Token inválido desde ${req.ip}`);
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
};