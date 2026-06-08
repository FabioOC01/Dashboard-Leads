const router = require('express').Router();
const ctrl = require('../controllers/leadsController');
const admin = require('../middleware/verificarAdmin');

// Lectura (dashboard) — pública en la red interna
router.get('/', ctrl.getLeads);
router.get('/metricas', ctrl.getMetricas);
router.get('/metricas-tecnico', ctrl.getMetricasTecnico);

// Mutaciones — requieren token de administrador
router.patch('/:id/estado', admin, ctrl.actualizarEstado);
router.patch('/:id/tiempos', admin, ctrl.actualizarTiempos);
router.patch('/:id/vendedor', admin, ctrl.actualizarVendedor);
router.patch('/:id/info', admin, ctrl.actualizarInfo);
router.delete('/:id', admin, ctrl.eliminarLead);

module.exports = router;