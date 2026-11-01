const AppError = require('../utils/AppError');

const ID_RE = /^[A-Za-z0-9_-]{1,50}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{10,15}$/;
const FIELDS = ['name', 'email', 'phone', 'internshipId', 'resumeUrl', 'coverLetter'];
const CTRL_RE = /[\u0000-\u001F\u007F]/;                                  // any control character
const CTRL_TEXT_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;   // control chars except \t \n \r

function validateApplication(req, res, next) {
  const b = req.body;
  if (!b || typeof b !== 'object' || Array.isArray(b)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'One or more fields are invalid', [
      { field: 'body', message: 'Request body must be a JSON object' }
    ]);
  }
  const errors = [];
  const err = (field, message) => errors.push({ field, message });
  const out = {};

  for (const key of Object.keys(b)) if (!FIELDS.includes(key)) err(key, `Unexpected field "${key}"`);

  // Full name
  if (typeof b.name !== 'string' || b.name.trim() === '') err('name', 'Full name is required');
  else {
    const v = b.name.trim().replace(/\s+/g, ' ');
    if (v.length < 2 || v.length > 100) err('name', 'Full name must be 2-100 characters');
    else if (!/\p{L}/u.test(v) || CTRL_RE.test(v)) err('name', 'Full name must contain letters and no control characters');
    else out.name = v;
  }

  // Email
  if (typeof b.email !== 'string' || b.email.trim() === '') err('email', 'Email address is required');
  else {
    const v = b.email.trim();
    if (v.length > 254 || !EMAIL_RE.test(v)) err('email', 'Enter a valid email address');
    else out.email = v.toLowerCase();
  }

  // Phone: digits with optional leading +; spaces, dots, dashes and parentheses are ignored.
  if (typeof b.phone !== 'string' || b.phone.trim() === '') err('phone', 'Phone number is required');
  else {
    const v = b.phone.trim().replace(/[\s().-]/g, '');
    if (b.phone.length > 30 || !PHONE_RE.test(v)) err('phone', 'Enter a valid phone number (10-15 digits, optional leading +)');
    else out.phone = v;
  }

  // Internship ID (format here; existence is checked against the database in the service)
  if (typeof b.internshipId !== 'string' || !ID_RE.test(b.internshipId.trim())) {
    err('internshipId', 'Internship ID is required (letters, digits, "-" or "_")');
  } else out.internshipId = b.internshipId.trim();

  // Resume URL: http(s) only, no embedded credentials
  if (typeof b.resumeUrl !== 'string' || b.resumeUrl.trim() === '') err('resumeUrl', 'Resume URL is required');
  else {
    try {
      const u = new URL(b.resumeUrl.trim());
      if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.href.length > 2048) throw new Error('bad');
      out.resumeUrl = u.href;
    } catch {
      err('resumeUrl', 'Enter a valid http:// or https:// link');
    }
  }

  // Cover letter
  if (typeof b.coverLetter !== 'string' || b.coverLetter.trim() === '') err('coverLetter', 'Cover letter is required');
  else {
    const v = b.coverLetter.trim();
    if (v.length < 20 || v.length > 2000) err('coverLetter', 'Cover letter must be 20-2000 characters');
    else if (CTRL_TEXT_RE.test(v)) err('coverLetter', 'Cover letter contains invalid characters');
    else out.coverLetter = v;
  }

  if (errors.length) throw new AppError(400, 'VALIDATION_ERROR', 'One or more fields are invalid', errors);
  req.validated = out;
  next();
}

module.exports = { validateApplication };
