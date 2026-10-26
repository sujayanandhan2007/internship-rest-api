CREATE TABLE IF NOT EXISTS internships (
  id         TEXT PRIMARY KEY CHECK (length(trim(id)) > 0),
  title      TEXT NOT NULL CHECK (length(trim(title)) > 0),
  domain     TEXT NOT NULL CHECK (length(trim(domain)) > 0),
  mode       TEXT NOT NULL CHECK (mode IN ('Remote', 'Hybrid', 'On-site')),
  location   TEXT NOT NULL CHECK (length(trim(location)) > 0),
  skills     TEXT NOT NULL,                       -- JSON array stored as text
  openings   INTEGER NOT NULL CHECK (openings > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_internships_domain   ON internships (domain);
CREATE INDEX IF NOT EXISTS idx_internships_mode     ON internships (mode);
CREATE INDEX IF NOT EXISTS idx_internships_location ON internships (location);
