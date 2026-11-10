process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.RATE_LIMIT_MAX = '1000';
process.env.LOG_IN_TEST = '1'; // enable the logger so we can inspect what it writes
const request = require('supertest');
const { createApp } = require('../src/app');
const dbModule = require('../database/db');
const { seed } = require('../database/seed');

const app = createApp();
const valid = { name: 'Priya Secret-Name', email: 'priya.secret@example.com', phone: '+91 98765 43210', internshipId: 'INT-101',
  resumeUrl: 'https://example.com/private-resume-xyz.pdf', coverLetter: 'Cover letter with private content 12345.' };
const newInternship = { id: 'INT-900', title: 'QA Intern', domain: 'Testing', mode: 'Remote', location: 'Chennai', skills: ['Jest'], openings: 2 };

beforeEach(() => { const db = dbModule.getDb(); db.exec('DELETE FROM applications; DELETE FROM internships'); seed(); });
afterEach(() => { delete process.env.ADMIN_API_KEY; process.env.NODE_ENV = 'test'; jest.restoreAllMocks(); });
afterAll(dbModule.closeDb);

describe('GET /api/health', () => {
  test('200 with app and database status, no sensitive data', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toMatchObject({ status: 'ok', database: 'up' });
    expect(JSON.stringify(res.body)).not.toMatch(/\.db|password|secret|stack/i);
  });
  test('503 with safe error envelope when the database is unavailable', async () => {
    jest.spyOn(dbModule.getDb(), 'prepare').mockImplementation(() => { throw Object.assign(new Error('disk I/O error at /secret/path.db'), { code: 'SQLITE_IOERR' }); });
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'error', error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' } });
  });
});

describe('admin write protection', () => {
  test('with ADMIN_API_KEY set: no key / wrong key -> 401, correct key -> allowed, reads stay public', async () => {
    process.env.ADMIN_API_KEY = 'test-key-123';
    expect((await request(app).post('/api/internships').send(newInternship)).status).toBe(401);
    expect((await request(app).post('/api/internships').set('X-Admin-Key', 'wrong').send(newInternship)).status).toBe(401);
    expect((await request(app).put('/api/internships/INT-101').send(newInternship)).status).toBe(401);
    expect((await request(app).delete('/api/internships/INT-101')).status).toBe(401);
    expect((await request(app).get('/api/internships/INT-101')).status).toBe(200);
    const ok = await request(app).post('/api/internships').set('X-Admin-Key', 'test-key-123').send(newInternship);
    expect(ok.status).toBe(201);
    expect((await request(app).get('/api/internships/INT-101')).body.data.id).toBe('INT-101'); // nothing was deleted
  });
  test('production without a key: writes are disabled (403) but applications still work', async () => {
    process.env.NODE_ENV = 'production';
    for (const r of [request(app).post('/api/internships').send(newInternship), request(app).delete('/api/internships/INT-101')]) {
      const res = await r; expect(res.status).toBe(403); expect(res.body.error.code).toBe('ADMIN_DISABLED');
    }
    expect((await request(app).get('/api/internships')).status).toBe(200);
    expect((await request(app).post('/api/applications').send(valid)).status).toBe(201);
  });
});

describe('logging privacy and content', () => {
  test('logs request + submission outcomes but never applicant data, bodies or keys', async () => {
    process.env.ADMIN_API_KEY = 'super-secret-key';
    const out = []; jest.spyOn(process.stdout, 'write').mockImplementation(s => { out.push(String(s)); return true; });
    await request(app).post('/api/applications').send(valid);
    await request(app).post('/api/applications').send(valid);                       // duplicate
    await request(app).post('/api/applications').send({ ...valid, email: 'bad' });  // invalid
    await request(app).delete('/api/internships/INT-101').set('X-Admin-Key', 'super-secret-key').query({ token: 'abc' });
    const text = out.join('');
    const events = text.trim().split('\n').map(l => JSON.parse(l));
    expect(events.some(e => e.event === 'application_submitted' && e.outcome === 'created')).toBe(true);
    expect(events.some(e => e.event === 'application_submitted' && e.outcome === 'duplicate')).toBe(true);
    expect(events.filter(e => e.event === 'http_request').map(e => e.status)).toEqual(expect.arrayContaining([201, 409, 400, 200]));
    for (const bad of ['Priya', 'priya.secret', 'private-resume', 'private content', 'super-secret-key', 'token=abc', '98765']) expect(text).not.toContain(bad);
  });
  test('unexpected 500 is logged without message text or stack', async () => {
    const err = []; jest.spyOn(process.stderr, 'write').mockImplementation(s => { err.push(String(s)); return true; });
    jest.spyOn(dbModule.getDb(), 'prepare').mockImplementation(() => { throw new Error('boom with priya.secret@example.com'); });
    const res = await request(app).get('/api/internships/INT-101');
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Internal server error');
    const text = err.join(''); expect(text).toContain('request_failed'); expect(text).not.toMatch(/priya|boom|\bat .*\.js/);
  });
});

describe('extra security checks', () => {
  test('SQL injection in search/filter params returns a normal result and keeps tables intact', async () => {
    const res = await request(app).get("/api/internships").query({ search: "'; DROP TABLE internships;--", domain: "x' OR '1'='1" });
    expect(res.status).toBe(200); expect(res.body.data).toEqual([]);
    expect((await request(app).get('/api/internships')).body.pagination.total).toBe(5);
  });
  test.each(['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'ftp://x.com/a.pdf'])('unsafe resume URL %s is rejected', async url => {
    expect((await request(app).post('/api/applications').send({ ...valid, resumeUrl: url })).status).toBe(400);
  });
  test('security headers present and X-Powered-By hidden', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff'); expect(res.headers['content-security-policy']).toBeDefined(); expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
