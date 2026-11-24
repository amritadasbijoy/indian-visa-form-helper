// Builds dist/indian-visa-helper-v<version>.zip: the extension folder (as "indian-visa-helper/") plus the tester guide,
// and dist/indian-visa-helper-store-v<version>.zip for the Chrome Web Store (manifest.json at the zip's root).
import { readFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const { version } = JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
const stage = 'dist/stage', name = `indian-visa-helper-v${version}.zip`;
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage + '/indian-visa-helper', { recursive: true });
cpSync('extension', stage + '/indian-visa-helper', { recursive: true, filter: src => !/\.DS_Store$/.test(src) });
cpSync('TESTER-GUIDE.md', stage + '/TESTER-GUIDE.md');
rmSync('dist/' + name, { force: true });
execFileSync('zip', ['-qr', '../' + name, '.'], { cwd: stage });
rmSync(stage, { recursive: true, force: true });
console.log('built dist/' + name);

const storeName = `indian-visa-helper-store-v${version}.zip`;
rmSync('dist/' + storeName, { force: true });
execFileSync('zip', ['-qr', '../dist/' + storeName, '.', '-x', '*.DS_Store'], { cwd: 'extension' });
console.log('built dist/' + storeName);
