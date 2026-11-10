# InternBoard — Internship Portal (Production-Ready Capstone)

A full-stack internship portal: browse, search and filter internships, view details and submit an application. One Express process serves the REST API and the vanilla-JS frontend, backed by SQLite.

**Problem:** students need one simple place to find internships and apply, with a reliable, secure and accessible experience on mobile and desktop.

**Status:** see [Evidence](#evidence-summary). Deployment: **NOT DEPLOYED** (see [Deployment](#deployment)). Screenshots: none captured (no browser was available in the build environment).

## Key features
Internship list with search, domain/work-mode/location filters and pagination · detail dialog · application form with client + server validation · duplicate-application prevention · loading/empty/error/retry states · structured JSON logging · `/api/health` · rate limiting · secure headers · admin-key protection for write endpoints · responsive, keyboard-friendly UI.

## Tech stack
Node.js, Express 5 (CommonJS), better-sqlite3 / SQLite, Helmet, express-rate-limit, dotenv · HTML5, CSS3, vanilla JS · Jest, Supertest, jsdom, axe-core.

## Architecture
`routes → validators → controllers → services → SQLite`, with a central error handler and a JSON logger. Details: [docs/architecture.md](docs/architecture.md).

## Project structure
```
database/   schema.sql, db.js, seed.js, sample dataset
public/     index.html, css/styles.css, js/app.js
src/        app.js, server.js, routes/, controllers/, services/, validators/, middleware/, utils/
tests/      internships, applications, production (health/admin/logging/security), frontend (jsdom + axe)
docs/       architecture, security-checklist, test-report, accessibility-report, performance-report, walkthrough
```

## Prerequisites
Node.js 20+ and npm (needs to install `better-sqlite3`; a prebuilt binary is normally downloaded, otherwise build tools are required).

## Install, database, seed, run
```bash
npm ci
cp .env.example .env      # edit as needed
npm run init-db           # creates the DB + tables (never erases data)
npm run seed              # inserts the 5 sample internships (skips existing)
npm start                 # http://localhost:3000   (development)
NODE_ENV=production DB_PATH=/path/on/persistent/disk/internships.db ADMIN_API_KEY=... TRUST_PROXY=1 npm start   # production
```

## Environment variables
See [.env.example](.env.example): `PORT`, `NODE_ENV`, `DB_PATH`, `BODY_LIMIT`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `TRUST_PROXY`, `ADMIN_API_KEY`. Logging switches: none (JSON to stdout/stderr; silent under `NODE_ENV=test` unless `LOG_IN_TEST=1`).

## API
All responses use `{ "status": "success", "data": ... }` or `{ "status": "error", "error": { "code", "message", "details?" } }`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/internships?search=&domain=&mode=&location=&page=&limit=` | Paginated. `search` matches id, title, domain, mode, location, skills |
| GET | `/api/internships/filters` | `{ domains: [...], modes: [...] }` for the filter dropdowns |
| GET | `/api/health` | Liveness + DB check. `200 {data:{status:'ok',database:'up'}}` or `503 SERVICE_UNAVAILABLE` |
| GET | `/api/internships/:id` | One internship (public) |
| POST/PUT/DELETE | `/api/internships[/:id]` | **Admin only** — send `X-Admin-Key`. Without `ADMIN_API_KEY`: open in dev/test, `403 ADMIN_DISABLED` in production. Wrong/missing key: `401 UNAUTHORIZED` |
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


## Application workflow
Open portal → list loads from `/api/internships` → search/filter → *View details* → fill the form → client validation → `POST /api/applications` → confirmation, or a clear message for duplicate (409), validation (400, per field), rate limit (429), server (5xx) and network errors. Input is preserved on failure and the submit button is disabled while a request is in flight.

## Testing
```bash
npm test      # all suites, isolated in-memory SQLite; the real DB is never touched
```
Results and scope: [docs/test-report.md](docs/test-report.md).

## Security measures
Parameterized SQL · server-side validation (unsafe URL schemes rejected) · UNIQUE(internship_id, email) · 10 KB body limit · rate limiting on submissions · Helmet (CSP, HSTS in production, nosniff, frame protection) · admin-key protection (timing-safe compare) · safe error envelope (no stack/SQL details) · logs never contain applicant data, bodies, query strings or keys. Checklist: [docs/security-checklist.md](docs/security-checklist.md).

## Accessibility, performance
[docs/accessibility-report.md](docs/accessibility-report.md) — automated axe scan in jsdom passes; manual keyboard/screen-reader and colour-contrast audits are **not** done. [docs/performance-report.md](docs/performance-report.md) — local API timings and asset sizes measured; Lighthouse **not** run.

## Deployment
Not deployed. SQLite needs a persistent disk; Render documents persistent disks as available only on paid web services (free services have an ephemeral filesystem). `render.yaml` is provided (Starter plan, disk at `/var/data`, health check `/api/health`, generated `ADMIN_API_KEY`). Steps: push repo → Render *New → Blueprint* → select repo → apply → open `https://<service>.onrender.com/api/health` and test the journey. Railway (volume) or any VPS with a disk also works.

## Evidence summary
| Requirement | Status | Evidence |
|---|---|---|
| Frontend | PASS (functional) | 17 jsdom tests of the real page + script |
| Backend | PASS | API tests + live run against a temp DB |
| Database | PASS | constraint/duplicate tests, seed run |
| Mobile | NOT VERIFIED | no browser available; CSS has mobile rules, not visually checked |
| Accessibility | PARTIAL | axe scan clean (no contrast); no manual audit |
| Security | PARTIAL | tests + checklist; no external pen-test |
| Performance | PARTIAL | local timings only; Lighthouse NOT VERIFIED |
| Logging | PASS | tests incl. no-PII assertions; sample live output |
| Health check | PASS | live 200 + test for 503 |
| Documentation | PASS | this file + docs/ |
| Deployment | NOT DEPLOYED | needs your Render account |

## Known limitations
In-memory rate-limit store (resets on restart, single instance) · no user accounts (admin key only) · no CSRF tokens (no cookies/sessions) · single-instance SQLite · no browser-based verification yet.
