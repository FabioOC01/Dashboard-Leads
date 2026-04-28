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

    // Reenvío siempre al CRM (independiente de si el lead existe en Retail)
    forwardCotizacionToCRM(req.body);

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

// ── Sync desde Google Sheet (one-way, idempotente, upsert por sendpulse_contact_id) ──
const VENTA_TO_ESTADO = {
    'Efectiva':            { estado: 'venta_efectiva',     resultado: 'ganado',  cierre: true },
    'Negociación futura':  { estado: 'negociacion_futuro', resultado: 'futuro',  cierre: true },
    'Negociacion futura':  { estado: 'negociacion_futuro', resultado: 'futuro',  cierre: true },
    'No efectiva':         { estado: 'no_efectiva',        resultado: 'perdido', cierre: true },
    'En Atención':         { estado: 'en_atencion',        resultado: null,      cierre: false },
    'En Atencion':         { estado: 'en_atencion',        resultado: null,      cierre: false },
    'Cotizado':            { estado: 'cotizado',           resultado: null,      cierre: false, cotizado: true },
};

async function resolverVendedorId(nombre) {
    if (!nombre) return null;
    const { rows } = await pool.query(`SELECT id FROM vendedores WHERE nombre ILIKE $1 LIMIT 1`, [`%${nombre}%`]);
    if (rows.length > 0) return rows[0].id;
    const { rows: nuevo } = await pool.query(`INSERT INTO vendedores (nombre) VALUES ($1) RETURNING id`, [nombre]);
    return nuevo[0].id;
}

function normalizarCelular(c) {
    if (!c) return null;
    return String(c).replace(/\D/g, ''); // solo dígitos
}

exports.sheetSync = async (req, res) => {
    const leads = Array.isArray(req.body?.leads) ? req.body.leads : [];
    if (!leads.length) return res.json({ ok: true, processed: 0, inserted: 0, updated: 0, errors: [], results: [] });

    let inserted = 0, updated = 0, unchanged = 0;
    const errors = [];
    const results = []; // [{ row_contact_id_input, contact_id_resolved, celular }]

    for (const item of leads) {
        try {
            const {
                contact_id: contact_id_input, nombre, celular, canal, campana,
                requerimiento, tipo, asesor_asignado, observaciones, venta
            } = item;

            // Si viene vacío o es uno generado por el sheet (sheet_*), intentar match por celular
            // para vincular con el lead real que ya creó SendPulse.
            let contact_id = contact_id_input;
            const esSheetGenerado = !contact_id || String(contact_id).startsWith('sheet_');

            if (esSheetGenerado && celular) {
                const celNorm = normalizarCelular(celular);
                if (celNorm) {
                    const { rows: existentes } = await pool.query(
                        `SELECT sendpulse_contact_id
                         FROM leads
                         WHERE regexp_replace(celular, '\\D', '', 'g') = $1
                           AND sendpulse_contact_id IS NOT NULL
                         ORDER BY creado_en DESC
                         LIMIT 1`,
                        [celNorm]
                    );
                    if (existentes.length > 0) {
                        contact_id = existentes[0].sendpulse_contact_id;
                    }
                }
            }

            // Si tras buscar por celular sigue sin haber contact_id, generamos uno
            if (!contact_id) {
                contact_id = `sheet_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            }

            const map = VENTA_TO_ESTADO[venta?.toString().trim()] || null;
            const estado    = map?.estado    || 'nuevo';
            const resultado = map?.resultado || null;
            const ts_cierre = map?.cierre    ? 'NOW()' : 'NULL';
            const ts_cotizacion_enviada = map?.cotizado ? 'NOW()' : 'NULL';

            const vendedor_id = await resolverVendedorId(asesor_asignado);

            const { rows } = await pool.query(
                `INSERT INTO leads
                   (sendpulse_contact_id, nombre, celular, canal, campana,
                    requerimiento, tipo, notas, observaciones, vendedor_id,
                    estado, resultado, ts_lead_creado, ts_efectivo,
                    ts_cierre, ts_cotizacion_enviada)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
                         NOW(), siguiente_momento_habil(NOW()::timestamp),
                         ${ts_cierre}, ${ts_cotizacion_enviada})
                 ON CONFLICT (sendpulse_contact_id) DO UPDATE SET
                   nombre        = COALESCE(EXCLUDED.nombre, leads.nombre),
                   celular       = COALESCE(EXCLUDED.celular, leads.celular),
                   canal         = COALESCE(EXCLUDED.canal, leads.canal),
                   campana       = COALESCE(EXCLUDED.campana, leads.campana),
                   requerimiento = COALESCE(EXCLUDED.requerimiento, leads.requerimiento),
                   tipo          = COALESCE(EXCLUDED.tipo, leads.tipo),
                   observaciones = COALESCE(EXCLUDED.observaciones, leads.observaciones),
                   vendedor_id   = COALESCE(EXCLUDED.vendedor_id, leads.vendedor_id),
                   estado        = EXCLUDED.estado,
                   resultado     = COALESCE(EXCLUDED.resultado, leads.resultado),
                   ts_cierre              = COALESCE(leads.ts_cierre, EXCLUDED.ts_cierre),
                   ts_cotizacion_enviada  = COALESCE(leads.ts_cotizacion_enviada, EXCLUDED.ts_cotizacion_enviada)
                 RETURNING *,
                   (xmax = 0) AS inserted_flag,
                   (xmax <> 0) AS updated_flag`,
                [contact_id, nombre, celular ? String(celular) : null, canal, campana,
                 requerimiento, tipo, observaciones, observaciones, vendedor_id,
                 estado, resultado]
            );

            const lead = rows[0];
            const wasInserted = lead.inserted_flag === true;

            if (wasInserted) {
                inserted++;
                await pool.query(
                    `INSERT INTO eventos_lead (lead_id, vendedor_id, tipo, metadata)
                     VALUES ($1,$2,'lead_creado',$3)`,
                    [lead.id, vendedor_id, JSON.stringify({ origen: 'sheet_sync' })]
                );
                lead.vendedor_nombre = asesor_asignado;
                req.io.emit('lead:nuevo', lead);
                console.log(`[SHEET-SYNC] insert: ${lead.id} — ${lead.nombre} (${estado})`);
            } else {
                updated++;
                await pool.query(
                    `INSERT INTO eventos_lead (lead_id, vendedor_id, tipo, metadata)
                     VALUES ($1,$2,'sheet_sync',$3)`,
                    [lead.id, vendedor_id, JSON.stringify({ estado, resultado, venta })]
                );
                lead.vendedor_nombre = asesor_asignado;
                req.io.emit('lead:actualizado', lead);
                console.log(`[SHEET-SYNC] update: ${lead.id} — ${lead.nombre} (${estado})`);
            }

            results.push({
                input_contact_id:    contact_id_input || null,
                contact_id:          contact_id,
                celular:             celular || null,
                changed:             contact_id_input !== contact_id,
            });
        } catch (err) {
            console.error('[SHEET-SYNC] Error item:', item?.contact_id, err.message);
            errors.push({ contact_id: item?.contact_id || null, msg: err.message });
        }
    }

    res.json({ ok: true, processed: leads.length, inserted, updated, unchanged, errors, results });
};