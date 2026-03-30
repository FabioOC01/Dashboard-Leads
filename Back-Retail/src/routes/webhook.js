const router = require('express').Router();
const ctrl = require('../controllers/webhookController');
const verificar = require('../middleware/verificarWebhook');

router.post('/lead-creado', verificar, ctrl.leadCreado);
router.post('/vendedor-respondio', verificar, ctrl.vendedorRespondio);
router.post('/cotizacion-enviada', verificar, ctrl.cotizacionEnviada);
router.post('/lead-cerrado', verificar, ctrl.leadCerrado);

module.exports = router;