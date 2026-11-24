// Agency sync: each agency keeps one encrypted copy of its applicant list here, readable only with the agency
// password (encrypted in the browser, see extension/lib/crypto.js). Only invited users (a valid Helper AI access
// code) can store a copy. The server sees an id, a version number and an encrypted blob — never the data.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { hashCode } from './ai.mjs';

const ID = /^[0-9a-f]{40}$/;
const MAX = 12 * 1024 * 1024;

export async function handleSync(req, res, url, { load, readBody, send, dataDir }) {
  const m = /^\/api\/sync\/([0-9a-f]{40})$/.exec(url.pathname);
  if (!m && url.pathname !== '/api/sync') return false;
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS', 'Cache-Control': 'no-store' };
  const json = (code, obj) => send(res, code, JSON.stringify(obj), 'application/json', cors);
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return true; }
  if (!m || !ID.test(m[1])) { json(404, { error: 'not_found' }); return true; }

  const code = (/^Bearer\s+(.+)$/i.exec(req.headers.authorization || '') || [])[1];
  const codes = (await load('codes.json', { codes: [] })).codes;
  const entry = code && codes.find(c => c.hash === hashCode(code));
  if (!entry || entry.paused) { json(401, { error: 'invalid_code' }); return true; }

  const dir = join(dataDir, 'sync');
  const file = join(dir, m[1] + '.json');
  const current = await readFile(file, 'utf8').then(JSON.parse).catch(() => null);

  if (req.method === 'GET') {
    if (!current) { json(404, { error: 'empty', version: 0 }); return true; }
    json(200, current);
    return true;
  }
  if (req.method !== 'PUT') { json(405, { error: 'method' }); return true; }
  let body;
  try { body = JSON.parse(await readBody(req, MAX)); } catch { json(413, { error: 'too_large' }); return true; }
  const box = body?.box;
  if (!box || box.encrypted !== 1 || typeof box.data !== 'string' || typeof box.iv !== 'string' || typeof box.salt !== 'string') { json(400, { error: 'bad_request' }); return true; }
  const version = current?.version || 0;
  // Someone else uploaded since this computer last downloaded: send the newer copy back to be merged first.
  if ((body.baseVersion || 0) !== version) { json(409, { error: 'conflict', version }); return true; }
  const next = { version: version + 1, updatedAt: new Date().toISOString(), by: entry.name, box };
  await mkdir(dir, { recursive: true });
  await writeFile(file + '.tmp', JSON.stringify(next));
  await rename(file + '.tmp', file);
  json(200, { version: next.version, updatedAt: next.updatedAt });
  return true;
}
