const router = require('express').Router();
const { getDb } = require('../../database/db');
const logger = require('../utils/logger');

// Liveness + database connectivity. Exposes no paths, versions, secrets or error details.
router.get('/', (req, res) => {
  try {
    getDb().prepare('SELECT 1').get();
    res.status(200).json({ status: 'success', data: { status: 'ok', database: 'up', uptimeSeconds: Math.round(process.uptime()) } });
  } catch (err) {
    logger.error('health_check_failed', { code: err.code || 'UNKNOWN' });
    res.status(503).json({ status: 'error', error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' } });
  }
});
module.exports = router;
