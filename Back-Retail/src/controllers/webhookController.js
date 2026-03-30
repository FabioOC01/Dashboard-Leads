const pool = require('../db/pool');

exports.leadCreado = async (req, res) => {
    const {
        contact_id, nombre, celular, canal,
        campana, requerimiento, tipo, notas, asesor_asignado
    } = req.body;

    try {
        console.log("PAYLOAD COMPLETO DESDE SENDPULSE:", req.body);

        // Buscar vendedor por nombre
        const { rows: vendedores } = await pool.query(
            `SELECT id FROM vendedores WHERE nombre ILIKE $1 LIMIT 1`,
            [`%${asesor_asignado}%`]
        );

        let vendedor_id = vendedores.length > 0 ? vendedores[0].id : null;
        if (!vendedor_id && asesor_asignado) {
            const { rows: newV } = await pool.query(`INSERT INTO vendedores (nombre) VALUES ($1) RETURNING id`, [asesor_asignado]);
            vendedor_id = newV[0].id;
        }

        // Calcular ts_efectivo
        const { rows: tsRows } = await pool.query(
            `SELECT siguiente_momento_habil(NOW()) AS ts_efectivo`
        );
        const ts_efectivo = tsRows[0].ts_efectivo;

        const { rows } = await pool.query(
            `INSERT INTO leads
    (sendpulse_contact_id, nombre, celular, canal, campana,
     requerimiento, tipo, notas, vendedor_id, ts_lead_creado, ts_efectivo, estado)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,'nuevo')
   RETURNING *`,
            [contact_id, nombre, celular, canal, campana, requerimiento, tipo, notas, vendedor_id, ts_efectivo]
        );

        const lead = rows[0];
        lead.vendedor_nombre = asesor_asignado;

        await pool.query(
            `INSERT INTO eventos_lead (lead_id, vendedor_id, tipo)
       VALUES ($1,$2,'lead_creado')`,
            [lead.id, vendedor_id]
        );

        req.io.emit('lead:nuevo', lead);
        console.log(`[WEBHOOK] Lead creado: ${lead.id} — ${lead.nombre} → vendedor: ${asesor_asignado}`);
        res.json({ ok: true, lead });

    } catch (err) {
        console.error('[WEBHOOK] Error leadCreado:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── Vendedor marca primera respuesta ──
exports.vendedorRespondio = async (req, res) => {
    const { lead_id, contact_id, vendedor_id, asesor_asignado } = req.body;

    try {
        let v_id = vendedor_id;
        if (!v_id && asesor_asignado) {
            const { rows: v } = await pool.query(`SELECT id FROM vendedores WHERE nombre ILIKE $1 LIMIT 1`, [`%${asesor_asignado}%`]);
            if (v.length > 0) v_id = v[0].id;
            else {
                const { rows: newV } = await pool.query(`INSERT INTO vendedores (nombre) VALUES ($1) RETURNING id`, [asesor_asignado]);
                v_id = newV[0].id;
            }
        }

        const { rows } = await pool.query(
            `UPDATE leads
       SET ts_primera_respuesta = NOW(), estado = 'en_atencion', vendedor_id = COALESCE($3, vendedor_id)
       WHERE (id = $1 OR sendpulse_contact_id = $2) AND ts_primera_respuesta IS NULL
       RETURNING *`,
            [lead_id || null, contact_id || null, v_id]
        );

        if (!rows.length) {
            return res.json({ ok: false, msg: 'Ya registrado o lead no existe' });
        }

        const lead = rows[0];
        lead.vendedor_nombre = asesor_asignado; 

        await pool.query(
            `INSERT INTO eventos_lead (lead_id, vendedor_id, tipo)
       VALUES ($1,$2,'primera_respuesta')`,
            [lead.id, v_id]
        );

        req.io.emit('lead:actualizado', lead);
        console.log(`[WEBHOOK] Primera respuesta: ${lead.id} — ${lead.nombre}`);
        res.json({ ok: true, lead });

    } catch (err) {
        console.error('[WEBHOOK] Error vendedorRespondio:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── Vendedor marca cotización enviada ──
exports.cotizacionEnviada = async (req, res) => {
    const { lead_id, contact_id, vendedor_id, asesor_asignado } = req.body;

    try {
        let v_id = vendedor_id;
        if (!v_id && asesor_asignado) {
            const { rows: v } = await pool.query(`SELECT id FROM vendedores WHERE nombre ILIKE $1 LIMIT 1`, [`%${asesor_asignado}%`]);
            if (v.length > 0) v_id = v[0].id;
            else {
                const { rows: newV } = await pool.query(`INSERT INTO vendedores (nombre) VALUES ($1) RETURNING id`, [asesor_asignado]);
                v_id = newV[0].id;
            }
        }

        const { rows } = await pool.query(
            `UPDATE leads
       SET ts_cotizacion_enviada = NOW(), estado = 'cotizado', vendedor_id = COALESCE($3, vendedor_id)
       WHERE id = $1 OR sendpulse_contact_id = $2
       RETURNING *`,
            [lead_id || null, contact_id || null, v_id]
        );

        if (!rows.length) return res.json({ ok: false, msg: 'Lead no existe' });

        const lead = rows[0];
        lead.vendedor_nombre = asesor_asignado;

        await pool.query(
            `INSERT INTO eventos_lead (lead_id, vendedor_id, tipo)
       VALUES ($1,$2,'cotizacion_enviada')`,
            [lead.id, v_id]
        );

        req.io.emit('lead:actualizado', lead);
        console.log(`[WEBHOOK] Cotización enviada: ${lead.id} — ${lead.nombre}`);
        res.json({ ok: true, lead });

    } catch (err) {
        console.error('[WEBHOOK] Error cotizacionEnviada:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── Cierre del lead ──
exports.leadCerrado = async (req, res) => {
    const { lead_id, contact_id, vendedor_id, asesor_asignado, estado, resultado } = req.body;
    // estado: venta_efectiva | negociacion_futuro | no_efectiva
    // resultado: ganado | futuro | perdido

    try {
        let v_id = vendedor_id;
        if (!v_id && asesor_asignado) {
            const { rows: v } = await pool.query(`SELECT id FROM vendedores WHERE nombre ILIKE $1 LIMIT 1`, [`%${asesor_asignado}%`]);
            if (v.length > 0) v_id = v[0].id;
            else {
                const { rows: newV } = await pool.query(`INSERT INTO vendedores (nombre) VALUES ($1) RETURNING id`, [asesor_asignado]);
                v_id = newV[0].id;
            }
        }

        const { rows } = await pool.query(
            `UPDATE leads
       SET ts_cierre = NOW(), estado = $1, resultado = $2, vendedor_id = COALESCE($5, vendedor_id)
       WHERE id = $3 OR sendpulse_contact_id = $4
       RETURNING *`,
            [estado, resultado, lead_id || null, contact_id || null, v_id]
        );

        if (!rows.length) return res.json({ ok: false, msg: 'Lead no existe' });
        
        const lead = rows[0];
        lead.vendedor_nombre = asesor_asignado;

        await pool.query(
            `INSERT INTO eventos_lead (lead_id, vendedor_id, tipo, metadata)
       VALUES ($1,$2,'cierre',$3)`,
            [lead.id, v_id, JSON.stringify({ estado, resultado })]
        );

        req.io.emit('lead:cerrado', lead);
        console.log(`[WEBHOOK] Lead ${estado}: ${lead.id} — ${lead.nombre}`);
        res.json({ ok: true, lead });

    } catch (err) {
        console.error('[WEBHOOK] Error leadCerrado:', err);
        res.status(500).json({ error: err.message });
    }
};