# Architecture
Single Node process: Express serves `public/` (static) and `/api/*`. SQLite file via better-sqlite3 (WAL, foreign keys ON).

Request flow: `helmet → request logger → /api/health | /api/internships (+requireAdmin on writes) | /api/applications (rate limiter) → validators → controllers → services → SQLite → errorHandler (uniform envelope)`.

Tables: `internships` (id PK, mode CHECK, openings > 0) and `applications` (FK to internships, UNIQUE(internship_id, email), resume_url CHECK http/https).
Decisions: kept Express/SQLite/vanilla JS (no rewrite needed); one shared admin key instead of user auth (smallest safe option for a demo); logger is a ~10-line JSON writer, no new dependency.
