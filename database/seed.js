const { getDb, closeDb } = require('./db');

const SEED = [
  { id: 'INT-101', title: 'Frontend Intern', domain: 'Full Stack Development', mode: 'Remote', location: 'India', skills: ['HTML', 'CSS', 'JavaScript'], openings: 3 },
  { id: 'INT-102', title: 'API Engineering Intern', domain: 'Full Stack Development', mode: 'Hybrid', location: 'Pune', skills: ['Node.js', 'SQL', 'Testing'], openings: 2 },
  { id: 'INT-103', title: 'UI/UX Intern', domain: 'UI/UX', mode: 'Remote', location: 'India', skills: ['Figma', 'Research', 'Accessibility'], openings: 1 },
  { id: 'INT-104', title: 'Data Analyst Intern', domain: 'Data Analytics', mode: 'On-site', location: 'Bengaluru', skills: ['Excel', 'SQL', 'Data visualisation'], openings: 2 },
  { id: 'INT-105', title: 'Security Operations Intern', domain: 'Cyber Security', mode: 'Remote', location: 'India', skills: ['Linux', 'Logs', 'Networking'], openings: 1 }
];

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
