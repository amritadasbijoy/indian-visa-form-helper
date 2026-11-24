// Dev check: parse a BGD PDF with the extension's parser and print the result.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'node:fs';
import { pdfLines } from '../extension/lib/pdf-lines.js';
import { parseBgd } from '../extension/lib/bgd-parser.js';
const doc = await getDocument({ data: new Uint8Array(readFileSync(process.argv[2])), verbosity: 0 }).promise;
console.log(JSON.stringify(parseBgd(await pdfLines(doc)), null, 1));
