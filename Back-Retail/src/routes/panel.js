// src/routes/panel.js
const router = require('express').Router();
const pool = require('../db/pool');
const ctrl = require('../controllers/webhookController');

// Escape de HTML para evitar XSS al interpolar datos del lead en la plantilla
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
// Serializa un valor para incrustarlo de forma segura dentro de <script>
const jsLiteral = (v) => JSON.stringify(v ?? '').replace(/</g, '\\u003c');

// Página del panel para el vendedor
router.get('/:contact_id', async (req, res) => {
    const { contact_id } = req.params;

    try {
        const { rows } = await pool.query(
            `SELECT l.*, v.nombre AS vendedor_nombre
       FROM leads l
       LEFT JOIN vendedores v ON v.id = l.vendedor_id
       WHERE l.sendpulse_contact_id = $1`,
            [contact_id]
        );

        if (!rows.length) {
            return res.status(404).send('Lead no encontrado');
        }

        const lead = rows[0];

        // HTML simple optimizado para móvil
        res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lead — ${esc(lead.nombre)}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
          .card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          h2 { color: #1B4F72; margin-bottom: 8px; }
          p { color: #555; margin-bottom: 6px; font-size: 15px; }
          .label { font-weight: bold; color: #333; }
          .estado { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; }
          .nuevo { background: #D6EAF8; color: #1B4F72; }
          .en_atencion { background: #FEF3C7; color: #D97706; }
          .cotizado { background: #FDEBD0; color: #E67E22; }
          .venta_efectiva { background: #D5F5E3; color: #27AE60; }
          .no_efectiva { background: #FADBD8; color: #E74C3C; }
          .negociacion_futuro { background: #EAD7F7; color: #8E44AD; }
          .btn { display: block; width: 100%; padding: 14px; margin-bottom: 10px; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; transition: opacity 0.2s; }
          .btn:active { opacity: 0.7; }
          .btn-green  { background: #27AE60; color: white; }
          .btn-blue   { background: #2E86C1; color: white; }
          .btn-purple { background: #8E44AD; color: white; }
          .btn-red    { background: #E74C3C; color: white; }
          .btn-gray   { background: #95A5A6; color: white; }
          .disabled { opacity: 0.4; pointer-events: none; }
          .success-msg { background: #D5F5E3; color: #1E8449; padding: 12px; border-radius: 8px; text-align: center; font-weight: bold; display: none; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>${esc(lead.nombre)}</h2>
          <p><span class="label">Celular:</span> ${esc(lead.celular)}</p>
          <p><span class="label">Requerimiento:</span> ${esc(lead.requerimiento || '—')}</p>
          <p><span class="label">Canal:</span> ${esc(lead.canal || '—')}</p>
          <p><span class="label">Campaña:</span> ${esc(lead.campana || '—')}</p>
          <p><span class="label">Vendedor:</span> ${esc(lead.vendedor_nombre || '—')}</p>
          <p><span class="label">Estado:</span>
            <span class="estado ${esc(lead.estado)}">${esc(String(lead.estado).replace(/_/g, ' '))}</span>
          </p>
        </div>

        <div class="card">
          <div id="msg" class="success-msg">Acción registrada correctamente</div>

          ${lead.estado === 'nuevo' ? `
          <button class="btn btn-blue" onclick="accion('primera-respuesta')">
            Iniciar atención
          </button>` : ''}

          ${lead.estado === 'en_atencion' ? `
          <button class="btn btn-green" onclick="accion('cotizacion')">
            Cotización enviada
          </button>` : ''}

          ${['en_atencion', 'cotizado'].includes(lead.estado) ? `
          <button class="btn btn-green" onclick="cerrar('venta_efectiva', 'ganado')">
            Venta efectiva
          </button>
          <button class="btn btn-purple" onclick="cerrar('negociacion_futuro', 'futuro')">
            Negociación a futuro
          </button>
          <button class="btn btn-red" onclick="cerrar('no_efectiva', 'perdido')">
            No efectiva
          </button>` : ''}

          ${['venta_efectiva', 'no_efectiva'].includes(lead.estado) ? `
          <p style="text-align:center; color:#888; margin-top:10px">Lead cerrado</p>` : ''}
        </div>

        <script>
          const leadId = ${Number(lead.id)};
          const vendedorId = ${lead.vendedor_id ? Number(lead.vendedor_id) : 'null'};
          const contactId = ${jsLiteral(lead.sendpulse_contact_id)};

          async function accion(tipo) {
            const endpoints = {
              'primera-respuesta': '/panel/' + contactId + '/accion',
              'cotizacion': '/panel/' + contactId + '/cotizacion'
            };
            const res = await fetch(endpoints[tipo], {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lead_id: leadId, vendedor_id: vendedorId })
            });
            if (res.ok) mostrarExito();
          }

          async function cerrar(estado, resultado) {
            const res = await fetch('/panel/' + contactId + '/cerrar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lead_id: leadId, vendedor_id: vendedorId, estado, resultado })
            });
            if (res.ok) mostrarExito();
          }

          function mostrarExito() {
            document.getElementById('msg').style.display = 'block';
            setTimeout(() => location.reload(), 1500);
          }
        </script>
      </body>
      </html>
    `);
    } catch (err) {
        res.status(500).send('Error: ' + err.message);
    }
});

// Acciones del panel — el token nunca sale al cliente
router.post('/:contact_id/accion', (req, res) => {
    req.body.contact_id = req.params.contact_id;
    ctrl.vendedorRespondio(req, res);
});

router.post('/:contact_id/cotizacion', (req, res) => {
    req.body.contact_id = req.params.contact_id;
    ctrl.cotizacionEnviada(req, res);
});

router.post('/:contact_id/cerrar', (req, res) => {
    req.body.contact_id = req.params.contact_id;
    ctrl.leadCerrado(req, res);
});

module.exports = router;