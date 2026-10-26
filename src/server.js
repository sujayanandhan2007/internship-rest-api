require('dotenv').config();
const { createApp } = require('./app');
const { getDb, closeDb } = require('../database/db');

getDb(); // creates the database + table if missing (existing data is kept)
const port = process.env.PORT || 3000;
const server = createApp().listen(port, () => console.log(`Internship API running on http://localhost:${port}`));

function shutdown() {
  server.close(() => { closeDb(); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
