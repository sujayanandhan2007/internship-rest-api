'use strict';
// All data comes from the API (relative URLs so it works under a sub-path).
// Dataset strings are only ever inserted with textContent — never innerHTML.

const $ = id => document.getElementById(id);
const els = {
  form: $('filter-form'), search: $('search'), domain: $('domain'), mode: $('mode'),
  count: $('result-count'), state: $('state'), list: $('list'), pager: $('pager'),
  prev: $('prev'), next: $('next'), pageInfo: $('page-info'),
  dialog: $('detail'), dTitle: $('detail-title'), dInfo: $('detail-info'), dClose: $('detail-close'),
  apply: $('apply-form'), applyMsg: $('apply-msg'), applySubmit: $('apply-submit')
};
const state = { q: '', domain: '', mode: '', page: 1, limit: 6, totalPages: 1 };
let controller = null;     // cancels stale requests
let lastTrigger = null;    // element to refocus when dialog closes
let currentInternship = null;

function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'text') node.textContent = v;
    else if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) node.append(c);
  return node;
}

async function api(path, options) {
  const res = await fetch(path, options);
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON response */ }
  if (!res.ok || !body || body.status !== 'success') {
    const err = new Error((body && body.error && body.error.message) || `Request failed (${res.status})`);
    const details = body && body.error && body.error.details;
    err.fields = Array.isArray(details) ? Object.fromEntries(details.filter(d => d && d.field).map(d => [d.field, d.message])) : {};
    err.code = body && body.error && body.error.code;
    err.http = res.status;
    throw err;
  }
  return body;
}

/* ---------- rendering ---------- */
function showState(kind, title, message, retry) {
  els.state.replaceChildren();
  els.state.className = 'state' + (kind === 'error' ? ' error' : '');
  els.state.hidden = false;
  if (kind === 'loading') els.state.append(h('div', { class: 'spinner', 'aria-hidden': 'true' }));
  els.state.append(h('h3', { text: title }));
  if (message) els.state.append(h('p', { text: message }));
  if (retry) {
    const b = h('button', { type: 'button', class: 'btn btn-primary', text: 'Retry' });
    b.addEventListener('click', retry);
    els.state.append(b);
  }
}
const hideState = () => { els.state.hidden = true; els.state.replaceChildren(); };

function renderCard(item) {
  const meta = [item.mode, item.location, Number.isFinite(item.openings) ? `${item.openings} ${item.openings === 1 ? 'opening' : 'openings'}` : null]
    .filter(Boolean).map(t => h('li', { text: t }));
  const skills = (Array.isArray(item.skills) ? item.skills : []).filter(s => typeof s === 'string').map(s => h('li', { text: s }));
  const btn = h('button', { type: 'button', class: 'btn btn-primary' }, ['View details', h('span', { class: 'visually-hidden', text: ` for ${item.title}` })]);
  btn.addEventListener('click', () => openDetail(item, btn));
  const card = h('article', { class: 'card' }, [
    item.domain ? h('p', { class: 'card-domain', text: item.domain }) : '',
    h('h3', { text: item.title }),
    meta.length ? h('ul', { class: 'meta', 'aria-label': 'Details' }, meta) : '',
    skills.length ? h('ul', { class: 'tags', 'aria-label': 'Skills' }, skills) : '',
    btn
  ]);
  return h('li', {}, [card]);
}

function render(data, pagination) {
  els.list.replaceChildren(...data.map(renderCard));
  const { total, page, totalPages } = pagination;
  state.totalPages = totalPages;
  els.count.textContent = total === 0 ? '0 internships found' : `${total} ${total === 1 ? 'internship' : 'internships'} found`;
  if (total === 0) {
    const filtered = state.q || state.domain || state.mode;
    showState('empty', filtered ? 'No internships match your search' : 'No internships are available right now',
      filtered ? 'Try a different keyword or reset the filters.' : 'Please check back later.');
  } else hideState();
  els.pager.hidden = totalPages <= 1;
  els.pageInfo.textContent = `Page ${page} of ${totalPages}`;
  els.prev.disabled = page <= 1;
  els.next.disabled = page >= totalPages;
}

/* ---------- loading ---------- */
async function load() {
  if (controller) controller.abort();
  controller = new AbortController();
  const { signal } = controller;
  const params = new URLSearchParams({ page: state.page, limit: state.limit });
  if (state.q) params.set('search', state.q);
  if (state.domain) params.set('domain', state.domain);
  if (state.mode) params.set('mode', state.mode);
  els.list.setAttribute('aria-busy', 'true');
  els.list.replaceChildren();
  els.pager.hidden = true;
  els.count.textContent = 'Loading internships…';
  showState('loading', 'Loading internships…');
  try {
    const body = await api('api/internships?' + params, { signal });
    const p = body.pagination;
    if (!Array.isArray(body.data) || !p || !Number.isInteger(p.total) || !Number.isInteger(p.page) || !Number.isInteger(p.totalPages))
      throw new Error('Invalid API response');
    if (signal.aborted) return;
    render(body.data, body.pagination);
  } catch (err) {
    if (err.name === 'AbortError') return;
    els.count.textContent = '';
    showState('error', 'Could not load internships', 'Check your connection and try again.', load);
  } finally {
    if (!signal.aborted) els.list.setAttribute('aria-busy', 'false');
  }
}

async function loadFilters() {
  try {
    const { data } = await api('api/internships/filters');
    for (const [select, values] of [[els.domain, data.domains], [els.mode, data.modes]])
      for (const v of values) select.append(h('option', { value: v, text: v }));
  } catch { /* filters stay on "All"; the list's error state covers connectivity issues */ }
}

