const crypto = require('crypto');
const AppError = require('../utils/AppError');

// Protects internship write operations (POST/PUT/DELETE).
//  - ADMIN_API_KEY set      -> request must send it in the X-Admin-Key header (else 401)
//  - key unset, production  -> writes are disabled (403), so a public deploy is never open
//  - key unset, dev/test    -> open (keeps local development and the original API behaviour)
// Env is read per request so behaviour can be tested.
module.exports = (req, res, next) => {
  const key = process.env.ADMIN_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') return next(new AppError(403, 'ADMIN_DISABLED', 'Administrative write operations are disabled'));
    return next();
  }
  const sent = Buffer.from(String(req.get('x-admin-key') || ''));
  const want = Buffer.from(key);
  if (sent.length === want.length && crypto.timingSafeEqual(sent, want)) return next();
  next(new AppError(401, 'UNAUTHORIZED', 'A valid admin key is required'));
};
