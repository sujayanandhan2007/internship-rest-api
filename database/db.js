require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

let db = null;

// Opens (or reuses) the connection and creates the table if missing. Never erases data.
function getDb() {
  if (db && db.open) return db;
  const file = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'internships.db');
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  return db;
}

function closeDb() {
  if (db && db.open) db.close();
  db = null;
}

module.exports = { getDb, closeDb };