/* ---------- filters ---------- */
let debounce;
els.search.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { state.q = els.search.value.trim(); state.page = 1; load(); }, 250);
});
els.form.addEventListener('submit', e => { e.preventDefault(); clearTimeout(debounce); state.q = els.search.value.trim(); state.page = 1; load(); });
for (const sel of [els.domain, els.mode]) sel.addEventListener('change', () => { state.domain = els.domain.value; state.mode = els.mode.value; state.page = 1; load(); });
els.form.addEventListener('reset', () => {
  clearTimeout(debounce);
  // reset fires before controls clear, so defer reading values
  setTimeout(() => { state.q = ''; state.domain = ''; state.mode = ''; state.page = 1; load(); els.search.focus(); });
});
els.prev.addEventListener('click', () => { if (state.page > 1) { state.page--; load().then(focusResults); } });
els.next.addEventListener('click', () => { if (state.page < state.totalPages) { state.page++; load().then(focusResults); } });
const focusResults = () => $('results').focus({ preventScroll: false });

/* ---------- detail dialog + application form ---------- */
const fieldIds = {
  name: ['a-name', 'a-name-err'], email: ['a-email', 'a-email-err'], phone: ['a-phone', 'a-phone-err'],
  internshipId: ['a-id', 'a-id-err'], resumeUrl: ['a-url', 'a-url-err'], coverLetter: ['a-cover', 'a-cover-err']
};
let submitting = false;

function clearErrors() {
  for (const [input, err] of Object.values(fieldIds)) {
    $(input).removeAttribute('aria-invalid');
    $(err).hidden = true; $(err).textContent = '';
  }
  els.applyMsg.hidden = true; els.applyMsg.textContent = '';
}
function setFieldError(key, message) {
  const [input, err] = fieldIds[key];
  $(input).setAttribute('aria-invalid', 'true');
  $(err).textContent = message; $(err).hidden = false;
}
function setMessage(kind, text) {
  els.applyMsg.className = 'form-msg ' + kind;
  els.applyMsg.textContent = text;
  els.applyMsg.hidden = false;
}

function openDetail(item, trigger) {
  currentInternship = item; lastTrigger = trigger;
  els.dTitle.textContent = item.title;
  const rows = [['Domain', item.domain], ['Work mode', item.mode], ['Location', item.location],
    ['Openings', Number.isFinite(item.openings) ? String(item.openings) : null],
    ['Skills', Array.isArray(item.skills) ? item.skills.join(', ') : null], ['Reference ID', item.id]].filter(r => r[1]);
  els.dInfo.replaceChildren(...rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })]));
  els.apply.reset(); clearErrors();
  $('a-id').value = item.id;
  els.applySubmit.disabled = false; submitting = false;
  els.dialog.showModal();
}
function closeDetail() { els.dialog.close(); }
els.dClose.addEventListener('click', closeDetail);
els.dialog.addEventListener('click', e => { if (e.target === els.dialog) closeDetail(); }); // backdrop click
els.dialog.addEventListener('close', () => { if (lastTrigger) lastTrigger.focus(); });

function validateForm(d) {
  const e = {};
  const name = d.name.trim();
  if (name.length < 2 || !/\p{L}/u.test(name)) e.name = 'Enter your full name (at least 2 characters, including letters).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = 'Enter a valid email address.';
  if (!/^\+?\d{10,15}$/.test(d.phone.trim().replace(/[\s().-]/g, ''))) e.phone = 'Enter a valid phone number (10-15 digits, optional leading +).';
  if (!d.internshipId.trim()) e.internshipId = 'Internship ID is required.';
  try { if (!/^https?:$/.test(new URL(d.resumeUrl.trim()).protocol)) throw 0; } catch { e.resumeUrl = 'Enter a valid http:// or https:// link.'; }
  const cl = d.coverLetter.trim().length;
  if (cl < 20 || cl > 2000) e.coverLetter = 'Cover letter must be 20-2000 characters.';
  return e;
}

els.apply.addEventListener('submit', async e => {
  e.preventDefault();
  if (submitting) return;               // ignore double submits while a request is in flight
  clearErrors();
  const data = Object.fromEntries(new FormData(els.apply));
  data.internshipId = currentInternship.id;
  const errors = validateForm(data);
  const keys = Object.keys(errors);
  if (keys.length) {
    keys.forEach(k => setFieldError(k, errors[k]));
    $(fieldIds[keys[0]][0]).focus();
    return;
  }
  submitting = true; els.applySubmit.disabled = true; els.applySubmit.textContent = 'Submitting…';
  try {
    await api('api/applications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    setMessage('ok', `Application submitted for ${currentInternship.title}. Good luck!`);
    els.apply.reset(); $('a-id').value = currentInternship.id;
    els.applyMsg.focus();
  } catch (err) {                       // input is kept so the user can correct and resubmit
    const keys2 = Object.keys(err.fields || {}).filter(k => fieldIds[k]);
    if (keys2.length) { keys2.forEach(k => setFieldError(k, err.fields[k])); $(fieldIds[keys2[0]][0]).focus(); }
    else {
      const msg = err.code === 'DUPLICATE_APPLICATION' ? err.message
        : err.http === 429 ? 'Too many attempts. Please wait a few minutes and try again.'
        : err.http ? 'Could not submit your application. ' + err.message
        : 'Could not reach the server. Check your connection and try again.';
      setMessage('err', msg); els.applyMsg.focus();
    }
  } finally {
    submitting = false; els.applySubmit.disabled = false; els.applySubmit.textContent = 'Submit application';
  }
});

loadFilters();
load();
