// Renders tools/icon.svg to the extension's PNG icons (16, 32, 48, 128) and the store icon
// (store/store-icon-128.png: 96 px artwork with a 16 px transparent border, as the Chrome Web Store asks).
// Uses the installed Google Chrome in headless mode; no npm dependencies.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const svg = readFileSync('tools/icon.svg', 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'ivh-icons-'));
function render(out, size, art = size) {
  const pad = (size - art) / 2;
  const html = join(dir, 'icon.html');
  writeFileSync(html, `<!doctype html><style>html,body{margin:0;background:transparent}div{width:${art}px;height:${art}px;margin:${pad}px}svg{width:100%;height:100%;display:block}</style><div>${svg}</div>`);
  execFileSync(chrome, ['--headless=new', `--user-data-dir=${join(dir, 'p')}`, '--hide-scrollbars', '--force-device-scale-factor=1',
    '--default-background-color=00000000', `--window-size=${size},${size}`, `--screenshot=${resolve(out)}`, 'file://' + html], { stdio: 'ignore' });
}
for (const s of [16, 32, 48, 128]) render(`extension/icons/icon${s}.png`, s);
render('store/store-icon-128.png', 128, 96);
rmSync(dir, { recursive: true, force: true });
console.log('icons written');
