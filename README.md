# Internship Management REST API

A beginner-friendly REST API for managing internship records, built with **Node.js, Express and SQLite** (persistent storage), with validation, pagination, search/filtering, centralised error handling and automated tests.

## Problem statement
Build an API that stores internship records permanently and exposes list, detail, create, update and delete endpoints with validated input and consistent status codes and errors.

## Features
- CRUD for internships, persisted in SQLite (survives restarts)
- Pagination, case-insensitive title search, filters for domain / mode / location (combinable)
- Strict validation (trimmed strings, enum mode, skills array, positive-integer openings, unknown fields rejected)
- One success envelope and one error envelope; centralised error middleware
- Parameterized SQL everywhere, 10 kb body limit, no stack traces leaked in responses
- Idempotent seed script, Jest + Supertest tests on an isolated in-memory database

## Tech stack
Node.js (CommonJS), Express 4, better-sqlite3, dotenv, Jest, Supertest.

## Prerequisites
Node.js 18+ and npm.

## Setup
```bash
git clone <your-repo-url> internship-rest-api
cd internship-rest-api
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

### Environment (`.env`)
| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 3000 | HTTP port |
| `NODE_ENV` | development | `production` hides stack traces in logs |
| `DB_PATH` | ./data/internships.db | SQLite file location |
| `BODY_LIMIT` | 10kb | Max JSON body size |

### Database
```bash
npm run init-db   # creates data/internships.db and the table (safe to re-run, never erases data)
npm run seed      # inserts the 5 sample records (idempotent: re-running adds no duplicates)
```
The server also creates the database/table automatically on start, but does **not** seed or wipe it.

### Run
```bash
npm start         # http://localhost:3000
npm test          # runs all tests against an in-memory DB (your real DB is untouched)
```

## Endpoints
| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/api/internships` | 200 | 400 |
| GET | `/api/internships/:id` | 200 | 400, 404 |
| POST | `/api/internships` | 201 | 400, 409, 413 |
| PUT | `/api/internships/:id` | 200 | 400, 404, 413 |
| DELETE | `/api/internships/:id` | 200 | 400, 404 |
Unknown routes → 404 `ROUTE_NOT_FOUND`. Malformed JSON → 400 `INVALID_JSON`. Unexpected failures → 500 `INTERNAL_ERROR`.

**Query parameters (list):** `search` (case-insensitive title substring), `domain`, `mode`, `location` (case-insensitive exact match), `page` (default 1), `limit` (default 10, max 100). Results are ordered by `id` ascending. Filters apply before pagination; a page past the end returns `data: []` with status 200.

### Response formats
```json
{ "status": "success", "data": { } }
```
List responses add `"pagination": { "page": 1, "limit": 3, "total": 5, "totalPages": 2 }`. Delete returns `data: { "id": "INT-105", "deleted": true }`.
```json
{ "status": "error", "error": { "code": "VALIDATION_ERROR", "message": "One or more fields are invalid",
  "details": [ { "field": "mode", "message": "mode must be one of: Remote, Hybrid, On-site" } ] } }
```
Error codes: `VALIDATION_ERROR` (400), `INVALID_JSON` (400), `NOT_FOUND` (404), `ROUTE_NOT_FOUND` (404), `DUPLICATE_ID` (409), `PAYLOAD_TOO_LARGE` (413), `DATABASE_ERROR` / `INTERNAL_ERROR` (500).

## curl examples
```bash
curl "http://localhost:3000/api/internships"                                   # list
curl "http://localhost:3000/api/internships?page=2&limit=3"                    # pagination
curl "http://localhost:3000/api/internships?search=frontend"                   # search
curl "http://localhost:3000/api/internships?domain=Full%20Stack%20Development" # domain filter
curl "http://localhost:3000/api/internships?search=intern&mode=Remote&page=1&limit=5"  # combined
curl "http://localhost:3000/api/internships/INT-101"                           # details
curl -X POST http://localhost:3000/api/internships -H "Content-Type: application/json" \
  -d '{"id":"INT-106","title":"QA Intern","domain":"Quality Assurance","mode":"Hybrid","location":"Chennai","skills":["Testing","Jest"],"openings":2}'   # create -> 201
curl -X PUT http://localhost:3000/api/internships/INT-106 -H "Content-Type: application/json" \
  -d '{"title":"Senior QA Intern","domain":"Quality Assurance","mode":"Remote","location":"India","skills":["Testing"],"openings":4}'   # update -> 200
curl -X DELETE http://localhost:3000/api/internships/INT-106                   # delete -> 200
curl -X POST http://localhost:3000/api/internships -H "Content-Type: application/json" -d '{"id":"X","mode":"Mars"}'   # validation error -> 400
curl -i http://localhost:3000/api/internships/INT-999                          # missing -> 404
```
Status codes: 2xx = worked, 400 = fix your request, 404 = not found, 409 = ID already exists, 413 = body too large, 500 = server problem.

## Validation rules
- `id` (create only): required, 1–50 chars, letters/digits/`-`/`_`. Clients supply it; it is never auto-generated and cannot be changed (PUT rejects a body `id` that differs from the URL).
- `title`, `domain`, `location`: non-empty strings after trimming, max 100 chars.
- `mode`: exactly `Remote`, `Hybrid` or `On-site`.
- `skills`: array of 1–20 non-empty strings (max 50 chars each).
- `openings`: integer 1–10000 (numeric strings are rejected).
- Unknown body fields are rejected. PUT is a full replacement of all editable fields.

## Project structure
```
database/  schema.sql, db.js (connection + auto-create), seed.js
src/       app.js, server.js, routes/, controllers/, services/ (SQL), validators/, middleware/, utils/
tests/     internships.test.js
```

## Database schema
Table `internships`: `id` TEXT PRIMARY KEY, `title`, `domain`, `location` TEXT NOT NULL, `mode` TEXT NOT NULL with CHECK (3 allowed values), `skills` TEXT NOT NULL (JSON array, converted back to an array in responses), `openings` INTEGER NOT NULL CHECK (> 0), `created_at`, `updated_at`. Indexes on domain, mode, location.

## Sample data
Five fictional records `INT-101` … `INT-105` (Frontend, API Engineering, UI/UX, Data Analyst, Security Operations) in `database/seed.js`. The supplied `internship-board-sample.sql` uses a different shape (`duration_weeks`, `applications_open`), so this project follows the assignment's own data model instead.

## Limitations / future improvements
No authentication (out of scope); search is title-only and case-insensitive for ASCII; no sorting options or optional fields (company, deadline); `PATCH` not implemented; SQLite files may not persist on ephemeral hosts.

## Deployment note
Use a host with a persistent disk/volume (e.g. a VPS, or Render/Railway/Fly.io with a mounted volume) and set `DB_PATH` to that volume. On hosts with ephemeral filesystems the SQLite file is lost on redeploy; use PostgreSQL there. No deployment has been done for this repo.

## Two-minute demo script
1. `npm install && npm run init-db && npm run seed && npm start`
2. `curl "localhost:3000/api/internships?page=1&limit=3"` – show pagination.
3. `curl "localhost:3000/api/internships?search=intern&mode=Remote"` – show filters.
4. POST a new record (201), repeat it (409), send a bad mode (400).
5. PUT then DELETE it; GET it again (404).
6. Stop and restart the server, list again – data persists. Finish with `npm test`.

## Submission checklist
- [ ] Push to a **public** GitHub repository
- [ ] README renders correctly and commands work from a fresh clone
- [ ] `.env`, `data/`, `node_modules/` are not committed (`.env.example` is)
- [ ] `npm test` passes on your machine
- [ ] Submit the single repository link
