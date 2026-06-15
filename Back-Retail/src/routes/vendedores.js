const router = require('express').Router();
const pool = require('../db/pool');
const admin = require('../middleware/verificarAdmin');

router.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM vendedores WHERE activo = true ORDER BY nombre`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/tecnicos', async (req, res) => {
    try {
        const { rows: columns } = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'vendedores'
              AND column_name = 'rol'
        `);
        if (!columns.length) return res.json([]);

        const { rows } = await pool.query(
            `SELECT id, nombre FROM vendedores WHERE activo = true AND rol = 'tecnico' ORDER BY nombre`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', admin, async (req, res) => {
    const { nombre, email, whatsapp, rol, foto_url } = req.body;
    const { rows } = await pool.query(
        `INSERT INTO vendedores (nombre, email, whatsapp, rol, foto_url) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [nombre, email, whatsapp, rol || 'vendedor', foto_url || null]
    );
    res.json(rows[0]);
});

router.put('/:id', admin, async (req, res) => {
    const { id } = req.params;
    const { nombre, email, whatsapp, rol, foto_url } = req.body;
    try {
        const { rows } = await pool.query(
            `UPDATE vendedores SET nombre=$1, email=$2, whatsapp=$3, rol=$4, foto_url=$5 WHERE id=$6 RETURNING *`,
            [nombre, email, whatsapp, rol, foto_url || null, id]
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
