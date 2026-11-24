// Dev check: run the extension's AI passport scan (OpenAI-compatible path) from Node.
// Usage: node tools/test-ai-scan.mjs <baseUrl> [model] [passport.jpg]
// The API key is read from ~/.visa-helper-ai-key and never printed. Without a model, lists the server's models.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { _forTests } from '../extension/lib/ai-scan.js';
import { openAICompatibleJson } from '../extension/lib/ai-client.js';

const [baseUrl, model, image] = process.argv.slice(2);
const key = readFileSync(homedir() + '/.visa-helper-ai-key', 'utf8').trim();

if (!model) {
  const r = await fetch(baseUrl.replace(/\/+$/, '') + '/models', { headers: { Authorization: `Bearer ${key}` } });
  console.log('GET /models →', r.status);
  const body = await r.json().catch(() => ({}));
  for (const m of body.data || []) console.log(' -', m.id);
  process.exit(0);
}

const images = [{ mediaType: 'image/jpeg', data: readFileSync(image).toString('base64') }];
const t0 = Date.now();
try {
  const raw = await openAICompatibleJson({ oaBaseUrl: baseUrl, oaModel: model, oaKey: key }, { system: _forTests.SYSTEM, text: 'Extract the passport fields.', images, schema: _forTests.SCHEMA, name: 'passport' });
  const { profile, warnings } = _forTests.toProfile(_forTests.normalize(raw));
  console.log(`OK in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(JSON.stringify({ profile, warnings }, null, 1));
} catch (e) {
  console.log(`FAILED in ${((Date.now() - t0) / 1000).toFixed(1)} s:`, e.message);
}
