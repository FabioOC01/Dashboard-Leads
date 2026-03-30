const router = require('express').Router();
const ctrl = require('../controllers/leadsController');

router.get('/', ctrl.getLeads);
router.get('/metricas', ctrl.getMetricas);
router.patch('/:id/estado', ctrl.actualizarEstado);

module.exports = router;