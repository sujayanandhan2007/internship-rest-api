const AppError = require('../utils/AppError');

const MODES = ['Remote', 'Hybrid', 'On-site'];
const ID_RE = /^[A-Za-z0-9_-]{1,50}$/;
const FIELDS = ['title', 'domain', 'mode', 'location', 'skills', 'openings'];
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

function fail(errors) {
  throw new AppError(400, 'VALIDATION_ERROR', 'One or more fields are invalid', errors);
}

function cleanString(value, field, errors, max = 100) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push({ field, message: `${field} is required and must be a non-empty string` });
    return undefined;
  }
  const v = value.trim();
  if (v.length > max) errors.push({ field, message: `${field} must be at most ${max} characters` });
  return v;
}

function validateId(req, res, next) {
  if (!ID_RE.test(req.params.id)) {
    fail([{ field: 'id', message: 'id must be 1-50 characters: letters, digits, "-" or "_"' }]);
  }
  next();
}

function validateBody(isUpdate) {
  return (req, res, next) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      fail([{ field: 'body', message: 'Request body must be a JSON object' }]);
    }
    const errors = [];
    const out = {};

    for (const key of Object.keys(body)) {
      if (key === 'id' && isUpdate) {
        if (body.id !== req.params.id) errors.push({ field: 'id', message: 'id cannot be changed' });
      } else if (key !== 'id' && !FIELDS.includes(key)) {
        errors.push({ field: key, message: `Unexpected field "${key}"` });
      }
    }

    if (!isUpdate) out.id = cleanString(body.id, 'id', errors, 50);
    if (out.id !== undefined && !ID_RE.test(out.id)) {
      errors.push({ field: 'id', message: 'id may contain only letters, digits, "-" or "_"' });
    }
    out.title = cleanString(body.title, 'title', errors);
    out.domain = cleanString(body.domain, 'domain', errors);
    out.location = cleanString(body.location, 'location', errors);

    if (!MODES.includes(body.mode)) {
      errors.push({ field: 'mode', message: `mode must be one of: ${MODES.join(', ')}` });
    } else out.mode = body.mode;

    if (!Array.isArray(body.skills) || body.skills.length === 0 || body.skills.length > 20) {
      errors.push({ field: 'skills', message: 'skills must be an array of 1-20 non-empty strings' });
    } else if (body.skills.some((s) => typeof s !== 'string' || s.trim() === '' || s.trim().length > 50)) {
      errors.push({ field: 'skills', message: 'every skill must be a non-empty string (max 50 characters)' });
    } else out.skills = body.skills.map((s) => s.trim());

    if (!Number.isInteger(body.openings) || body.openings < 1 || body.openings > 10000) {
      errors.push({ field: 'openings', message: 'openings must be a positive integer (1-10000)' });
    } else out.openings = body.openings;

    if (errors.length) fail(errors);
    req.validated = out;
    next();
  };
}

function parsePositiveInt(raw, field, def, max, errors) {
  if (raw === undefined) return def;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw) || Number(raw) < 1 || (max && Number(raw) > max)) {
    errors.push({ field, message: `${field} must be a positive integer${max ? ` (max ${max})` : ''}` });
    return def;
  }
  return Number(raw);
}

function validateQuery(req, res, next) {
  const q = req.query;
  const errors = [];
  const out = {};
  for (const key of ['search', 'domain', 'mode', 'location']) {
    if (q[key] === undefined) continue;
    if (typeof q[key] !== 'string') errors.push({ field: key, message: `${key} must be a single string` });
    else if (q[key].trim() !== '') {
      if (q[key].trim().length > 100) errors.push({ field: key, message: `${key} is too long` });
      out[key] = q[key].trim();
    }
  }
  if (out.mode && !MODES.some((m) => m.toLowerCase() === out.mode.toLowerCase())) {
    errors.push({ field: 'mode', message: `mode must be one of: ${MODES.join(', ')}` });
  }
  out.page = parsePositiveInt(q.page, 'page', 1, 1000000, errors);
  out.limit = parsePositiveInt(q.limit, 'limit', DEFAULT_LIMIT, MAX_LIMIT, errors);
  if (errors.length) fail(errors);
  req.validated = out;
  next();
}

module.exports = { validateId, validateBody, validateQuery, MODES };
