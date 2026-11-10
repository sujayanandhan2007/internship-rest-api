# Performance report (local, production mode, temp DB, 50 requests each, 2026-11-10)
| Endpoint | avg | p95 |
|---|---|---|
| GET /api/health | 1.4 ms | 1.4 ms |
| GET /api/internships?limit=6 | 1.9 ms | 4.8 ms |
| GET /api/internships/INT-101 | 1.6 ms | 3.1 ms |
| GET / | 1.6 ms | 3.3 ms |
Assets (raw / gzip): index.html 5.2 KB / 1.6 KB · styles.css 7.5 KB / 2.2 KB · app.js 11.4 KB / 4.1 KB. No frameworks, no external requests; pagination is server-side (LIMIT/OFFSET) with indexes on domain, mode, location.
**NOT VERIFIED:** Lighthouse / Core Web Vitals (no browser), behaviour under concurrent load, deployed latency. Compression middleware was not added (not justified by measurements; hosts/proxies usually gzip).
