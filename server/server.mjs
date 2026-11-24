// Indian Visa Form Helper server (ivh.techistbd.com). Plain Node.js, no npm packages.
//   Public (behind Caddy):  /  /privacy  /family  /api/fieldmap.json  /api/directory.json  /api/health
//                           /api/ai/* (Helper AI, ai.mjs)  /api/sync/* (encrypted agency sync, sync.mjs)
//                           /api/ocr (free server passport scan, ocr.mjs → OCR container on 127.0.0.1:8101)
//                           /api/hotels?city= (free hotel search: OpenStreetMap + hotel websites + Google Places, hotels.mjs)
//   Admin (Tailscale only, password): site-check results, baseline, field map editor, Helper AI codes
// Settings come from environment variables (see .env.example). Data lives in DATA_DIR as JSON files.
import http from 'node:http';
import { readFile, writeFile, rename, mkdir, readdir } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFieldMap, EMPTY_MAP } from './fieldmap.mjs';
import { runSiteCheck, EXPECTED } from './sitecheck.mjs';
import { handleAi, newCode, hashCode, monthKey, DEFAULT_AI_SETTINGS } from './ai.mjs';
import { handleSync } from './sync.mjs';
import { handleOcr, DEFAULT_OCR_SETTINGS } from './ocr.mjs';
import { handleHotels, DEFAULT_HOTEL_SETTINGS } from './hotels.mjs';
import { validateDirectory, EMPTY_DIRECTORY } from './directory.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const PUBLIC_HOST = env.PUBLIC_HOST || '127.0.0.1';
const PUBLIC_PORT = +(env.PUBLIC_PORT || 8099);
const ADMIN_HOST = env.ADMIN_HOST || '127.0.0.1';
const ADMIN_PORT = +(env.ADMIN_PORT || 8100);
const ADMIN_PASSWORD = env.ADMIN_PASSWORD || '';
const DATA_DIR = env.DATA_DIR || join(HERE, 'data');
const CHECK_HOURS = +(env.CHECK_HOURS || 12);
const MAX_RUNS = 60;

// ---------- storage ----------
const file = name => join(DATA_DIR, name);
async function load(name, fallback) {
  try { return JSON.parse(await readFile(file(name), 'utf8')); } catch { return structuredClone(fallback); }
}
async function save(name, data) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(file(name) + '.tmp', JSON.stringify(data, null, 1));
  await rename(file(name) + '.tmp', file(name));
}

// ---------- site check ----------
let checking = null;
async function checkNow() {
  if (checking) return checking;
  checking = (async () => {
    const baseline = await load('baseline.json', {});
    const run = await runSiteCheck(baseline);
    // First successful read of a page becomes its baseline.
    let baseChanged = false;
    for (const [name, page] of Object.entries(run.pages)) {
      if (!baseline[name] && page.status !== 'error' && page.ids?.length) { baseline[name] = page.ids; baseChanged = true; }
    }
    if (baseChanged) await save('baseline.json', baseline);
    const history = await load('sitecheck.json', { runs: [] });
    const prev = history.runs[0];
    history.runs = [run, ...history.runs].slice(0, MAX_RUNS);
    await save('sitecheck.json', history);
    if (!run.ok && (!prev || prev.ok || summary(prev) !== summary(run))) await alert(`Visa site check: ${summary(run)}`);
    if (run.ok && prev && !prev.ok) await alert('Visa site check: all public pages are OK again.');
    return run;
  })().finally(() => { checking = null; });
  return checking;
}
const summary = run => run.error || Object.entries(run.pages).filter(([, p]) => p.status !== 'ok')
  .map(([n, p]) => `${n} ${p.status}${p.missing?.length ? ' (missing ' + p.missing.join(', ') + ')' : ''}`).join('; ') || 'OK';

// Optional Telegram alert (TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID).
async function alert(text) {
  console.log('[alert]', text);
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }), signal: AbortSignal.timeout(15000),
    });
  } catch (e) { console.error('telegram', e.message); }
}

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
function send(res, code, body, type = 'text/html; charset=utf-8', extra = {}) {
  res.writeHead(code, { 'Content-Type': type, ...SECURITY, ...extra });
  res.end(body);
}
async function readBody(req, limit = 64 * 1024, raw = false) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw new Error('too large'); chunks.push(c); }
  const buf = Buffer.concat(chunks);
  return raw ? buf : buf.toString('utf8');
}

