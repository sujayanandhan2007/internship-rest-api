const router = require('express').Router();
const c = require('../controllers/applicationController');
const { validateApplication } = require('../validators/applicationValidator');

router.post('/', validateApplication, c.create);

module.exports = router;
