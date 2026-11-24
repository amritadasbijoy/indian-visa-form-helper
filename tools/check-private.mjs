// Blocks a commit that would publish personal data. Run by .githooks/pre-commit on the staged files, or by hand:
//   node tools/check-private.mjs            (staged files)
//   node tools/check-private.mjs --all      (every tracked file)
// Extra private words (real names, places, numbers) go one per line in ~/.ivh-private-words, which is never
// committed, so the list itself stays private.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const all = process.argv.includes('--all');
const files = execSync(all ? 'git ls-files' : 'git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf8' })
  .split('\n').filter(Boolean);

// Made-up example values used in the code, docs and tests.
const OK = new Set(['A12345679', 'A12345678', 'B98765432', 'C11223344', '01712345678', '01811223344', '01911556677',
  '1990123456789', '19905612345678901', '127.0.0.1', '0.0.0.0', '0000000000', '0123456789', '1712345678', '1811223344',
  '1911556677', '6812345678', '9512345678', '2147483647']);
const RULES = [
  ['email address', /\b[A-Za-z0-9._%+-]+@(?!example\.(?:com|org))[A-Za-z0-9-]+\.[A-Za-z.]{2,}\b/g],
  ['IP address', /\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  ['API key', /\b(?:sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{32,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,})/g],
  ['Bangladesh phone number', /(?<![\d])(?:\+?880)?01[3-9]\d{8}(?!\d)/g],
  ['passport number', /\b[A-Z]{1,2}\d{7,8}\b/g],
  ['NID number', /(?<![\d.])(?:\d{10}|\d{13}|\d{17})(?![\d.])/g],
];
const words = existsSync(join(homedir(), '.ivh-private-words'))
  ? readFileSync(join(homedir(), '.ivh-private-words'), 'utf8').split('\n').map(w => w.trim()).filter(w => w && !w.startsWith('#'))
  : [];
const SKIP = /\.(png|jpe?g|gif|webp|ico|mp4|pdf|zip|wasm|traineddata|gz|onnx|woff2?)$|\.min\.(js|mjs)$|(^|\/)(vendor|pdfjs|tesseract|anthropic)\/|package-lock\.json$|tools\/check-private\.mjs$/;

let found = 0;
for (const file of files) {
  if (SKIP.test(file) || !existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    const hits = [];
    for (const [what, re] of RULES) for (const m of line.matchAll(re)) if (!OK.has(m[0].replace(/^\+?880/, ''))) hits.push(`${what} "${m[0]}"`);
    for (const w of words) if (line.toUpperCase().includes(w.toUpperCase())) hits.push(`private word "${w}"`);
    for (const h of hits) { console.log(`${file}:${i + 1}: ${h}`); found++; }
  });
}
if (found) {
  console.log(`\n✋ ${found} possible personal detail(s). Replace them with made-up examples, or add a true example to OK in tools/check-private.mjs.`);
  process.exit(1);
}
console.log(`✓ No personal data found in ${files.length} file(s).`);
