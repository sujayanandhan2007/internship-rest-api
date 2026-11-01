const router = require('express').Router();
const c = require('../controllers/internshipController');
const { validateId, validateBody, validateQuery } = require('../validators/internshipValidator');

router.get('/', validateQuery, c.list);
router.post('/', validateBody(false), c.create);
router.get('/filters', c.filters); // must stay above '/:id'
router.get('/:id', validateId, c.get);
router.put('/:id', validateId, validateBody(true), c.update);
router.delete('/:id', validateId, c.remove);

module.exports = router;
