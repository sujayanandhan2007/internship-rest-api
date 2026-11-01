process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:'; // isolated in-memory DB: the real database is never touched
process.env.RATE_LIMIT_MAX = '1000';
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../src/app');
const { getDb, closeDb } = require('../database/db');
const { seed } = require('../database/seed');

const app = createApp();
const schema = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
const sample = require('../database/internship-records-sample.json').internships;
const valid = {
  name: 'Asha Raman', email: 'asha@example.com', phone: '+91 98765 43210', internshipId: 'INT-101',
  resumeUrl: 'https://example.com/resume.pdf', coverLetter: 'I enjoy building accessible web interfaces.'
};
const post = (body, a = app) => request(a).post('/api/applications').send(body);
const count = () => getDb().prepare('SELECT COUNT(*) n FROM applications').get().n;

beforeEach(() => { const db = getDb(); db.exec('DELETE FROM applications; DELETE FROM internships'); seed(); });
afterAll(closeDb);

describe('internship data (supplied dataset)', () => {
  test('API returns every supplied record unchanged, in the standard envelope', async () => {
    const res = await request(app).get('/api/internships');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toEqual(sample);
    expect(res.body.pagination).toEqual({ page: 1, limit: 10, total: 5, totalPages: 1 });
  });
  test('search covers skills/location and /filters lists domains and modes', async () => {
    expect((await request(app).get('/api/internships?search=figma')).body.data.map((i) => i.id)).toEqual(['INT-103']);
    expect((await request(app).get('/api/internships?search=pune')).body.data.map((i) => i.id)).toEqual(['INT-102']);
    const f = await request(app).get('/api/internships/filters');
    expect(f.body.data.modes).toEqual(['Hybrid', 'On-site', 'Remote']);
    expect(f.body.data.domains).toContain('Cyber Security');
  });
});

describe('POST /api/applications - success', () => {
  test('accepts valid input (201), stores normalized values, does not echo personal data', async () => {
    const res = await post({ ...valid, name: '  Asha   Raman ', email: ' Asha@Example.COM ' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(Object.keys(res.body.data).sort()).toEqual(['createdAt', 'id', 'internshipId']);
    const row = getDb().prepare('SELECT * FROM applications').get();
    expect(row).toMatchObject({ full_name: 'Asha Raman', email: 'asha@example.com', phone: '+919876543210', internship_id: 'INT-101' });
  });
  test('same person may apply to a different internship', async () => {
    expect((await post(valid)).status).toBe(201);
    expect((await post({ ...valid, internshipId: 'INT-102' })).status).toBe(201);
  });
  test('SQL injection text is stored literally and the table survives', async () => {
    const evil = "Robert'); DROP TABLE applications;--";
    expect((await post({ ...valid, name: evil })).status).toBe(201);
    expect(getDb().prepare('SELECT full_name FROM applications').get().full_name).toBe(evil);
  });
});

describe('POST /api/applications - rejected input', () => {
  const rejected = (body, field) => post(body).then((res) => {
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain(field);
    expect(count()).toBe(0);
  });

  test.each([[undefined], [''], ['   '], ['A'], ['12345']])('invalid name %p', (name) => rejected({ ...valid, name }, 'name'));
  test.each([['plain'], ['a@b'], ['a b@c.com'], [''], [42]])('invalid email %p', (email) => rejected({ ...valid, email }, 'email'));
  test.each([['abc'], ['12345'], ['+1234567890123456'], ['98765 4321x']])('invalid phone %p', (phone) => rejected({ ...valid, phone }, 'phone'));
  test.each([
    ['javascript:alert(1)'], ['data:text/html,<script>alert(1)</script>'], ['ftp://example.com/cv.pdf'],
    ['file:///etc/passwd'], ['//example.com/cv.pdf'], ['https://user:pw@example.com/cv.pdf'], ['not a url'], ['']
  ])('unsafe or invalid resume URL %p', (resumeUrl) => rejected({ ...valid, resumeUrl }, 'resumeUrl'));
  test.each([[''], ['too short'], ['x'.repeat(2001)]])('invalid cover letter (len %#)', (coverLetter) => rejected({ ...valid, coverLetter }, 'coverLetter'));
  test('malformed internship ID', () => rejected({ ...valid, internshipId: "INT-101'; --" }, 'internshipId'));
  test('unexpected fields', () => rejected({ ...valid, admin: true }, 'admin'));

  test('unknown internship ID returns 404', async () => {
    const res = await post({ ...valid, internshipId: 'INT-999' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INTERNSHIP_NOT_FOUND');
    expect(count()).toBe(0);
  });
});

describe('POST /api/applications - malformed requests', () => {
  test('malformed JSON returns 400 INVALID_JSON', async () => {
    const res = await request(app).post('/api/applications').set('Content-Type', 'application/json').send('{"name": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
  test.each([['[]'], ['"text"'], ['null']])('non-object JSON body %s returns 400', async (raw) => {
    const res = await request(app).post('/api/applications').set('Content-Type', 'application/json').send(raw);
    expect(res.status).toBe(400);
  });
  test('non-JSON content type is rejected (400)', async () => {
    const res = await request(app).post('/api/applications').set('Content-Type', 'text/plain').send('name=x');
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });
  test('oversized body returns 413', async () => {
    const res = await post({ ...valid, coverLetter: 'x'.repeat(20000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('duplicate prevention', () => {
  test('second application with same internship + email returns 409 (email case-insensitive)', async () => {
    expect((await post(valid)).status).toBe(201);
    const res = await post({ ...valid, name: 'Someone Else', email: 'ASHA@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_APPLICATION');
    expect(count()).toBe(1);
  });
  test('database itself enforces uniqueness', () => {
    const ins = () => getDb().prepare(
      "INSERT INTO applications (internship_id, full_name, email, phone, resume_url, cover_letter) VALUES ('INT-101','Ab','a@b.co','1234567890','https://x.io','hello')").run();
    ins();
    expect(ins).toThrow(/UNIQUE/);
  });
});

describe('security controls', () => {
  test('secure headers are set and x-powered-by is hidden', async () => {
    const res = await request(app).get('/api/internships');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toMatch(/default-src 'self'/);
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
  test('rate limiting returns 429 after the limit and uses the error envelope', async () => {
    process.env.RATE_LIMIT_MAX = '3';
    const limited = createApp();
    process.env.RATE_LIMIT_MAX = '1000';
    for (let i = 0; i < 3; i++) expect((await post({}, limited)).status).toBe(400);
    const res = await post(valid, limited);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ status: 'error', error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } });
    expect((await request(limited).get('/api/internships')).status).toBe(200); // reads are not limited
  });
  test('database failure returns a safe 500 without leaking internals', async () => {
    const db = getDb();
    db.exec('DROP TABLE applications');
    try {
      const res = await post(valid);
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('DATABASE_ERROR');
      expect(JSON.stringify(res.body)).not.toMatch(/no such table|applications|SQLITE|stack/i);
    } finally { db.exec(schema); }
  });
});

describe('frontend hosting', () => {
  test('serves the Internship Board page', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('InternBoard');
  });
});
