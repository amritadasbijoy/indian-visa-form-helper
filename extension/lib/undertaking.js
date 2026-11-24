// Fills IVAC Bangladesh's official "Visa Undertaking Form" (assets/ivac-visa-undertaking.pdf, from
// ivacbd.com → Other Forms → "Mandatory Submission of Visa Undertaking Form") with the applicant's details.
// The official page is rendered as it is and the values are written onto it, then saved as a PDF (100–500 KB)
// ready to print and sign. The signature line is left empty.
import { loadPdf } from './pdf-loader.js';
import { canvasesToPdf } from './image-tools.js';

const SCALE = 2.5; // render resolution (points → pixels)
const INK = '#0a2a6b'; // dark blue, like a filled-in form

// Text lines of the form that contain a blank, matched by their start; the blank's position comes from the
// PDF's own text metrics. Table rows (Personal Details) are placed in the right-hand column (x 222–556 pt).
const TABLE = { x: 226, right: 552, rows: ['Name (As per passport)', 'Passport No', 'Nationality', 'Date of Birth', 'Address in Dhaka'] };

export async function buildUndertaking({ name, passportNo, nationality, dob, address, purpose, returnTo, place, date }) {
  const doc = await loadPdf(await (await fetch(chrome.runtime.getURL('assets/ivac-visa-undertaking.pdf'))).arrayBuffer());
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: g, viewport }).promise;

  const items = (await page.getTextContent()).items.filter(i => i.str.trim());
  const H = viewport.height / SCALE;
  // Writes text with its baseline at PDF point (x, y), shrinking the font to fit maxWidth points.
  const write = (text, x, y, maxWidth, size = 10.5) => {
    if (!text) return;
    let px = size * SCALE;
    g.font = `600 ${px}px Helvetica, Arial, sans-serif`;
    while (g.measureText(text).width > maxWidth * SCALE && px > 6 * SCALE) {
      px -= 0.5 * SCALE;
      g.font = `600 ${px}px Helvetica, Arial, sans-serif`;
    }
    g.fillStyle = INK;
    g.fillText(text, x * SCALE, (H - y) * SCALE);
  };
  // Start/end (points) of the run of underscores inside a text item, from the item's width.
  const blank = item => {
    const s = item.str, a = s.indexOf('_'), b = s.lastIndexOf('_') + 1;
    g.font = '10px Helvetica, Arial, sans-serif';
    const ratio = item.width / g.measureText(s).width;
    const x0 = item.transform[4] + g.measureText(s.slice(0, a)).width * ratio;
    const x1 = item.transform[4] + g.measureText(s.slice(0, b)).width * ratio;
    return { x0, x1, y: item.transform[5] + 2 };
  };
  const line = start => items.find(i => i.str.trim().startsWith(start) && i.str.includes('_'));

  // "I, (Applicant's Name) ____, hereby undertake …"
  const nameLine = line('I, (Applicant');
  if (nameLine) { const b = blank(nameLine); write(name, b.x0 + 4, b.y, b.x1 - b.x0 - 8); }

  // Personal Details table.
  const values = [name, passportNo, nationality, dob, address];
  TABLE.rows.forEach((label, i) => {
    const cell = items.find(it => it.str.trim() === label);
    if (cell) write(values[i], TABLE.x, cell.transform[5], TABLE.right - TABLE.x);
  });

  // "I wish to visit India for the purpose of ____"
  const purposeLine = line('I wish to visit India');
  if (purposeLine) { const b = blank(purposeLine); write(purpose, b.x0 + 4, b.y, b.x1 - b.x0 - 8); }

  // "… I will return to" + a blank line of its own.
  const returnLine = items.find(i => /^_{5,}/.test(i.str.trim()));
  if (returnLine) { const b = blank(returnLine); write(returnTo, b.x0 + 4, b.y, b.x1 - b.x0 - 8); }

  // "Place and Date: ____"
  const placeLine = line('Place and Date');
  if (placeLine) { const b = blank(placeLine); write([place, date].filter(Boolean).join(', '), b.x0 + 4, b.y, b.x1 - b.x0 + 120); }

  const blob = await canvasesToPdf([canvas]);
  return { blob, canvas };
}
