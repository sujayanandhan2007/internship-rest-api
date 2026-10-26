const express = require('express');
const routes = require('./routes/internshipRoutes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'test') {
      res.on('finish', () => console.log(`${req.method} ${req.path} ${res.statusCode}`)); // never logs bodies
    }
    next();
  });
  app.use(express.json({ limit: process.env.BODY_LIMIT || '10kb' }));
  app.use('/api/internships', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
