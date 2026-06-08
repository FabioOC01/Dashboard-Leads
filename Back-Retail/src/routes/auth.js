const router = require('express').Router();
require('dotenv').config();
const { safeEqual } = require('../middleware/verificarAdmin');

// Login de administrador: valida la contraseña en el servidor y entrega el token de API.
// La contraseña y el token nunca están en el frontend.
router.post('/login', (req, res) => {
    const expected = process.env.ADMIN_PASSWORD;
    const token = process.env.ADMIN_API_TOKEN;
    if (!expected || !token) {
        console.error('[AUTH] ADMIN_PASSWORD / ADMIN_API_TOKEN no configurados');
        return res.status(500).json({ error: 'Autenticación no configurada' });
    }
    const { password } = req.body || {};
    if (!password || !safeEqual(password, expected)) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    res.json({ token });
});

module.exports = router;
