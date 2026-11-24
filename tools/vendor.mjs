// Copies third-party runtime files from node_modules into extension/lib (MV3 forbids remote code).
import { cpSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';
const nm = 'node_modules/', lib = 'extension/lib/';
const copy = (from, to) => { mkdirSync((lib + to).replace(/[^/]+$/, ''), { recursive: true }); cpSync(nm + from, lib + to); };
copy('pdfjs-dist/build/pdf.min.mjs', 'pdfjs/pdf.min.mjs');
copy('pdfjs-dist/build/pdf.worker.min.mjs', 'pdfjs/pdf.worker.min.mjs');
copy('tesseract.js/dist/tesseract.min.js', 'tesseract/tesseract.min.js');
copy('tesseract.js/dist/worker.min.js', 'tesseract/worker.min.js');
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.js', 'tesseract-core-simd-lstm.js', 'tesseract-core-lstm.wasm', 'tesseract-core-simd-lstm.wasm'])
  copy('tesseract.js-core/' + f, 'tesseract/' + f);
copy('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'tesseract/lang/eng.traineddata.gz');
// The official Anthropic SDK, bundled to one ES module for the side panel's AI passport scan.
await build({ entryPoints: ['tools/anthropic-entry.mjs'], bundle: true, format: 'esm', platform: 'browser', minify: true, outfile: lib + 'anthropic/sdk.js', logLevel: 'warning' });
console.log('vendored into', lib);