// ---------- public site ----------
const pages = { '/': 'index.html', '/privacy': 'privacy.html', '/family': 'family.html' };
const publicServer = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    // Caddy passes the visitor's address in X-Forwarded-For.
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (await handleAi(req, res, url, { load, save, readBody, send, ip })) return;
    if (await handleSync(req, res, url, { load, readBody, send, dataDir: DATA_DIR })) return;
    if (await handleOcr(req, res, url, { load, save, readBody, send, ip })) return;
    if (await handleHotels(req, res, url, { load, save, send, ip, dataDir: DATA_DIR })) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');
    if (url.pathname === '/api/fieldmap.json') {
      const map = await load('fieldmap.json', EMPTY_MAP);
      return send(res, 200, JSON.stringify(map), 'application/json', { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' });
    }
    if (url.pathname === '/api/directory.json') {
      const dir = await load('directory.json', EMPTY_DIRECTORY);
      return send(res, 200, JSON.stringify(dir), 'application/json', { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=600' });
    }
    if (url.pathname === '/api/health') return send(res, 200, '{"ok":true}', 'application/json', { 'Cache-Control': 'no-store' });
    const name = pages[url.pathname.replace(/\/+$/, '') || '/'];
    if (!name) return send(res, 404, '<h1>Not found</h1>');
    send(res, 200, await readFile(join(HERE, 'public', name)), 'text/html; charset=utf-8', { 'Cache-Control': 'public, max-age=600' });
  } catch (e) {
    console.error(e);
    send(res, 500, 'Server error', 'text/plain');
  }
});

// ---------- admin ----------
function authorised(req) {
  if (!ADMIN_PASSWORD) return false;
  const m = /^Basic (.+)$/.exec(req.headers.authorization || '');
  if (!m) return false;
  const pass = Buffer.from(m[1], 'base64').toString().split(':').slice(1).join(':');
  const a = Buffer.from(pass), b = Buffer.from(ADMIN_PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

function statusBadge(s) {
  const c = { ok: '#16a34a', changed: '#d97706', broken: '#dc2626', error: '#dc2626', problem: '#dc2626', paused: '#d97706' }[s] || '#64748b';
  return `<span class="b" style="background:${c}">${esc(s)}</span>`;
}

async function aiSection(newCodeShown = '') {
  const [codes, settingsSaved, usage] = await Promise.all([load('codes.json', { codes: [] }), load('settings.json', {}), load(`usage-${monthKey()}.json`, { perCode: {}, total: { scans: 0, cost: 0 } })]);
  const st = { ...DEFAULT_AI_SETTINGS, ...settingsSaved };
  const keyOk = !!env.RIVER_API_KEY;
  const rows = codes.codes.map(c => {
    const u = usage.perCode[c.id] || { scans: 0, cost: 0 };
    const limit = c.limit ?? st.defaultLimit;
    return `<tr><td><b>${esc(c.name)}</b><div class="muted">…${esc(c.last4)} · added ${esc(c.createdAt.slice(0, 10))}</div></td>
      <td>${u.scans} / ${limit}<div class="muted">$${(u.cost || 0).toFixed(3)}${u.lastAt ? ' · last ' + esc(new Date(u.lastAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })) : ''}</div></td>
      <td>${c.paused ? statusBadge('paused') : statusBadge('ok')}</td>
      <td><form method="post" action="/codes/update" style="display:flex;gap:6px;flex-wrap:wrap"><input type="hidden" name="id" value="${esc(c.id)}">
        <input name="limit" type="number" min="0" max="1000" value="${limit}" style="width:70px"><button name="do" value="limit">Set limit</button>
        <button name="do" value="${c.paused ? 'resume' : 'pause'}">${c.paused ? 'Resume' : 'Pause'}</button>
        <button name="do" value="remove" onclick="return confirm('Remove this code? The person can no longer use Helper AI.')">Remove</button></form></td></tr>`;
  }).join('');
  return `<h2>Helper AI (invite only)</h2><div class="card">
${keyOk ? '' : '<p class="msg err">No River API key in /opt/ivh/.env: Helper AI cannot answer.</p>'}
${newCodeShown ? `<p class="msg">New access code (shown only once, send it privately): <b style="font-size:18px;letter-spacing:1px">${esc(newCodeShown)}</b></p>` : ''}
<p>This month: <b>${usage.total.scans}</b> scans · estimated cost <b>$${(usage.total.cost || 0).toFixed(3)}</b> of $${st.monthlyCapUsd} cap · ${st.enabled ? statusBadge('ok') : statusBadge('paused')}</p>
<form method="post" action="/codes/new" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><input name="name" placeholder="Name (e.g. Rina – sister)" required maxlength="60" style="flex:1;min-width:200px;padding:6px">
<input name="limit" type="number" min="0" max="1000" value="${st.defaultLimit}" style="width:80px;padding:6px" title="Scans per month"><button class="p">Create access code</button></form>
<table><tr><th>Person</th><th>This month</th><th></th><th></th></tr>${rows || '<tr><td colspan="4" class="muted">No codes yet.</td></tr>'}</table>
<details style="margin-top:12px"><summary>Settings</summary><form method="post" action="/ai-settings" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:8px">
<label>Monthly cost cap (USD)<br><input name="monthlyCapUsd" type="number" step="0.5" min="0" value="${st.monthlyCapUsd}"></label>
<label>Default scans per person<br><input name="defaultLimit" type="number" min="0" value="${st.defaultLimit}"></label>
<label>Price per 1M input tokens (USD)<br><input name="priceInPerM" type="number" step="0.01" min="0" value="${st.priceInPerM}"></label>
<label>Price per 1M output tokens (USD)<br><input name="priceOutPerM" type="number" step="0.01" min="0" value="${st.priceOutPerM}"></label>
<label><input type="checkbox" name="enabled" ${st.enabled ? 'checked' : ''}> Helper AI switched on</label>
<div><button class="p">Save settings</button></div></form>
<p class="muted">Cost is an estimate from the token counts and the prices above: check River's price list and set them. Images and answers are never stored.</p></details></div>`;
}

async function adminPage(msg = '', mapText = null, mapErrors = [], newCodeShown = '', dirText = null, dirErrors = []) {
  const [history, baseline, map, dir] = await Promise.all([load('sitecheck.json', { runs: [] }), load('baseline.json', {}), load('fieldmap.json', EMPTY_MAP), load('directory.json', EMPTY_DIRECTORY)]);
  const syncCount = await readdir(join(DATA_DIR, 'sync')).then(f => f.filter(x => x.endsWith('.json')).length).catch(() => 0);
  const ocr = await load(`ocr-${new Date().toISOString().slice(0, 7)}.json`, { scans: 0, ms: 0, days: {} });
  const ocrSt = { ...DEFAULT_OCR_SETTINGS, ...(await load('settings.json', {})) };
  const hs = await load(`hotels-${new Date().toISOString().slice(0, 7)}.json`, { searches: 0, google: 0 });
  const hSt = { ...DEFAULT_HOTEL_SETTINGS, ...(await load('settings.json', {})) };
  const last = history.runs[0];
  const pageRows = last ? Object.entries(last.pages).map(([n, p]) => `<tr><td><b>${esc(n)}</b></td><td>${statusBadge(p.status)}</td>
    <td>${p.error ? esc(p.error) : ''}${p.missing?.length ? 'Missing fields the extension uses: <b>' + esc(p.missing.join(', ')) + '</b><br>' : ''}
    ${p.removed?.length ? 'Removed since baseline: ' + esc(p.removed.join(', ')) + '<br>' : ''}${p.added?.length ? 'New since baseline: ' + esc(p.added.join(', ')) : ''}</td>
    <td><form method="post" action="/baseline"><input type="hidden" name="page" value="${esc(n)}"><button ${p.ids?.length ? '' : 'disabled'}>Accept as baseline</button></form></td></tr>`).join('') : '';
  const runs = history.runs.slice(0, 20).map(r => `<tr><td>${esc(new Date(r.at).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' }))}</td><td>${statusBadge(r.ok ? 'ok' : 'problem')}</td><td>${esc(summary(r))}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>IVH admin</title><style>
body{margin:0;font:15px/1.5 system-ui,sans-serif;background:#f4f6fa;color:#1d2330}main{max-width:980px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px}.card{background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:14px;overflow-x:auto}
table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:6px 8px;border-top:1px solid #eef0f4;vertical-align:top;font-size:14px}
.b{color:#fff;border-radius:999px;padding:1px 9px;font-size:12px}button{font:inherit;padding:6px 12px;border-radius:8px;border:1px solid #c9d1de;background:#fff;cursor:pointer}
button.p{background:#0b5cad;color:#fff;border-color:#0b5cad}textarea{width:100%;box-sizing:border-box;min-height:260px;font:13px/1.4 ui-monospace,monospace}
.msg{background:#e9f8ef;border:1px solid #b7e4c7;padding:8px 12px;border-radius:8px}.err{background:#fde8e8;border-color:#f5c2c2}.muted{color:#64748b}
</style></head><body><main>
<h1>Indian Visa Form Helper — admin</h1><div class="muted">Reachable only over Tailscale. Times are Bangladesh time.</div>
${msg ? `<p class="msg">${esc(msg)}</p>` : ''}
${await aiSection(newCodeShown)}
<h2>Visa site check</h2><div class="card">
<p>Last check: <b>${last ? esc(new Date(last.at).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })) : 'never'}</b> ${last ? statusBadge(last.ok ? 'ok' : 'problem') : ''}
 · runs every ${CHECK_HOURS} h · <form method="post" action="/check" style="display:inline"><button class="p">Check now</button></form></p>
${last?.error ? `<p class="msg err">${esc(last.error)}</p>` : ''}
<table><tr><th>Page</th><th>Status</th><th>Details</th><th></th></tr>${pageRows}</table>
<p class="muted">Checked fields: ${Object.entries(EXPECTED).map(([n, ids]) => `${esc(n)} (${ids.length})`).join(', ')}. Baselines saved: ${Object.keys(baseline).length}.</p></div>
<h2>Field map (sent to every extension)</h2><div class="card">
<p class="muted">Version ${map.version}${map.updatedAt ? ' · saved ' + esc(new Date(map.updatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })) : ''}. Use it when the site renames a field: <code>"ids": {"oldId": "newId"}</code>,
one page only: <code>"pageIds": {"BasicDetails": {"oldId": "newId"}}</code>, a page moved: <code>"pageAliases": {"NewPath": "BasicDetails"}</code>. Extensions pick it up within an hour.</p>
${mapErrors.length ? `<p class="msg err">${mapErrors.map(esc).join('<br>')}</p>` : ''}
<form method="post" action="/fieldmap"><textarea name="map" spellcheck="false">${esc(mapText ?? JSON.stringify({ note: map.note || '', ids: map.ids, pageIds: map.pageIds, pageAliases: map.pageAliases }, null, 2))}</textarea>
<p><button class="p">Save and publish</button></p></form></div>
<h2>Hotel and hospital directory (shown in every extension)</h2><div class="card">
<p class="muted">Only add places you have checked. Fields: name, address1, address2, state, district, phone, email (hospitals: also doctor). State and district as the visa site lists them. ${dir.hotels.length} hotels, ${dir.hospitals.length} hospitals${dir.updatedAt ? ' · saved ' + esc(new Date(dir.updatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })) : ''}.</p>
${dirErrors.length ? `<p class="msg err">${dirErrors.map(esc).join('<br>')}</p>` : ''}
<form method="post" action="/directory"><textarea name="dir" spellcheck="false">${esc(dirText ?? JSON.stringify({ hotels: dir.hotels, hospitals: dir.hospitals }, null, 2))}</textarea>
<p><button class="p">Save directory</button></p></form></div>
<h2>Server passport scan (free for everyone)</h2><div class="card">
<p>This month: <b>${ocr.scans}</b> scans${ocr.scans ? ` · average ${(ocr.ms / ocr.scans / 1000).toFixed(1)} s` : ''} · today ${ocr.days[new Date().toISOString().slice(0, 10)] || 0} · ${ocrSt.ocrEnabled ? statusBadge('ok') : statusBadge('paused')}</p>
<form method="post" action="/ocr-settings" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
<label><input type="checkbox" name="ocrEnabled" ${ocrSt.ocrEnabled ? 'checked' : ''}> Server scan switched on</label>
<label>Scans per visitor per day <input name="ocrDailyPerVisitor" type="number" min="1" max="500" value="${ocrSt.ocrDailyPerVisitor}" style="width:80px"></label>
<button class="p">Save</button></form>
<p class="muted">Images are read in memory by the OCR container and never stored; only these counts are kept.</p></div>
<h2>Free hotel search</h2><div class="card">
<p>This month: <b>${hs.searches}</b> searches · ${hs.google} used Google · Google key ${env.GOOGLE_PLACES_KEY ? statusBadge('ok') : '<span class="b" style="background:#64748b">not set</span>'} · ${hSt.hotelsEnabled ? statusBadge('ok') : statusBadge('paused')}</p>
<form method="post" action="/hotel-settings" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
<label><input type="checkbox" name="hotelsEnabled" ${hSt.hotelsEnabled ? 'checked' : ''}> Hotel search switched on</label>
<label>Searches per visitor per day <input name="hotelsDailyPerVisitor" type="number" min="1" max="500" value="${hSt.hotelsDailyPerVisitor}" style="width:80px"></label>
<label>Google searches per day (all users) <input name="googleDailyLimit" type="number" min="0" max="1000" value="${hSt.googleDailyLimit}" style="width:80px"></label>
<button class="p">Save</button></form>
<p class="muted">OpenStreetMap results are kept 30 days per city; Google results are fetched live and not stored. Google's free allowance is about 1,000 searches a month, so keep the daily Google limit at 30 or less.</p></div>
<h2>Agency sync</h2><div class="card"><p>${syncCount} encrypted sync space(s). Their contents can only be read with each agency's own password.</p></div>
<h2>Recent checks</h2><div class="card"><table><tr><th>When</th><th></th><th>Result</th></tr>${runs}</table></div>
</main></body></html>`;
}

// Admin pages send their own origin with form posts (the public pages send no referrer at all).
const asend = (res, code, body, type, extra = {}) => send(res, code, body, type, { 'Referrer-Policy': 'same-origin', ...extra });

const adminServer = http.createServer(async (req, res) => {
  try {
    if (!authorised(req)) return asend(res, 401, 'Password required', 'text/plain', { 'WWW-Authenticate': 'Basic realm="IVH admin", charset="UTF-8"' });
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/') return asend(res, 200, await adminPage(), undefined, { 'Cache-Control': 'no-store' });
    if (req.method !== 'POST') return asend(res, 404, 'Not found', 'text/plain');
    // Forms post back to this same page (the admin pages send their origin, see asend); refuse anything else.
    const origin = req.headers.origin;
    let sameHost = false;
    try { sameHost = new URL(origin).host === req.headers.host; } catch { /* missing or "null" origin */ }
    if (!sameHost) return asend(res, 403, 'Forbidden: open the dashboard at its own address and try again.', 'text/plain');
    const form = new URLSearchParams(await readBody(req));
    if (url.pathname === '/check') {
      const run = await checkNow();
      return asend(res, 200, await adminPage(`Check finished: ${summary(run)}`));
    }
    if (url.pathname === '/baseline') {
      const page = form.get('page');
      const last = (await load('sitecheck.json', { runs: [] })).runs[0];
      const ids = last?.pages?.[page]?.ids;
      if (!ids?.length) return asend(res, 200, await adminPage('Nothing to accept for that page.'));
      const baseline = await load('baseline.json', {});
      baseline[page] = ids;
      await save('baseline.json', baseline);
      return asend(res, 200, await adminPage(`Baseline for ${page} updated (${ids.length} fields).`));
    }
    if (url.pathname === '/codes/new') {
      const name = (form.get('name') || '').trim().slice(0, 60);
      if (!name) return asend(res, 200, await adminPage('Give the code a name.'));
      const code = newCode();
      const data = await load('codes.json', { codes: [] });
      const limit = Math.max(0, Math.min(1000, parseInt(form.get('limit'), 10) || 0));
      data.codes.push({ id: hashCode(code).slice(0, 12), name, hash: hashCode(code), last4: code.slice(-4), limit, paused: false, createdAt: new Date().toISOString() });
      await save('codes.json', data);
      return asend(res, 200, await adminPage(`Code for ${name} created.`, null, [], code), undefined, { 'Cache-Control': 'no-store' });
    }
    if (url.pathname === '/codes/update') {
      const data = await load('codes.json', { codes: [] });
      const c = data.codes.find(x => x.id === form.get('id'));
      if (!c) return asend(res, 200, await adminPage('Code not found.'));
      const action = form.get('do');
      if (action === 'remove') data.codes = data.codes.filter(x => x !== c);
      else if (action === 'pause') c.paused = true;
      else if (action === 'resume') c.paused = false;
      else if (action === 'limit') c.limit = Math.max(0, Math.min(1000, parseInt(form.get('limit'), 10) || 0));
      await save('codes.json', data);
      return asend(res, 200, await adminPage(`${c.name}: ${action} done.`));
    }
    if (url.pathname === '/hotel-settings') {
      const n = (k, d, max) => Math.max(0, Math.min(max, parseInt(form.get(k), 10) || d));
      await save('settings.json', { ...(await load('settings.json', {})), hotelsEnabled: form.get('hotelsEnabled') === 'on', hotelsDailyPerVisitor: n('hotelsDailyPerVisitor', 30, 500) || 1, googleDailyLimit: n('googleDailyLimit', 0, 1000) });
      return asend(res, 200, await adminPage('Hotel search settings saved.'));
    }
    if (url.pathname === '/ocr-settings') {
      const n = Math.max(1, Math.min(500, parseInt(form.get('ocrDailyPerVisitor'), 10) || DEFAULT_OCR_SETTINGS.ocrDailyPerVisitor));
      await save('settings.json', { ...(await load('settings.json', {})), ocrEnabled: form.get('ocrEnabled') === 'on', ocrDailyPerVisitor: n });
      return asend(res, 200, await adminPage('Server scan settings saved.'));
    }
    if (url.pathname === '/ai-settings') {
      const num = (k, max) => Math.max(0, Math.min(max, parseFloat(form.get(k)) || 0));
      await save('settings.json', { ...(await load('settings.json', {})), enabled: form.get('enabled') === 'on', monthlyCapUsd: num('monthlyCapUsd', 1000), defaultLimit: Math.round(num('defaultLimit', 1000)), priceInPerM: num('priceInPerM', 100), priceOutPerM: num('priceOutPerM', 100) });
      return asend(res, 200, await adminPage('Helper AI settings saved.'));
    }
    if (url.pathname === '/directory') {
      const text = form.get('dir') || '';
      let data;
      try { data = JSON.parse(text); } catch (e) { return asend(res, 200, await adminPage('', null, [], '', text, ['Not valid JSON: ' + e.message])); }
      const errors = validateDirectory(data);
      if (errors.length) return asend(res, 200, await adminPage('', null, [], '', text, errors));
      const clean = { hotels: data.hotels || [], hospitals: data.hospitals || [], updatedAt: new Date().toISOString() };
      await save('directory.json', clean);
      return asend(res, 200, await adminPage(`Directory saved: ${clean.hotels.length} hotels, ${clean.hospitals.length} hospitals.`));
    }
    if (url.pathname === '/fieldmap') {
      const text = form.get('map') || '';
      let data;
      try { data = JSON.parse(text); } catch (e) { return asend(res, 200, await adminPage('', text, ['Not valid JSON: ' + e.message])); }
      const errors = validateFieldMap(data);
      if (errors.length) return asend(res, 200, await adminPage('', text, errors));
      const old = await load('fieldmap.json', EMPTY_MAP);
      const map = { ...EMPTY_MAP, ...data, version: (old.version || 0) + 1, updatedAt: new Date().toISOString() };
      await save('fieldmap.json', map);
      return asend(res, 200, await adminPage(`Field map version ${map.version} published.`));
    }
    asend(res, 404, 'Not found', 'text/plain');
  } catch (e) {
    console.error(e);
    asend(res, 500, 'Server error', 'text/plain');
  }
});

// The admin address is the server's Tailscale IP, which may come up after this service: retry until it binds.
function listenAdmin() {
  adminServer.once('error', e => { console.error('admin listen', e.code); setTimeout(listenAdmin, 15000); });
  adminServer.listen(ADMIN_PORT, ADMIN_HOST, () => console.log(`admin on http://${ADMIN_HOST}:${ADMIN_PORT}`));
}

publicServer.listen(PUBLIC_PORT, PUBLIC_HOST, () => console.log(`public on http://${PUBLIC_HOST}:${PUBLIC_PORT}`));
if (ADMIN_PASSWORD) listenAdmin(); else console.warn('ADMIN_PASSWORD not set: admin dashboard is off');
setTimeout(() => checkNow().catch(e => console.error('check', e)), 10000);
setInterval(() => checkNow().catch(e => console.error('check', e)), CHECK_HOURS * 3600 * 1000);
