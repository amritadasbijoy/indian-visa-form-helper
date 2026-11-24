// Dev helper: print the text lines pdf.js sees in a BGD PDF (same grouping the extension uses).
import { getDocument } from 'pdfjs-dist/build/pdf.mjs';
import { readFileSync } from 'node:fs';
import { pdfLines } from '../extension/lib/pdf-lines.js';
const data = new Uint8Array(readFileSync(process.argv[2]));
const doc = await getDocument({ data }).promise;
for (const l of await pdfLines(doc)) console.log(JSON.stringify(l));
