# Internship Board — Secure Application Integration

Full-stack internship board: a vanilla HTML/CSS/JS frontend (`public/`, from the *responsive-internship-board* project) served by the Express + SQLite API (from *internship-rest-api*). Visitors browse/search/filter internships from the API and submit a validated application. Validation and security are enforced on the server; client-side checks are only for convenience.

## Tech stack
Node.js 18+ (CommonJS), Express 5, better-sqlite3 (SQLite), Helmet, express-rate-limit, dotenv · Frontend: plain HTML/CSS/JS (no build step) · Tests: Jest + Supertest.

## Project structure
```
database/   schema.sql (internships + applications), db.js, seed.js, internship-records-sample.json (supplied dataset)
public/     index.html, css/styles.css, js/app.js        <- frontend, served by Express at /
src/        app.js (helmet, rate limit, routes, static), routes/, controllers/, services/, validators/, middleware/, utils/
tests/      internships.test.js, applications.test.js
```

## Prerequisites
Node.js 18+ and npm (a C/C++ toolchain is needed only if no prebuilt `better-sqlite3` binary exists for your platform).

## Install & run
```bash
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm run init-db             # creates data/internships.db and tables (safe to re-run; never erases data)
npm run seed                # loads database/internship-records-sample.json (idempotent)
npm start                   # backend + frontend on http://localhost:3000
```
There is a single process: the frontend has no separate dev server or build step (`npm start` serves both).

### Environment (`.env.example`)
| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 3000 | HTTP port |
| `NODE_ENV` | development | `production` hides stack traces in logs and enables CSP `upgrade-insecure-requests` |
| `DB_PATH` | ./data/internships.db | SQLite file |
| `BODY_LIMIT` | 10kb | Max JSON body |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | 10 / 900000 | Application submissions per IP per window |
| `TRUST_PROXY` | unset | Number of reverse proxies in front of the app (set when deployed behind one, so the real client IP is rate-limited) |

### Database setup / "migrations"
`database/schema.sql` uses `CREATE TABLE IF NOT EXISTS`; `npm run init-db` (and server start) applies it, so existing databases gain the new `applications` table without data loss. There is no separate migration tool.

## API
All responses use `{ "status": "success", "data": ... }` or `{ "status": "error", "error": { "code", "message", "details?" } }`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/internships?search=&domain=&mode=&location=&page=&limit=` | Paginated. `search` matches id, title, domain, mode, location, skills |
| GET | `/api/internships/filters` | `{ domains: [...], modes: [...] }` for the filter dropdowns |
| GET/POST/PUT/DELETE | `/api/internships[/:id]` | Existing CRUD (unchanged) |
| POST | `/api/applications` | Submit an application (rate limited) |

```bash
curl "http://localhost:3000/api/internships?limit=2"
# {"status":"success","data":[{"id":"INT-101",...},{"id":"INT-102",...}],"pagination":{"page":1,"limit":2,"total":5,"totalPages":3}}

curl -X POST http://localhost:3000/api/applications -H 'Content-Type: application/json' -d '{
  "name":"Asha Raman","email":"asha@example.com","phone":"+91 98765 43210","internshipId":"INT-101",
  "resumeUrl":"https://example.com/cv.pdf","coverLetter":"I enjoy building accessible web interfaces."}'
# 201 {"status":"success","data":{"id":1,"internshipId":"INT-101","createdAt":"2026-11-01 04:09:18"}}
```
Application errors: `400 VALIDATION_ERROR` (with `details: [{field,message}]`), `400 INVALID_JSON`, `404 INTERNSHIP_NOT_FOUND`, `409 DUPLICATE_APPLICATION`, `413 PAYLOAD_TOO_LARGE`, `429 RATE_LIMITED`, `500 DATABASE_ERROR / INTERNAL_ERROR` (no internals exposed).

Application rules: name 2-100 chars with letters (whitespace-only rejected); email format; phone 10-15 digits with optional leading `+` (spaces, dots, dashes, brackets ignored); internship ID must exist; resume URL must be `http://` or `https://` without embedded credentials (`javascript:`, `data:`, `file:`, `ftp:` etc. rejected); cover letter 20-2000 chars; unknown fields rejected.

## Tests
```bash
npm test
```
Tests run on an isolated in-memory SQLite database; no real data is touched.

**Test report (actual run, 2026-11-01):** 2 suites, **89 tests: 89 passed, 0 failed, 0 skipped.** Covers: dataset served unchanged, successful application, missing/whitespace name, invalid email/phone/resume URL (incl. `javascript:`/`data:`), unknown and malformed internship ID, duplicate application (API + direct DB constraint), malformed/oversized/non-JSON requests, SQL-injection text stored literally, security headers, HTTP 429 rate limiting, safe 500 on database failure, frontend served.

## Security checklist
- [x] Server-side validation of every field, independent of the frontend
- [x] Rate limiting on `POST /api/applications` (HTTP 429, in-memory per-IP store; resets on restart and is per instance)
- [x] Helmet security headers incl. CSP (`script-src 'self'`); `x-powered-by` disabled
- [x] Parameterized SQL only; `LIKE` wildcards escaped
- [x] DB constraints: `UNIQUE(internship_id, email)`, foreign key, CHECKs on URL scheme and lengths
- [x] 10 kb body limit; unknown fields and non-object bodies rejected
- [x] Logs contain method, path and status only (no bodies, queries, tokens or applicant data); error responses never include stack traces or SQL errors
- [x] Frontend inserts API data with `textContent` only (no `innerHTML`)
- [ ] Not implemented: authentication on the internship CRUD endpoints (POST/PUT/DELETE `/api/internships` are open, as in the original API), CSRF tokens (no cookies/sessions are used), persistent/shared rate-limit store

## Frontend, accessibility and responsive notes
- Loading, empty and error states; the error state has a working **Retry** button; failed or malformed API responses show the error state — there is **no hardcoded/static fallback data**.
- Stale list requests are aborted; the submit button is disabled and double submits are ignored while a request is in flight; form input is kept after a failed submission.
- Labels on all fields, `aria-describedby` error messages, `aria-invalid`, focus moved to the first invalid field or the status message, visible `:focus-visible` outline, skip link, 44 px controls.
- Evidence actually gathered: a scripted jsdom run against the live server (list, search, empty state, dialog, client validation, `javascript:` URL rejection, successful submit, duplicate message, preserved input, error state with Retry when the server is down) with no script errors. **Not yet verified in a real browser:** 360 px layout / no horizontal scroll, visual focus rings, and the browser console. Please check these manually (DevTools device toolbar at 360 px).

## Deployment
Not deployed. The app needs a Node host with persistent disk for the SQLite file (it cannot run on GitHub Pages, which previously served the static-only version). Set `NODE_ENV=production`, `DB_PATH` on the persistent volume, and `TRUST_PROXY=1` behind a proxy; run `npm ci && npm run init-db && npm run seed && npm start`.
