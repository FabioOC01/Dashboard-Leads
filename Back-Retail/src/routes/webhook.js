const router = require('express').Router();
const ctrl = require('../controllers/webhookController');
const verificar = require('../middleware/verificarWebhook');

router.post('/lead-creado', verificar, ctrl.leadCreado);
router.post('/vendedor-respondio', verificar, ctrl.vendedorRespondio);
router.post('/cotizacion-enviada', verificar, ctrl.cotizacionEnviada);
router.post('/lead-derivado', verificar, ctrl.leadDerivado);
router.post('/lead-cerrado', verificar, ctrl.leadCerrado);
router.post('/cotizacion-tecnico', verificar, ctrl.cotizacionTecnico);
router.post('/sheet-sync', verificar, ctrl.sheetSync);

module.exports = router;