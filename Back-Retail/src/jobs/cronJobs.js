const cron = require('node-cron');
const pool = require('../db/pool');

let io;

const init = (socketIo) => {
    io = socketIo;

    // Cada hora en horario hábil L-V y Sábados
    cron.schedule('0 * * * 1-6', async () => {
        await verificarInactividad();
        await cerrarNegociacionesFuturo();
    });

    console.log('[CRON] Jobs programados');
};

async function verificarInactividad() {
    try {
        const { rows } = await pool.query(`
      SELECT l.id, l.nombre, l.vendedor_id,
             v.nombre AS vendedor_nombre
      FROM leads l
      JOIN vendedores v ON v.id = l.vendedor_id
      WHERE l.estado = 'cotizado'
        AND l.alerta_inactividad_enviada = false
        AND l.ts_primera_respuesta IS NOT NULL
        AND business_minutes(l.ts_primera_respuesta, NOW()::timestamp) >= 960
    `);
        //960 = 2 días × 8 horas × 60 min

        for (const lead of rows) {
            await pool.query(
                `UPDATE leads SET alerta_inactividad_enviada = true WHERE id = $1`,
                [lead.id]
            );

            await pool.query(
                `INSERT INTO eventos_lead (lead_id, vendedor_id, tipo)
         VALUES ($1,$2,'alerta_inactividad')`,
                [lead.id, lead.vendedor_id]
            );

            // Emitir alerta al dashboard
            if (io) io.emit('lead:alerta_inactividad', lead);
            console.log(`[CRON] Alerta inactividad — Lead ${lead.id}: ${lead.nombre}`);
        }
    } catch (err) {
        console.error('[CRON] Error verificarInactividad:', err);
    }
}

async function cerrarNegociacionesFuturo() {
    try {
        const { rows } = await pool.query(`
      UPDATE leads
      SET estado = 'no_efectiva', resultado = 'perdido', ts_cierre = NOW()
      WHERE estado = 'negociacion_futuro'
        AND NOW() - creado_en > INTERVAL '30 days'
      RETURNING id, nombre, vendedor_id
    `);

        for (const lead of rows) {
            await pool.query(
                `INSERT INTO eventos_lead (lead_id, vendedor_id, tipo)
         VALUES ($1,$2,'auto_cierre_30_dias')`,
                [lead.id, lead.vendedor_id]
            );

            if (io) io.emit('lead:cerrado', lead);
        }

        if (rows.length > 0) {
            console.log(`[CRON] ${rows.length} leads cerrados por 30 días sin cierre`);
        }
    } catch (err) {
        console.error('[CRON] Error cerrarNegociacionesFuturo:', err);
    }
}

module.exports = { init };