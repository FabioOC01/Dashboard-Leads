const router = require('express').Router();
const pool = require('../db/pool');
const admin = require('../middleware/verificarAdmin');

router.get('/', async (req, res) => {
    const { rows } = await pool.query(
        `SELECT * FROM vendedores WHERE activo = true ORDER BY nombre`
    );
    res.json(rows);
});

router.get('/tecnicos', async (req, res) => {
    const { rows } = await pool.query(
        `SELECT id, nombre FROM vendedores WHERE activo = true AND rol = 'tecnico' ORDER BY nombre`
    );
    res.json(rows);
});

router.post('/', admin, async (req, res) => {
    const { nombre, email, whatsapp, rol } = req.body;
    const { rows } = await pool.query(
        `INSERT INTO vendedores (nombre, email, whatsapp, rol) VALUES ($1,$2,$3,$4) RETURNING *`,
        [nombre, email, whatsapp, rol || 'vendedor']
    );
    res.json(rows[0]);
});

router.put('/:id', admin, async (req, res) => {
    const { id } = req.params;
    const { nombre, email, whatsapp, rol } = req.body;
    try {
        const { rows } = await pool.query(
            `UPDATE vendedores SET nombre=$1, email=$2, whatsapp=$3, rol=$4 WHERE id=$5 RETURNING *`,
            [nombre, email, whatsapp, rol, id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Vendedor no encontrado' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', admin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`UPDATE vendedores SET activo=false WHERE id=$1`, [id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;