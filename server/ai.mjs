// Helper AI: invite-only AI relay. The extension sends an OpenAI-style chat request with a personal access code;
// the server checks the code, the person's monthly limit and the overall monthly cost cap, then forwards the
// request to River with the owner's key. Images and answers are never stored: only counters per code and month.
import { randomBytes, createHash } from 'node:crypto';

const env = process.env;
const RIVER = { url: (env.RIVER_BASE_URL || 'https://api.river.ai/v1').replace(/\/+$/, '') + '/chat/completions', key: env.RIVER_API_KEY || '', model: env.RIVER_MODEL || '' };

export const DEFAULT_AI_SETTINGS = { enabled: true, defaultLimit: 30, monthlyCapUsd: 10, priceInPerM: 0.5, priceOutPerM: 1.5 };

export const hashCode = code => createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
export function newCode() {
  const b = randomBytes(12);
  const chars = [...b].map(x => ALPHABET[x % ALPHABET.length]).join('');
  return `IVH-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}
export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

// Too many wrong codes from one address: slow it down (in memory, per hour).
const bad = new Map();
const tooManyBad = ip => {
  const now = Date.now(), e = bad.get(ip);
  if (!e || now - e.at > 3600e3) return false;
  return e.n >= 20;
};
const noteBad = ip => {
  const now = Date.now(), e = bad.get(ip);
  bad.set(ip, !e || now - e.at > 3600e3 ? { n: 1, at: now } : { n: e.n + 1, at: e.at });
};

// Only these request fields are passed on; the model is always the server's.
function cleanRequest(body) {
  const max = Math.min(+body.max_tokens || 4000, 16000);
  const out = { model: RIVER.model, messages: body.messages, max_tokens: max };
  if (body.response_format && ['json_schema', 'json_object'].includes(body.response_format.type)) out.response_format = body.response_format;
  if (typeof body.temperature === 'number') out.temperature = body.temperature;
  // Nemotron "thinks" before answering by default: 25–50 s and sometimes no answer at all for a passport.
  // Reading a passport needs no reasoning; with it off the scan takes about 2 s and reads the same fields.
  if (/nemotron/i.test(RIVER.model)) out.reasoning_effort = env.RIVER_REASONING_EFFORT || 'none';
  return out;
}

const validMessages = m => Array.isArray(m) && m.length > 0 && m.length <= 10 && m.every(x => x && ['system', 'user', 'assistant'].includes(x.role));

/**
 * Handles /api/ai/* on the public server. `store` gives load/save for JSON files.
 * Returns true when it answered the request.
 */
export async function handleAi(req, res, url, { load, save, readBody, send, ip }) {
  if (!url.pathname.startsWith('/api/ai/')) return false;
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' };
  const json = (code, obj) => send(res, code, JSON.stringify(obj), 'application/json', cors);
  const fail = (code, message, type) => json(code, { error: { message, type } });
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return true; }

  if (tooManyBad(ip)) { fail(429, 'Too many wrong access codes. Try again in an hour.', 'too_many_attempts'); return true; }
  const code = (/^Bearer\s+(.+)$/i.exec(req.headers.authorization || '') || [])[1];
  const codes = (await load('codes.json', { codes: [] })).codes;
  const entry = code && codes.find(c => c.hash === hashCode(code));
  if (!entry) { noteBad(ip); fail(401, 'This access code is not valid.', 'invalid_code'); return true; }
  if (entry.paused) { fail(403, 'This access code is paused. Ask the person who invited you.', 'paused'); return true; }

  const settings = { ...DEFAULT_AI_SETTINGS, ...(await load('settings.json', {})) };
  const month = monthKey();
  const usageFile = `usage-${month}.json`;
  const usage = await load(usageFile, { month, perCode: {}, total: { scans: 0, cost: 0 } });
  const mine = usage.perCode[entry.id] || { scans: 0, inTok: 0, outTok: 0, cost: 0 };
  const limit = entry.limit ?? settings.defaultLimit;

  if (url.pathname === '/api/ai/me' && req.method === 'GET') {
    json(200, { name: entry.name, used: mine.scans, limit, month, enabled: settings.enabled && !!RIVER.key });
    return true;
  }
  if (url.pathname !== '/api/ai/chat/completions' || req.method !== 'POST') { fail(404, 'Not found', 'not_found'); return true; }
  if (!settings.enabled || !RIVER.key || !RIVER.model) { fail(503, 'Helper AI is switched off right now.', 'disabled'); return true; }
  if (mine.scans >= limit) { fail(429, `Monthly limit reached (${limit} scans). It resets on the 1st.`, 'limit_reached'); return true; }
  if (usage.total.cost >= settings.monthlyCapUsd) { fail(429, 'Helper AI has reached its monthly budget. It resets on the 1st.', 'budget_reached'); return true; }

  let body;
  try { body = JSON.parse(await readBody(req, 12 * 1024 * 1024)); } catch { fail(400, 'Request too large or not JSON.', 'bad_request'); return true; }
  if (!validMessages(body.messages)) { fail(400, 'Bad request.', 'bad_request'); return true; }

  let upstream, data;
  try {
    upstream = await fetch(RIVER.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RIVER.key}` },
      body: JSON.stringify(cleanRequest(body)),
      signal: AbortSignal.timeout(170000),
    });
    data = await upstream.json().catch(() => ({}));
  } catch (e) {
    fail(502, 'The AI service did not answer. Try again.', 'upstream');
    return true;
  }

  // Count tokens and estimated cost for every answered request; count a scan only when it succeeded.
  const u = data.usage || {};
  const inTok = u.prompt_tokens || 0, outTok = u.completion_tokens || 0;
  const cost = (inTok * settings.priceInPerM + outTok * settings.priceOutPerM) / 1e6;
  const fresh = await load(usageFile, { month, perCode: {}, total: { scans: 0, cost: 0 } });
  const m = fresh.perCode[entry.id] || { scans: 0, inTok: 0, outTok: 0, cost: 0 };
  m.inTok += inTok; m.outTok += outTok; m.cost += cost; m.lastAt = new Date().toISOString();
  if (upstream.ok) { m.scans += 1; fresh.total.scans += 1; }
  fresh.total.cost += cost;
  fresh.perCode[entry.id] = m;
  await save(usageFile, fresh);

  if (!upstream.ok) {
    // Pass on format complaints (the extension retries with a simpler format); hide anything about the key.
    const msg = String(data?.error?.message || `HTTP ${upstream.status}`);
    if (upstream.status === 400 || upstream.status === 422) fail(upstream.status, msg.slice(0, 300), 'upstream_format');
    else fail(502, 'The AI service returned an error. Try again later.', 'upstream');
    return true;
  }
  json(200, { choices: data.choices, usage: { prompt_tokens: inTok, completion_tokens: outTok } });
  return true;
}
