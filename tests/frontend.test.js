/** @jest-environment jsdom */
// Frontend tests: the real public/index.html + public/js/app.js run in jsdom with a mocked fetch (no real network, no real DB).
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const items = [
  { id: 'INT-101', title: 'Frontend Intern', domain: 'Web', mode: 'Remote', location: 'Chennai', skills: ['HTML', 'CSS'], openings: 2 },
  { id: 'INT-102', title: 'Data Intern', domain: 'Data', mode: 'Hybrid', location: 'Pune', skills: ['SQL'], openings: 1 }
];
const page = (data, total = data.length) => ({ status: 'success', data, pagination: { page: 1, limit: 6, total, totalPages: 1 } });
const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const err = (status, code, message, details) => json(status, { status: 'error', error: { code, message, ...(details && { details }) } });
const wait = async (fn, ms = 1500) => { const t = Date.now(); for (;;) { try { return fn(); } catch (e) { if (Date.now() - t > ms) throw e; await new Promise(r => setTimeout(r, 10)); } } };
const $ = id => document.getElementById(id);
const calls = () => global.fetch.mock.calls.map(c => c[0]);

function boot(handler) {
  jest.resetModules();
  document.body.innerHTML = html.replace(/<script[^>]*><\/script>/g, '').split('<body>')[1].split('</body>')[0];
  global.fetch = jest.fn((url, opts) => {
    if (String(url).startsWith('api/internships/filters')) return json(200, { status: 'success', data: { domains: ['Web', 'Data'], modes: ['Remote', 'Hybrid'] } });
    return handler(String(url), opts);
  });
  require('../public/js/app.js');
}
beforeAll(() => {
  const P = window.HTMLDialogElement.prototype;
  P.showModal = function () { this.setAttribute('open', ''); };
  P.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
});

const fill = (o = {}) => {
  const v = { 'a-name': 'Asha Raman', 'a-email': 'asha@example.com', 'a-phone': '+91 98765 43210', 'a-url': 'https://example.com/cv.pdf', 'a-cover': 'I enjoy building accessible web interfaces.', ...o };
  for (const [id, val] of Object.entries(v)) $(id).value = val;
};
async function openFirst() {
  await wait(() => { if (!document.querySelector('.card button')) throw 0; });
  document.querySelector('.card button').click();
}
const submit = () => $('apply-form').dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
const posts = () => global.fetch.mock.calls.filter(c => c[1] && c[1].method === 'POST');

describe('browsing', () => {
  test('loads real API data on start and fills the filter dropdowns', async () => {
    boot(() => json(200, page(items)));
    await wait(() => expect(document.querySelectorAll('.card')).toHaveLength(2));
    expect(document.querySelector('.card h3').textContent).toBe('Frontend Intern');
    expect($('result-count').textContent).toBe('2 internships found');
    await wait(() => expect($('domain').options.length).toBe(3));
  });
  test('search sends the query to the API', async () => {
    boot(url => json(200, page(url.includes('search=data') ? [items[1]] : items)));
    await wait(() => expect(document.querySelectorAll('.card')).toHaveLength(2));
    $('search').value = 'data'; $('search').dispatchEvent(new window.Event('input'));
    await wait(() => expect(document.querySelectorAll('.card')).toHaveLength(1));
    expect(calls().some(u => u.includes('search=data'))).toBe(true);
  });
  test('domain and work-mode filters are sent to the API', async () => {
    boot(() => json(200, page(items)));
    await wait(() => expect($('domain').options.length).toBe(3));
    $('domain').value = 'Web'; $('domain').dispatchEvent(new window.Event('change'));
    $('mode').value = 'Remote'; $('mode').dispatchEvent(new window.Event('change'));
    await wait(() => expect(calls().some(u => u.includes('domain=Web') && u.includes('mode=Remote'))).toBe(true));
  });
  test('empty state is shown when nothing matches', async () => {
    boot(() => json(200, page([])));
    await wait(() => expect($('state').textContent).toMatch(/No internships are available/));
    expect($('result-count').textContent).toBe('0 internships found');
  });
  test('error state with Retry recovers; no hardcoded data is shown on failure', async () => {
    let n = 0;
    boot(() => (++n === 1 ? Promise.reject(new TypeError('Failed to fetch')) : json(200, page(items))));
    await wait(() => expect($('state').textContent).toMatch(/Could not load internships/));
    expect(document.querySelectorAll('.card')).toHaveLength(0);
    $('state').querySelector('button').click();
    await wait(() => expect(document.querySelectorAll('.card')).toHaveLength(2));
    expect($('state').hidden).toBe(true);
  });
  test('server error (500) also shows the error state', async () => {
    boot(() => err(500, 'INTERNAL_ERROR', 'Internal server error'));
    await wait(() => expect($('state').textContent).toMatch(/Could not load internships/));
  });
});

