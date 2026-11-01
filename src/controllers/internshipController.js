const service = require('../services/internshipService');

exports.list = (req, res) => {
  const { data, pagination } = service.list(req.validated);
  res.status(200).json({ status: 'success', data, pagination });
};
exports.filters = (req, res) => res.status(200).json({ status: 'success', data: service.filters() });
exports.get = (req, res) => res.status(200).json({ status: 'success', data: service.getById(req.params.id) });
exports.create = (req, res) => res.status(201).json({ status: 'success', data: service.create(req.validated) });
exports.update = (req, res) => res.status(200).json({ status: 'success', data: service.update(req.params.id, req.validated) });
exports.remove = (req, res) => res.status(200).json({ status: 'success', data: service.remove(req.params.id) });
