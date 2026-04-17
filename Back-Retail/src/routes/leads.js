const router = require('express').Router();
const ctrl = require('../controllers/leadsController');

router.get('/', ctrl.getLeads);
router.get('/metricas', ctrl.getMetricas);
router.get('/metricas-tecnico', ctrl.getMetricasTecnico);
router.patch('/:id/estado', ctrl.actualizarEstado);
router.patch('/:id/tiempos', ctrl.actualizarTiempos);
router.patch('/:id/vendedor', ctrl.actualizarVendedor);
router.patch('/:id/info', ctrl.actualizarInfo);
router.delete('/:id', ctrl.eliminarLead);

module.exports = router;