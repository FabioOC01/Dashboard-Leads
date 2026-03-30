const pool = require('../db/pool');

// Leads para el dashboard — activos siempre, cerrados solo dentro del rango
exports.getLeads = async (req, res) => {
    const { desde } = req.query; // YYYY-MM-DD opcional

    try {
        const { rows } = await pool.query(`
      SELECT
        l.*,
        v.nombre AS vendedor_nombre,
        business_minutes(l.ts_efectivo, l.ts_primera_respuesta)    AS min_primera_respuesta,
        business_minutes(l.ts_primera_respuesta, l.ts_cotizacion_enviada) AS min_cotizacion,
        CASE
          WHEN l.ts_primera_respuesta IS NULL THEN
            business_minutes(l.ts_efectivo, NOW())
          ELSE NULL
        END AS min_esperando_respuesta,
        CASE
          WHEN l.ts_primera_respuesta IS NOT NULL AND l.ts_cotizacion_enviada IS NULL THEN
            business_minutes(l.ts_primera_respuesta, NOW())
          ELSE NULL
        END AS min_esperando_cotizacion
      FROM leads l
      LEFT JOIN vendedores v ON v.id = l.vendedor_id
      WHERE l.estado NOT IN ('venta_efectiva', 'no_efectiva')
         OR $1::date IS NULL
         OR l.ts_lead_creado >= $1::date
      ORDER BY l.ts_lead_creado DESC
    `, [desde || null]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Métricas para el dashboard de gerencia
exports.getMetricas = async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT * FROM metricas_vendedor`);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Actualizar estado manualmente
exports.actualizarEstado = async (req, res) => {
    const { id } = req.params;
    const { estado, resultado, vendedor_id } = req.body;

    try {
        const { rows } = await pool.query(
            `UPDATE leads SET estado = $1, resultado = $2,
        ts_cierre = CASE WHEN $1 IN ('venta_efectiva','no_efectiva') THEN NOW() ELSE ts_cierre END
       WHERE id = $3 RETURNING *`,
            [estado, resultado, id]
        );

        await pool.query(
            `INSERT INTO eventos_lead (lead_id, vendedor_id, tipo, metadata)
       VALUES ($1,$2,'cambio_estado',$3)`,
            [id, vendedor_id, JSON.stringify({ estado, resultado })]
        );

        req.io.emit('lead:actualizado', rows[0]);
        res.json({ ok: true, lead: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};