const service = require('../services/applicationService');

exports.create = (req, res) => res.status(201).json({ status: 'success', data: service.create(req.validated) });
