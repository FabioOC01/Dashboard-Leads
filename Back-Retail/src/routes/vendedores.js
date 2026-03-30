const router = require('express').Router();
const pool = require('../db/pool');

router.get('/', async (req, res) => {
    const { rows } = await pool.query(
        `SELECT * FROM vendedores WHERE activo = true ORDER BY nombre`
    );
    res.json(rows);
});

router.post('/', async (req, res) => {
    const { nombre, email, whatsapp } = req.body;
    const { rows } = await pool.query(
        `INSERT INTO vendedores (nombre, email, whatsapp) VALUES ($1,$2,$3) RETURNING *`,
        [nombre, email, whatsapp]
    );
    res.json(rows[0]);
});

module.exports = router;