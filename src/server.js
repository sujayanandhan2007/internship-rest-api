require('dotenv').config();
const { createApp } = require('./app');
const logger = require('./utils/logger');
const { getDb, closeDb } = require('../database/db');

getDb(); // creates the database + table if missing (existing data is kept)
const port = process.env.PORT || 3000;
const server = createApp().listen(port, () => logger.info('server_started', { port: Number(port), env: process.env.NODE_ENV || 'development', adminWrites: process.env.ADMIN_API_KEY ? 'key-protected' : (process.env.NODE_ENV === 'production' ? 'disabled' : 'open') }));

function shutdown() {
  logger.info('server_stopping');
  server.close(() => { closeDb(); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
