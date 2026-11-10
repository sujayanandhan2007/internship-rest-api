const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Centralised error handler: always responds with the documented error envelope.
module.exports = (err, req, res, next) => {
  let status = 500, code = 'INTERNAL_ERROR', message = 'Internal server error', details;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err.type === 'entity.parse.failed') {
    status = 400; code = 'INVALID_JSON'; message = 'Request body contains invalid JSON';
  } else if (err.type === 'entity.too.large') {
    status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'Request body is too large';
  } else if (typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT_PRIMARYKEY')) {
    status = 409; code = 'DUPLICATE_ID'; message = 'Resource already exists';
  } else if (typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    status = 400; code = 'CONSTRAINT_ERROR'; message = 'Data violates a database constraint';
  } else if (typeof err.code === 'string' && err.code.startsWith('SQLITE_')) {
    code = 'DATABASE_ERROR'; message = 'A database error occurred';
  } else if (err.status >= 400 && err.status < 500) {
    status = err.status; code = 'BAD_REQUEST'; message = 'Bad request';
  }

  if (status >= 500) logger.error('request_failed', { method: req.method, path: req.path, status, code, errorName: err.name, sqliteCode: err.code && String(err.code).startsWith('SQLITE_') ? err.code : undefined });
  res.status(status).json({ status: 'error', error: { code, message, ...(details && { details }) } });
};
