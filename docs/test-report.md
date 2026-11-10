# Test report (executed 2026-11-10, `npm test`)
Result: **4 suites, 118 tests, 118 passed, 0 failed, exit code 0.**
- Baseline (existing, unchanged): 89 tests — reproduced before any change.
- `production.test.js` (new): health 200/503, admin key behaviour, log contents/no-PII, SQLi, unsafe URLs, headers.
- `frontend.test.js` (new, jsdom, mocked fetch): initial load, search, domain+mode filters, empty, error+Retry, 500, dialog, client validation, success, duplicate 409, server field errors, 500 + network failure, 429, double submit, XSS-safe rendering, axe scan.
All tests use in-memory SQLite or mocked fetch. Not covered: real-browser tests (no browser available), true database corruption.
Known harness note: jsdom prints a "HTMLCanvasElement.getContext not implemented" notice from axe-core; it is not a failure.
