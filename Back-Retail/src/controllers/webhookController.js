const pool = require('../db/pool');

const CRM_WEBHOOK_URL   = process.env.CRM_WEBHOOK_URL   || 'http://localhost:3001/webhook/cotizacion-enviada';
const CRM_WEBHOOK_TOKEN = process.env.CRM_WEBHOOK_TOKEN || 'Comutel.2026.Comutel.2025';

function forwardCotizacionToCRM(body) {
    fetch(CRM_WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-webhook-token': CRM_WEBHOOK_TOKEN,
        },
        body: JSON.stringify(body),
    })
    .then(async r => {
        const text = await r.text();
        console.log(`[CRM forward] status=${r.status} body=${text}`);
    })
    .catch(err => console.error('[CRM forward] error:', err.message));
}

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

        const { rows } = await pool.query(
            `INSERT INTO leads
    (sendpulse_contact_id, nombre, celular, canal, campana,
     requerimiento, tipo, notas, vendedor_id, ts_lead_creado, ts_efectivo, estado)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),siguiente_momento_habil(NOW()::timestamp),'nuevo')
   RETURNING *`,
            [contact_id, nombre, celular, canal, campana, requerimiento, tipo, notas, vendedor_id]
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
       RETURNING *, business_minutes(ts_efectivo, ts_primera_respuesta) AS min_primera_respuesta`,
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
    const { lead_id, contact_id, vendedor_id, asesor_asignado, observaciones } = req.body;

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
       SET ts_cotizacion_enviada = NOW(), estado = 'cotizado', vendedor_id = COALESCE($3, vendedor_id),
           observaciones = COALESCE($4, observaciones)
       WHERE id = $1 OR sendpulse_contact_id = $2
       RETURNING *, business_minutes(ts_efectivo, ts_primera_respuesta) AS min_primera_respuesta,
                    business_minutes(ts_primera_respuesta, ts_cotizacion_enviada) AS min_cotizacion`,
            [lead_id || null, contact_id || null, v_id, observaciones || null]
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

        // Reenviar al CRM (fire-and-forget) para crear cliente + actividad Cotización
        forwardCotizacionToCRM(req.body);

        res.json({ ok: true, lead });

    } catch (err) {
        console.error('[WEBHOOK] Error cotizacionEnviada:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── Técnico envía cotización ──
exports.cotizacionTecnico = async (req, res) => {
    const { lead_id, contact_id, asesor_asignado, observaciones } = req.body;

    try {
        // Resolver tecnico_id por nombre sin tocar vendedor_id
        let tecnico_id = null;
        if (asesor_asignado) {
            const { rows: t } = await pool.query(
                `SELECT id FROM vendedores WHERE nombre ILIKE $1 LIMIT 1`,
                [`%${asesor_asignado}%`]
            );
            tecnico_id = t.length > 0 ? t[0].id : null;
        }

        const { rows } = await pool.query(
            `UPDATE leads
             SET ts_cotizacion_tecnico = NOW(),
                 estado = 'cotizado_tecnico',
                 tecnico_id = COALESCE($3, tecnico_id),
                 observaciones = COALESCE($4, observaciones)
             WHERE id = $1 OR sendpulse_contact_id = $2
             RETURNING *,
                 business_minutes(ts_efectivo, ts_primera_respuesta)          AS min_primera_respuesta,
                 business_minutes(ts_primera_respuesta, ts_cotizacion_enviada) AS min_cotizacion,
                 business_minutes(ts_derivado, ts_cotizacion_tecnico)          AS min_soporte_cotizacion`,
            [lead_id || null, contact_id || null, tecnico_id, observaciones || null]
        );

        if (!rows.length) return res.json({ ok: false, msg: 'Lead no existe' });

        const lead = rows[0];
        lead.tecnico_nombre = asesor_asignado;

        await pool.query(
            `INSERT INTO eventos_lead (lead_id, vendedor_id, tipo)
             VALUES ($1, $2, 'cotizacion_tecnico')`,
            [lead.id, lead.tecnico_id]
        );

        req.io.emit('lead:actualizado', lead);
        console.log(`[WEBHOOK] Cotización técnico: ${lead.id} — ${lead.nombre}`);
        res.json({ ok: true, lead });

    } catch (err) {
        console.error('[WEBHOOK] Error cotizacionTecnico:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── Lead derivado a soporte técnico ──
exports.leadDerivado = async (req, res) => {
    const { lead_id, contact_id, asesor_asignado } = req.body;

    try {
        // Buscar técnico por nombre si viene, si no default Elias (id=3)
        let tecnico_id = 3;
        if (asesor_asignado) {
            const { rows: t } = await pool.query(
                `SELECT id FROM vendedores WHERE nombre ILIKE $1 AND rol = 'tecnico' LIMIT 1`,
                [`%${asesor_asignado}%`]
            );
            if (t.length > 0) tecnico_id = t[0].id;
        }

        const { rows } = await pool.query(
            `UPDATE leads
             SET estado = 'derivado',
                 ts_derivado = NOW(),
                 tecnico_id = $3
             WHERE (id = $1 OR sendpulse_contact_id = $2)
               AND ts_derivado IS NULL
             RETURNING *`,
            [lead_id || null, contact_id || null, tecnico_id]
        );

        if (!rows.length) {
            return res.json({ ok: false, msg: 'Lead no existe o ya fue derivado' });
        }

        const lead = rows[0];

        await pool.query(
            `INSERT INTO eventos_lead (lead_id, vendedor_id, tipo)
             VALUES ($1, $2, 'derivado')`,
            [lead.id, tecnico_id]
        );

        req.io.emit('lead:actualizado', lead);
        console.log(`[WEBHOOK] Lead derivado: ${lead.id} — ${lead.nombre} → técnico id: ${tecnico_id}`);
        res.json({ ok: true, lead });

    } catch (err) {
        console.error('[WEBHOOK] Error leadDerivado:', err);
        res.status(500).json({ error: err.message });
    }
};

// ── Cierre del lead ──
exports.leadCerrado = async (req, res) => {
    const { lead_id, contact_id, vendedor_id, asesor_asignado, estado, resultado, observaciones } = req.body;
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

        // Si el lead fue derivado, el que cierra es el técnico → actualizar tecnico_id, no vendedor_id
        const { rows: check } = await pool.query(
            `SELECT ts_derivado FROM leads WHERE id = $1 OR sendpulse_contact_id = $2`,
            [lead_id || null, contact_id || null]
        );
        const esTecnico = check.length > 0 && check[0].ts_derivado !== null;

        const { rows } = await pool.query(
            esTecnico
                ? `UPDATE leads
                   SET ts_cierre = NOW(), estado = $1, resultado = $2,
                       tecnico_id = COALESCE($5, tecnico_id),
                       observaciones = COALESCE($6, observaciones)
                   WHERE id = $3 OR sendpulse_contact_id = $4
                   RETURNING *`
                : `UPDATE leads
                   SET ts_cierre = NOW(), estado = $1, resultado = $2,
                       vendedor_id = COALESCE($5, vendedor_id),
                       observaciones = COALESCE($6, observaciones)
                   WHERE id = $3 OR sendpulse_contact_id = $4
                   RETURNING *`,
            [estado, resultado, lead_id || null, contact_id || null, v_id, observaciones || null]
        );

        if (!rows.length) return res.json({ ok: false, msg: 'Lead no existe' });

        const lead = rows[0];
        if (esTecnico) lead.tecnico_nombre = asesor_asignado;
        else lead.vendedor_nombre = asesor_asignado;

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