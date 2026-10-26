process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:'; // isolated in-memory DB: the real database is never touched
const request = require('supertest');
const { createApp } = require('../src/app');
const { getDb, closeDb } = require('../database/db');
const { seed } = require('../database/seed');

const app = createApp();
const valid = { id: 'INT-201', title: 'QA Intern', domain: 'Quality Assurance', mode: 'Hybrid', location: 'Chennai', skills: ['Testing', 'Jest'], openings: 2 };
const { id, ...editable } = valid;

beforeEach(() => { getDb().exec('DELETE FROM internships'); seed(); });
afterAll(closeDb);

describe('GET /api/internships', () => {
  test('lists seeded internships with defaults', async () => {
    const res = await request(app).get('/api/internships');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(5);
    expect(res.body.data[0]).toEqual({ id: 'INT-101', title: 'Frontend Intern', domain: 'Full Stack Development', mode: 'Remote', location: 'India', skills: ['HTML', 'CSS', 'JavaScript'], openings: 3 });
  });
  test('pagination metadata and pages', async () => {
    const p1 = await request(app).get('/api/internships?page=1&limit=3');
    expect(p1.body.pagination).toEqual({ page: 1, limit: 3, total: 5, totalPages: 2 });
    expect(p1.body.data.map((i) => i.id)).toEqual(['INT-101', 'INT-102', 'INT-103']);
    const p2 = await request(app).get('/api/internships?page=2&limit=3');
    expect(p2.body.data.map((i) => i.id)).toEqual(['INT-104', 'INT-105']);
  });
  test('page beyond the end returns empty array, not an error', async () => {
    const res = await request(app).get('/api/internships?page=9&limit=3');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
  test.each(['page=0', 'page=-1', 'page=abc', 'limit=0', 'limit=101', 'limit=1.5'])('rejects invalid %s', async (q) => {
    const res = await request(app).get(`/api/internships?${q}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
  test('search is case-insensitive', async () => {
    const res = await request(app).get('/api/internships?search=FRONTEND');
    expect(res.body.data.map((i) => i.id)).toEqual(['INT-101']);
  });
  test('search treats % literally (no wildcard injection)', async () => {
    const res = await request(app).get('/api/internships?search=%25');
    expect(res.body.pagination.total).toBe(0);
  });
  test('filters by domain', async () => {
    const res = await request(app).get('/api/internships?domain=Full%20Stack%20Development');
    expect(res.body.data.map((i) => i.id)).toEqual(['INT-101', 'INT-102']);
  });
  test('filters by mode and location', async () => {
    expect((await request(app).get('/api/internships?mode=Remote')).body.pagination.total).toBe(3);
    expect((await request(app).get('/api/internships?location=Pune')).body.data[0].id).toBe('INT-102');
  });
  test('rejects invalid mode filter', async () => {
    expect((await request(app).get('/api/internships?mode=Moon')).status).toBe(400);
  });
  test('combined filters apply before pagination', async () => {
    const res = await request(app).get('/api/internships?search=intern&mode=Remote&page=1&limit=2');
    expect(res.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(res.body.data).toHaveLength(2);
  });
});

describe('GET /api/internships/:id', () => {
  test('returns an existing internship', async () => {
    const res = await request(app).get('/api/internships/INT-101');
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Frontend Intern');
  });
  test('404 for missing internship', async () => {
    const res = await request(app).get('/api/internships/INT-999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ status: 'error', error: { code: 'NOT_FOUND', message: 'Internship INT-999 not found' } });
  });
  test('400 for malformed id', async () => {
    expect((await request(app).get('/api/internships/bad%20id!')).status).toBe(400);
  });
});

describe('POST /api/internships', () => {
  test('creates a valid internship (201) and persists it', async () => {
    const res = await request(app).post('/api/internships').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(valid);
    expect((await request(app).get('/api/internships/INT-201')).status).toBe(200);
  });
  test('trims strings', async () => {
    const res = await request(app).post('/api/internships').send({ ...valid, title: '  QA Intern  ' });
    expect(res.body.data.title).toBe('QA Intern');
  });
  test('rejects missing required fields', async () => {
    const res = await request(app).post('/api/internships').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['id', 'title', 'domain', 'mode', 'location', 'skills', 'openings']));
  });
  test('rejects whitespace-only title', async () => {
    expect((await request(app).post('/api/internships').send({ ...valid, title: '   ' })).status).toBe(400);
  });
  test('rejects invalid mode', async () => {
    expect((await request(app).post('/api/internships').send({ ...valid, mode: 'Mars' })).status).toBe(400);
  });
  test.each([0, -2, 1.5, '3', null])('rejects invalid openings %p', async (openings) => {
    expect((await request(app).post('/api/internships').send({ ...valid, openings })).status).toBe(400);
  });
  test.each([[[]], ['HTML'], [['ok', '']], [[1, 2]]])('rejects malformed skills %j', async (skills) => {
    expect((await request(app).post('/api/internships').send({ ...valid, skills })).status).toBe(400);
  });
  test('rejects unexpected fields', async () => {
    expect((await request(app).post('/api/internships').send({ ...valid, admin: true })).status).toBe(400);
  });
  test('rejects duplicate id with 409', async () => {
    const res = await request(app).post('/api/internships').send({ ...valid, id: 'INT-101' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_ID');
  });
});

describe('PUT /api/internships/:id', () => {
  test('updates an existing internship', async () => {
    const res = await request(app).put('/api/internships/INT-101').send({ ...editable, openings: 9 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 'INT-101', ...editable, openings: 9 });
  });
  test('rejects invalid data and leaves the record unchanged', async () => {
    const res = await request(app).put('/api/internships/INT-101').send({ ...editable, mode: 'Nope' });
    expect(res.status).toBe(400);
    expect((await request(app).get('/api/internships/INT-101')).body.data.title).toBe('Frontend Intern');
  });
  test('rejects attempts to change the id', async () => {
    expect((await request(app).put('/api/internships/INT-101').send({ ...editable, id: 'INT-555' })).status).toBe(400);
  });
  test('404 when updating a missing record', async () => {
    expect((await request(app).put('/api/internships/INT-999').send(editable)).status).toBe(404);
  });
});

describe('DELETE /api/internships/:id', () => {
  test('deletes an existing internship', async () => {
    const res = await request(app).delete('/api/internships/INT-105');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'success', data: { id: 'INT-105', deleted: true } });
    expect((await request(app).get('/api/internships/INT-105')).status).toBe(404);
  });
  test('404 when deleting a missing record', async () => {
    expect((await request(app).delete('/api/internships/INT-999')).status).toBe(404);
  });
});

describe('errors and seed', () => {
  test('malformed JSON returns 400 INVALID_JSON', async () => {
    const res = await request(app).post('/api/internships').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
  test('oversized body returns 413', async () => {
    const res = await request(app).post('/api/internships').send({ ...valid, title: 'x'.repeat(20000) });
    expect(res.status).toBe(413);
  });
  test('unknown route returns 404 envelope', async () => {
    const res = await request(app).get('/api/nothing');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
  test('seed is idempotent', () => {
    expect(seed()).toBe(0);
    expect(getDb().prepare('SELECT COUNT(*) n FROM internships').get().n).toBe(5);
  });
});
