const AppError = require('../utils/AppError');
module.exports = (req, res, next) =>
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`));
