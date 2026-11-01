const { getDb } = require('../../database/db');
const AppError = require('../utils/AppError');

const COLS = 'id, title, domain, mode, location, skills, openings';
const toApi = (r) => ({
  id: r.id, title: r.title, domain: r.domain, mode: r.mode,
  location: r.location, skills: JSON.parse(r.skills), openings: r.openings
});
const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');
const notFound = (id) => new AppError(404, 'NOT_FOUND', `Internship ${id} not found`);

function list({ search, domain, mode, location, page, limit }) {
  const db = getDb();
  const where = [];
  const params = [];
  if (search) { // case-insensitive (ASCII) match on id, title, domain, mode, location or skills
    const cols = ['id', 'title', 'domain', 'mode', 'location', 'skills'];
    where.push(`(${cols.map((c) => `${c} LIKE ? ESCAPE '\\'`).join(' OR ')})`);
    for (let i = 0; i < cols.length; i++) params.push(`%${escapeLike(search)}%`);
  }
  if (domain) { where.push('domain = ? COLLATE NOCASE'); params.push(domain); }
  if (mode) { where.push('mode = ? COLLATE NOCASE'); params.push(mode); }
  if (location) { where.push('location = ? COLLATE NOCASE'); params.push(location); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM internships ${clause}`).get(...params).n;
  const rows = db
    .prepare(`SELECT ${COLS} FROM internships ${clause} ORDER BY id ASC LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit);
  return { data: rows.map(toApi), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

function filters() {
  const db = getDb();
  const uniq = (col) => db.prepare(`SELECT DISTINCT ${col} AS v FROM internships ORDER BY v`).all().map((r) => r.v);
  return { domains: uniq('domain'), modes: uniq('mode') };
}

function getById(id) {
  const row = getDb().prepare(`SELECT ${COLS} FROM internships WHERE id = ?`).get(id);
  if (!row) throw notFound(id);
  return toApi(row);
}

function create(d) {
  try {
    getDb()
      .prepare('INSERT INTO internships (id, title, domain, mode, location, skills, openings) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(d.id, d.title, d.domain, d.mode, d.location, JSON.stringify(d.skills), d.openings);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      throw new AppError(409, 'DUPLICATE_ID', `Internship ${d.id} already exists`);
    }
    throw err;
  }
  return getById(d.id);
}

// Single UPDATE statement = atomic; a failure leaves the row untouched.
function update(id, d) {
  const r = getDb()
    .prepare(`UPDATE internships SET title = ?, domain = ?, mode = ?, location = ?, skills = ?, openings = ?,
              updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(d.title, d.domain, d.mode, d.location, JSON.stringify(d.skills), d.openings, id);
  if (r.changes === 0) throw notFound(id);
  return getById(id);
}

function remove(id) {
  const r = getDb().prepare('DELETE FROM internships WHERE id = ?').run(id);
  if (r.changes === 0) throw notFound(id);
  return { id, deleted: true };
}

module.exports = { list, filters, getById, create, update, remove };
