const { getDb } = require('../../database/db');
const AppError = require('../utils/AppError');

// All SQL is parameterized. Duplicates are enforced by UNIQUE (internship_id, email) in the schema.
function create(d) {
  const db = getDb();
  const notFound = () => new AppError(404, 'INTERNSHIP_NOT_FOUND', `Internship ${d.internshipId} not found`);
  if (!db.prepare('SELECT 1 FROM internships WHERE id = ?').get(d.internshipId)) throw notFound();
  try {
    const info = db
      .prepare('INSERT INTO applications (internship_id, full_name, email, phone, resume_url, cover_letter) VALUES (?, ?, ?, ?, ?, ?)')
      .run(d.internshipId, d.name, d.email, d.phone, d.resumeUrl, d.coverLetter);
    const row = db.prepare('SELECT id, internship_id, created_at FROM applications WHERE id = ?').get(info.lastInsertRowid);
    return { id: row.id, internshipId: row.internship_id, createdAt: row.created_at };
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new AppError(409, 'DUPLICATE_APPLICATION', 'You have already applied to this internship with this email');
    }
    if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') throw notFound();
    throw err;
  }
}

module.exports = { create };
