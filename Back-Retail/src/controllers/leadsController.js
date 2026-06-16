const pool = require('../db/pool');

// Leads para el dashboard — activos siempre, cerrados solo dentro del rango
exports.getLeads = async (req, res) => {
    const { desde } = req.query; // YYYY-MM-DD opcional

    try {
        const { rows } = await pool.query(`
      SELECT
        l.*,
        v.nombre AS vendedor_nombre,
        v.foto_url AS vendedor_foto_url,
        t.nombre AS tecnico_nombre,
        t.foto_url AS tecnico_foto_url,
        ROUND(EXTRACT(EPOCH FROM (l.ts_primera_respuesta - l.ts_efectivo)) / 60) AS min_primera_respuesta,
        ROUND(EXTRACT(EPOCH FROM (l.ts_cotizacion_enviada - l.ts_primera_respuesta)) / 60) AS min_cotizacion,
        CASE
          WHEN l.ts_primera_respuesta IS NULL THEN
            GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW()::timestamp - COALESCE(l.ts_efectivo, l.ts_lead_creado, l.creado_en))) / 60))
          ELSE NULL
        END AS min_esperando_respuesta,
        CASE
          WHEN l.ts_primera_respuesta IS NOT NULL AND l.ts_cotizacion_enviada IS NULL AND l.estado NOT IN ('derivado','venta_efectiva','no_efectiva','negociacion_futuro') THEN
            GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW()::timestamp - l.ts_primera_respuesta)) / 60))
          ELSE NULL
        END AS min_esperando_cotizacion,
        CASE
          WHEN l.estado = 'derivado' AND l.ts_derivado IS NOT NULL THEN
            GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW()::timestamp - l.ts_derivado)) / 60))
          ELSE NULL
        END AS min_esperando_soporte,
        CASE
          WHEN l.ts_derivado IS NOT NULL AND l.ts_cotizacion_tecnico IS NOT NULL THEN
            ROUND(EXTRACT(EPOCH FROM (l.ts_cotizacion_tecnico - l.ts_derivado)) / 60)
          WHEN l.ts_derivado IS NOT NULL AND l.ts_cotizacion_tecnico IS NULL AND l.estado = 'derivado' THEN
            GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW()::timestamp - l.ts_derivado)) / 60))
          ELSE NULL
        END AS min_soporte_cotizacion,
        CASE
          WHEN l.estado IN ('venta_efectiva','no_efectiva') AND l.ts_derivado IS NOT NULL AND l.ts_cierre IS NOT NULL THEN
            ROUND(EXTRACT(EPOCH FROM (l.ts_cierre - l.ts_derivado)) / 60)
          ELSE NULL
        END AS min_soporte_final,
        CASE
          WHEN l.estado IN ('venta_efectiva','no_efectiva','negociacion_futuro') AND l.ts_primera_respuesta IS NOT NULL AND l.ts_cotizacion_enviada IS NULL AND l.ts_cierre IS NOT NULL THEN
            ROUND(EXTRACT(EPOCH FROM (l.ts_cierre - l.ts_primera_respuesta)) / 60)
          ELSE NULL
        END AS min_cotizacion_final
      FROM leads l
      LEFT JOIN vendedores v ON v.id = l.vendedor_id
      LEFT JOIN vendedores t ON t.id = l.tecnico_id
      WHERE l.estado NOT IN ('venta_efectiva', 'no_efectiva')
         OR $1::date IS NULL
         OR COALESCE(l.ts_efectivo, l.ts_lead_creado) >= $1::date
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
        const { rows } = await pool.query(`
            SELECT
                v.id,
                v.nombre,
                COUNT(l.id) FILTER (WHERE l.estado NOT IN ('no_efectiva')) AS leads_activos,
                COUNT(l.id) FILTER (WHERE l.estado = 'venta_efectiva') AS ventas_efectivas,
                COUNT(l.id) FILTER (WHERE l.estado = 'no_efectiva') AS no_efectivas,
                COUNT(l.id) FILTER (WHERE l.estado = 'negociacion_futuro') AS en_seguimiento,
                ROUND(AVG(EXTRACT(EPOCH FROM (l.ts_primera_respuesta - l.ts_efectivo)) / 60)
                    FILTER (WHERE l.ts_primera_respuesta IS NOT NULL AND l.ts_efectivo IS NOT NULL)) AS avg_min_primera_respuesta,
                ROUND(AVG(EXTRACT(EPOCH FROM (l.ts_cotizacion_enviada - l.ts_primera_respuesta)) / 60)
                    FILTER (WHERE l.ts_cotizacion_enviada IS NOT NULL AND l.ts_primera_respuesta IS NOT NULL)) AS avg_min_cotizacion
            FROM vendedores v
            LEFT JOIN leads l ON l.vendedor_id = v.id
            WHERE v.activo = true
            GROUP BY v.id, v.nombre
            ORDER BY v.nombre
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Métricas del área técnica
exports.getMetricasTecnico = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                v.id,
                v.nombre,
                COUNT(l.id) AS leads_atendidos,
                COUNT(l.id) FILTER (WHERE l.estado = 'derivado') AS derivados_abiertos,
                COUNT(l.id) FILTER (WHERE l.estado = 'venta_efectiva') AS ventas_efectivas,
                COUNT(l.id) FILTER (WHERE l.estado = 'no_efectiva') AS no_efectivas,
                ROUND(AVG(EXTRACT(EPOCH FROM (l.ts_cotizacion_tecnico - l.ts_derivado)) / 60)
                    FILTER (WHERE l.ts_derivado IS NOT NULL AND l.ts_cotizacion_tecnico IS NOT NULL)) AS avg_min_soporte_cotizacion,
                ROUND(AVG(EXTRACT(EPOCH FROM (l.ts_cierre - l.ts_derivado)) / 60)
                    FILTER (WHERE l.ts_derivado IS NOT NULL AND l.ts_cierre IS NOT NULL
                              AND l.estado IN ('venta_efectiva', 'no_efectiva'))) AS avg_min_soporte_final
            FROM vendedores v
            LEFT JOIN leads l ON l.tecnico_id = v.id
            WHERE v.activo = true AND v.rol = 'tecnico'
            GROUP BY v.id, v.nombre
            HAVING COUNT(l.id) > 0
            ORDER BY leads_atendidos DESC, v.nombre
        `);
        res.json(rows);
    } catch (err) {
        if (!['42P01', '42703'].includes(err.code)) {
            return res.status(500).json({ error: err.message });
        }

        try {
            const { rows: leadColumns } = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'leads'
                  AND column_name IN ('tecnico_id', 'ts_derivado', 'ts_cotizacion_tecnico', 'ts_cierre')
            `);
            const { rows: vendorColumns } = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'vendedores'
                  AND column_name = 'rol'
            `);
            const leadCols = new Set(leadColumns.map(r => r.column_name));
            const hasRol = vendorColumns.length > 0;

            if (!leadCols.has('tecnico_id')) {
                return res.json([]);
            }

            const avgSoporteCotizacion = leadCols.has('ts_derivado') && leadCols.has('ts_cotizacion_tecnico')
                ? `ROUND(AVG(EXTRACT(EPOCH FROM (l.ts_cotizacion_tecnico - l.ts_derivado)) / 60)
                    FILTER (WHERE l.ts_derivado IS NOT NULL AND l.ts_cotizacion_tecnico IS NOT NULL))`
                : `NULL::numeric`;
            const avgSoporteFinal = leadCols.has('ts_derivado') && leadCols.has('ts_cierre')
                ? `ROUND(AVG(EXTRACT(EPOCH FROM (l.ts_cierre - l.ts_derivado)) / 60)
                    FILTER (WHERE l.ts_derivado IS NOT NULL AND l.ts_cierre IS NOT NULL
                              AND l.estado IN ('venta_efectiva', 'no_efectiva')))`
                : `NULL::numeric`;
            const roleFilter = hasRol ? `AND v.rol = 'tecnico'` : '';

            const { rows } = await pool.query(`
                SELECT
                    v.id,
                    v.nombre,
                    COUNT(l.id) AS leads_atendidos,
                    COUNT(l.id) FILTER (WHERE l.estado = 'derivado') AS derivados_abiertos,
                    COUNT(l.id) FILTER (WHERE l.estado = 'venta_efectiva') AS ventas_efectivas,
                    COUNT(l.id) FILTER (WHERE l.estado = 'no_efectiva') AS no_efectivas,
                    ${avgSoporteCotizacion} AS avg_min_soporte_cotizacion,
                    ${avgSoporteFinal} AS avg_min_soporte_final
                FROM vendedores v
                LEFT JOIN leads l ON l.tecnico_id = v.id
                WHERE v.activo = true ${roleFilter}
                GROUP BY v.id, v.nombre
                HAVING COUNT(l.id) > 0
                ORDER BY leads_atendidos DESC, v.nombre
            `);
            res.json(rows);
        } catch (fallbackErr) {
            res.status(500).json({ error: fallbackErr.message });
        }
    }
};

// Cambiar vendedor asignado
exports.actualizarVendedor = async (req, res) => {
    const { id } = req.params;
    const { vendedor_id } = req.body;
    try {
        const { rows } = await pool.query(
            `UPDATE leads SET vendedor_id = $1 WHERE id = $2
             RETURNING *,
               (SELECT nombre FROM vendedores WHERE id = $1) AS vendedor_nombre,
               (SELECT foto_url FROM vendedores WHERE id = $1) AS vendedor_foto_url`,
            [vendedor_id || null, id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Lead no encontrado' });
        req.io.emit('lead:actualizado', rows[0]);
        res.json({ ok: true, lead: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Eliminar lead
exports.eliminarLead = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`DELETE FROM eventos_lead WHERE lead_id = $1`, [id]);
        const { rowCount } = await pool.query(`DELETE FROM leads WHERE id = $1`, [id]);
        if (!rowCount) return res.status(404).json({ error: 'Lead no encontrado' });
        req.io.emit('lead:eliminado', { id: Number(id) });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Actualizar timestamps manualmente
exports.actualizarTiempos = async (req, res) => {
    const { id } = req.params;
    const { ts_efectivo, ts_primera_respuesta, ts_cotizacion_enviada, ts_derivado } = req.body;

    try {
        const { rows } = await pool.query(
            `UPDATE leads
             SET ts_efectivo          = COALESCE($1::timestamp, ts_efectivo),
                 ts_primera_respuesta = COALESCE($2::timestamp, ts_primera_respuesta),
                 ts_cotizacion_enviada = COALESCE($3::timestamp, ts_cotizacion_enviada),
                 ts_derivado          = COALESCE($5::timestamp, ts_derivado)
             WHERE id = $4
             RETURNING *,
               business_minutes(ts_efectivo, ts_primera_respuesta) AS min_primera_respuesta,
               business_minutes(ts_primera_respuesta, ts_cotizacion_enviada) AS min_cotizacion,
               CASE WHEN ts_primera_respuesta IS NULL THEN
                 business_minutes(ts_efectivo, momento_habil_vigente(NOW()::timestamp))
               ELSE NULL END AS min_esperando_respuesta`,
            [ts_efectivo || null, ts_primera_respuesta || null, ts_cotizacion_enviada || null, id, ts_derivado || null]
        );
        if (!rows.length) return res.status(404).json({ error: 'Lead no encontrado' });
        req.io.emit('lead:actualizado', rows[0]);
        res.json({ ok: true, lead: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Actualizar tipo, campaña y canal
exports.actualizarInfo = async (req, res) => {
    const { id } = req.params;
    const { tipo, campana, canal, observaciones } = req.body;
    try {
        const { rows } = await pool.query(
            `UPDATE leads SET tipo = $1, campana = $2, canal = $3, observaciones = $5 WHERE id = $4 RETURNING *`,
            [tipo || null, campana || null, canal || null, id, observaciones ?? null]
        );
        if (!rows.length) return res.status(404).json({ error: 'Lead no encontrado' });
        req.io.emit('lead:actualizado', rows[0]);
        res.json({ ok: true, lead: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Actualizar estado manualmente
exports.actualizarEstado = async (req, res) => {
    const { id } = req.params;
    const { estado, resultado, vendedor_id, tecnico_id } = req.body;

    try {
        const { rows } = await pool.query(
            `UPDATE leads SET estado = $1::varchar, resultado = $2,
        ts_primera_respuesta = CASE WHEN $1::varchar IN ('en_atencion','cotizado','derivado') AND ts_primera_respuesta IS NULL THEN NOW() ELSE ts_primera_respuesta END,
        ts_cierre   = CASE WHEN $1::varchar IN ('venta_efectiva','no_efectiva') THEN NOW() ELSE ts_cierre END,
        ts_derivado = CASE WHEN $1::varchar = 'derivado' AND ts_derivado IS NULL THEN NOW() ELSE ts_derivado END,
        tecnico_id  = CASE WHEN $1::varchar = 'derivado' THEN COALESCE($4, tecnico_id, 3) ELSE tecnico_id END
       WHERE id = $3
       RETURNING *, business_minutes(ts_efectivo, ts_primera_respuesta) AS min_primera_respuesta,
                    business_minutes(ts_primera_respuesta, ts_cotizacion_enviada) AS min_cotizacion,
                    CASE WHEN estado IN ('venta_efectiva','no_efectiva') AND ts_derivado IS NOT NULL AND ts_cierre IS NOT NULL
                         THEN business_minutes(ts_derivado, ts_cierre) ELSE NULL END AS min_soporte_final,
                    CASE WHEN estado IN ('venta_efectiva','no_efectiva','negociacion_futuro') AND ts_primera_respuesta IS NOT NULL AND ts_cotizacion_enviada IS NULL AND ts_cierre IS NOT NULL
                         THEN business_minutes(ts_primera_respuesta, ts_cierre) ELSE NULL END AS min_cotizacion_final`,
            [estado, resultado, id, tecnico_id ?? null]
        );

        await pool.query(
            `INSERT INTO eventos_lead (lead_id, vendedor_id, tipo, metadata)
       VALUES ($1,$2,'cambio_estado',$3)`,
            [id, vendedor_id, JSON.stringify({ estado, resultado })]
        );

        req.io.emit('lead:actualizado', rows[0]);
        if (estado === 'venta_efectiva') {
            req.io.emit('lead:venta_efectiva', rows[0]);
        }
        res.json({ ok: true, lead: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
