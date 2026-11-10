# Security checklist (status = what was verified)
| Control | Status | Evidence |
|---|---|---|
| Server-side validation | Verified | applications.test.js (89-test baseline) |
| SQL injection | Verified | parameterized SQL; injection strings tested (search, domain, form fields) |
| Unsafe URL schemes | Verified | javascript:, data:, file:, ftp: rejected (production.test.js) |
| Duplicate applications | Verified | API 409 + DB UNIQUE constraint |
| Rate limiting | Verified | 429 test; live run |
| Body size limit | Verified | 413 test; live run (20 KB → 413) |
| Secure headers | Verified | CSP, HSTS (production), nosniff, X-Frame-Options seen in live run; x-powered-by hidden |
| Admin writes | Verified | 401 wrong/no key; 403 in production without key; reads public |
| Safe errors | Verified | 500/503 bodies contain no stack/SQL/path |
| Logs free of PII/secrets | Verified | test asserts name, email, resume URL, phone, admin key, query string absent; live log grep = 0 matches |
| Double submit | Verified | frontend test: 3 submits → 1 request |
| XSS | Verified (unit) | dataset text inserted with textContent; test with `<img onerror>` |
| Dependency audit | Verified | `npm audit --omit=dev`: 0 vulnerabilities (2026-11-10) |
| CORS | Not configured | same-origin only; no cross-origin access intended |
| CSRF | N/A | no cookies/sessions |
Not done: external penetration test, shared rate-limit store.
