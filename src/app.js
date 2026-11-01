const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const internshipRoutes = require('./routes/internshipRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const AppError = require('./utils/AppError');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1); // only behind a reverse proxy

  // Secure headers (CSP, X-Content-Type-Options, frame protection, HSTS, ...). Frontend uses no inline scripts/styles.
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: { 'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null }
    }
  }));

  app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'test') {
      res.on('finish', () => console.log(`${req.method} ${req.path} ${res.statusCode}`)); // never logs bodies or queries
    }
    next();
  });

  // Rate limit for application submissions (per client IP, in-memory store). Counts every request, valid or not.
  const applicationLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_MAX) || 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later'))
  });

  app.use(express.json({ limit: process.env.BODY_LIMIT || '10kb' }));
  app.use('/api/internships', internshipRoutes);
  app.use('/api/applications', applicationLimiter, applicationRoutes);
  app.use(express.static(path.join(__dirname, '..', 'public'))); // the Internship Board frontend
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