describe('details and application form', () => {
  test('opens the detail dialog for the chosen internship', async () => {
    boot(() => json(200, page(items)));
    await openFirst();
    expect($('detail').hasAttribute('open')).toBe(true);
    expect($('detail-title').textContent).toBe('Frontend Intern');
    expect($('a-id').value).toBe('INT-101');
  });
  test('client-side validation blocks an invalid form and sets accessible errors', async () => {
    boot(() => json(200, page(items)));
    await openFirst();
    fill({ 'a-name': '', 'a-email': 'nope', 'a-phone': '12', 'a-url': 'javascript:alert(1)', 'a-cover': 'short' });
    submit();
    expect(posts()).toHaveLength(0);
    for (const id of ['a-name', 'a-email', 'a-phone', 'a-url', 'a-cover']) {
      expect($(id).getAttribute('aria-invalid')).toBe('true');
      expect($(id + '-err').hidden).toBe(false);
    }
  });
  test('successful submission shows confirmation and sends the expected payload', async () => {
    boot((url, o) => (o && o.method === 'POST' ? json(201, { status: 'success', data: { id: 1 } }) : json(200, page(items))));
    await openFirst(); fill(); submit();
    await wait(() => expect($('apply-msg').textContent).toMatch(/Application submitted for Frontend Intern/));
    expect($('apply-msg').className).toContain('ok');
    expect(JSON.parse(posts()[0][1].body)).toMatchObject({ internshipId: 'INT-101', email: 'asha@example.com' });
  });
  test('duplicate application (409) shows the duplicate message and keeps the input', async () => {
    boot((url, o) => (o && o.method === 'POST' ? err(409, 'DUPLICATE_APPLICATION', 'You have already applied to this internship with this email') : json(200, page(items))));
    await openFirst(); fill(); submit();
    await wait(() => expect($('apply-msg').textContent).toMatch(/already applied/));
    expect($('apply-msg').className).toContain('err');
    expect($('a-email').value).toBe('asha@example.com');
  });
  test('server validation errors are mapped to the right field', async () => {
    boot((url, o) => (o && o.method === 'POST' ? err(400, 'VALIDATION_ERROR', 'Validation failed', [{ field: 'email', message: 'Email already blocked' }]) : json(200, page(items))));
    await openFirst(); fill(); submit();
    await wait(() => expect($('a-email-err').textContent).toBe('Email already blocked'));
    expect($('a-email').getAttribute('aria-invalid')).toBe('true');
  });
  test('failed submission (500) and network failure show errors and re-enable the button', async () => {
    let mode = 500;
    boot((url, o) => (o && o.method === 'POST' ? (mode === 500 ? err(500, 'INTERNAL_ERROR', 'Internal server error') : Promise.reject(new TypeError('x'))) : json(200, page(items))));
    await openFirst(); fill(); submit();
    await wait(() => expect($('apply-msg').textContent).toMatch(/Could not submit your application/));
    expect($('apply-submit').disabled).toBe(false);
    mode = 0; submit();
    await wait(() => expect($('apply-msg').textContent).toMatch(/Could not reach the server/));
  });
  test('rate limit (429) shows a wait message', async () => {
    boot((url, o) => (o && o.method === 'POST' ? err(429, 'RATE_LIMITED', 'Too many requests') : json(200, page(items))));
    await openFirst(); fill(); submit();
    await wait(() => expect($('apply-msg').textContent).toMatch(/Too many attempts/));
  });
  test('double submit sends only one request while one is in flight', async () => {
    let release;
    boot((url, o) => (o && o.method === 'POST' ? new Promise(r => { release = () => r({ ok: true, status: 201, json: () => Promise.resolve({ status: 'success', data: {} }) }); }) : json(200, page(items))));
    await openFirst(); fill(); submit(); submit(); submit();
    expect(posts()).toHaveLength(1);
    expect($('apply-submit').disabled).toBe(true);
    release();
    await wait(() => expect($('apply-msg').textContent).toMatch(/submitted/));
  });
  test('closing the dialog returns focus to the trigger button', async () => {
    boot(() => json(200, page(items)));
    await openFirst();
    const trigger = document.querySelector('.card button'); trigger.focus();
    $('detail-close').click();
    expect($('detail').hasAttribute('open')).toBe(false);
  });
  test('dataset text is inserted as text, never as HTML (XSS safe)', async () => {
    boot(() => json(200, page([{ ...items[0], title: '<img src=x onerror=alert(1)>' }])));
    await wait(() => expect(document.querySelectorAll('.card')).toHaveLength(1));
    expect(document.querySelector('.card img')).toBeNull();
    expect(document.querySelector('.card h3').textContent).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('automated accessibility scan (axe-core, jsdom — colour contrast not covered)', () => {
  test('no axe violations on the loaded page with the dialog open', async () => {
    boot(() => json(200, page(items)));
    await openFirst();
    document.documentElement.lang = 'en'; document.title = 'InternBoard'; // harness injects only <body>; the real index.html has both
    const axe = require('axe-core');
    const res = await axe.run(document, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(res.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(' | ')}`)).toEqual([]);
  });
});
