// Server passport scan, free for everyone: the extension posts the passport image here, the OCR container on this
// VPS (server/ocr, 127.0.0.1:8101) reads its text lines, and the extension turns them into fields. The image is
// passed on in memory and never stored. A daily limit per visitor and a queue keep the VPS responsive.
import { createHash } from 'node:crypto';

const OCR_URL = process.env.OCR_URL || 'http://127.0.0.1:8101/ocr';
const MAX = 8 * 1024 * 1024;
export const DEFAULT_OCR_SETTINGS = { ocrEnabled: true, ocrDailyPerVisitor: 40 };

// Visitors are counted by a hash of their address (the address itself is not kept), per day, in memory.
const daily = new Map();
let day = '';
const visitor = ip => createHash('sha256').update('ivh-ocr|' + ip).digest('hex').slice(0, 16);

// At most two reads at a time; the rest wait their turn.
let running = 0;
const waiting = [];
const slot = () => new Promise(resolve => { if (running < 2) { running++; resolve(); } else waiting.push(resolve); });
const release = () => { const next = waiting.shift(); if (next) next(); else running--; };

export async function handleOcr(req, res, url, { load, save, readBody, send, ip }) {
  if (url.pathname !== '/api/ocr') return false;
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
  const json = (code, obj) => send(res, code, JSON.stringify(obj), 'application/json', cors);
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return true; }
  if (req.method !== 'POST') { json(405, { error: 'method' }); return true; }

  const settings = { ...DEFAULT_OCR_SETTINGS, ...(await load('settings.json', {})) };
  if (!settings.ocrEnabled) { json(503, { error: 'off' }); return true; }
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { daily.clear(); day = today; }
  const who = visitor(ip);
  const used = daily.get(who) || 0;
  if (used >= settings.ocrDailyPerVisitor) { json(429, { error: 'daily_limit', limit: settings.ocrDailyPerVisitor }); return true; }
  if (waiting.length > 20) { json(503, { error: 'busy' }); return true; }

  let body;
  try { body = Buffer.from(await readBody(req, MAX, true)); } catch { json(413, { error: 'too_large' }); return true; }
  if (body.length < 1000) { json(400, { error: 'not_an_image' }); return true; }

  await slot();
  let out, status = 502;
  try {
    const r = await fetch(OCR_URL, { method: 'POST', body, headers: { 'Content-Type': 'application/octet-stream' }, signal: AbortSignal.timeout(60000) });
    status = r.status;
    out = await r.json().catch(() => ({}));
  } catch {
    out = { error: 'ocr_down' };
  } finally {
    release();
  }
  if (status !== 200) { json(status === 400 ? 400 : 502, { error: out.error || 'ocr_failed' }); return true; }

  daily.set(who, used + 1);
  // Monthly count for the admin page (numbers only).
  const month = today.slice(0, 7), file = `ocr-${month}.json`;
  const stats = await load(file, { month, scans: 0, ms: 0, days: {} });
  stats.scans += 1; stats.ms += out.ms || 0; stats.days[today] = (stats.days[today] || 0) + 1;
  await save(file, stats);

  json(200, { rows: out.rows || [], rotated: out.rotated || 0, ms: out.ms || 0, left: settings.ocrDailyPerVisitor - used - 1 });
  return true;
}
