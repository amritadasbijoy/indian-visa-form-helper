// Dev check: turn server OCR rows (JSON from /api/ocr) into passport fields with the extension's rules.
//   node tools/test-passport-rows.mjs rows.json
import { readFileSync } from 'node:fs';
globalThis.chrome = { runtime: { getURL: p => p } };
const { _forTests } = await import('../extension/lib/passport-ocr.js');
const { bestLine2 } = await import('../extension/lib/mrz.js');
const { rows } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let lines = null;
for (let k = rows.length - 1; k >= 0 && !lines; k--) {
  const line2 = bestLine2(rows[k]);
  if (line2) lines = { line1: (rows[k - 1] || '').replace(/[^A-Z0-9<]/gi, '').toUpperCase(), line2 };
}
console.log('MRZ:', lines);
if (lines) { const r = _forTests.passportFromText(rows.join('\n'), lines, null); console.log(JSON.stringify(r.profile, null, 1)); console.log('warnings', r.warnings); }
