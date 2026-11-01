const { getDb, closeDb } = require('./db');

// Source of truth: the supplied dataset, kept unchanged next to this file.
const SEED = require('./internship-records-sample.json').internships;

// Idempotent: INSERT OR IGNORE skips rows whose id already exists. Returns rows inserted.
function seed(db = getDb()) {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO internships (id, title, domain, mode, location, skills, openings)
     VALUES (@id, @title, @domain, @mode, @location, @skills, @openings)`
  );
  const run = db.transaction((rows) => {
    let inserted = 0;
    for (const r of rows) inserted += stmt.run({ ...r, skills: JSON.stringify(r.skills) }).changes;
    return inserted;
  });
  return run(SEED);
}

if (require.main === module) {
  const n = seed();
  console.log(`Seed complete: ${n} inserted, ${SEED.length - n} already present.`);
  closeDb();
}

module.exports = { seed, SEED };
