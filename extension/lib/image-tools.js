// Photo and document preparation for the visa site: square JPEG photos and JPEG-based PDFs
// sized into the 100–500 KB window the upload pages require.
import { loadPdf } from './pdf-loader.js';

export const PHOTO_SIZE = 350;
export const DOC_MIN = 100 * 1024;
export const DOC_MAX = 500 * 1024;

export const readAsDataUrl = blob => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

export const dataUrlBytes = url => Math.round(((url.length - url.indexOf(',') - 1) * 3) / 4);

export async function loadImage(src) {
  const img = new Image();
  img.src = typeof src === 'string' ? src : URL.createObjectURL(src);
  await img.decode();
  return img;
}

// Renders an image file or every page of a PDF file to canvases.
export async function fileToCanvases(file, targetWidth = 1400) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
    const doc = await loadPdf(await file.arrayBuffer());
    const out = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: targetWidth / base.width });
      const c = document.createElement('canvas');
      c.width = Math.round(viewport.width);
      c.height = Math.round(viewport.height);
      await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
      out.push(c);
    }
    return out;
  }
  const img = await loadImage(file);
  const scale = Math.min(1, targetWidth / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  return [c];
}

// Draws `img` into a size×size square using the cropper's view (zoom and offset of the image centre).
export function renderSquare(img, view, size = PHOTO_SIZE) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, size, size);
  const base = size / Math.min(img.naturalWidth, img.naturalHeight);
  const s = base * view.zoom;
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  g.drawImage(img, size / 2 - w / 2 + view.dx * size, size / 2 - h / 2 + view.dy * size, w, h);
  return c;
}

// JPEG at the highest quality that keeps the photo under maxBytes.
export function photoJpeg(canvas, maxBytes = 240 * 1024) {
  for (let q = 0.92; q >= 0.4; q -= 0.08) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (dataUrlBytes(url) <= maxBytes) return url;
  }
  return canvas.toDataURL('image/jpeg', 0.4);
}

// Builds a PDF from canvases, adjusting JPEG quality and resolution until it lands within [min, max] bytes.
// If no try lands inside the range, the result is never over `max` (the site refuses those): the largest one
// under max is kept, else the smallest one made.
export async function canvasesToPdf(canvases, min = DOC_MIN, max = DOC_MAX) {
  let scale = 1, q = 0.82, under = null, smallest = null;
  for (let attempt = 0; attempt < 14; attempt++) {
    const jpegs = await Promise.all(canvases.map(c => jpegBytes(resize(c, scale), q)));
    const pdf = buildPdf(jpegs);
    if (pdf.length >= min && pdf.length <= max) return new Blob([pdf], { type: 'application/pdf' });
    if (pdf.length < max && (!under || pdf.length > under.length)) under = pdf;
    if (!smallest || pdf.length < smallest.length) smallest = pdf;
    if (pdf.length > max) {
      if (q > 0.45) q -= 0.12; else scale *= 0.8;
    } else if (q < 0.94) q = Math.min(0.95, q + 0.08); else scale *= 1.25;
  }
  return new Blob([under || smallest], { type: 'application/pdf' });
}

function resize(c, scale) {
  if (Math.abs(scale - 1) < 0.01) return c;
  const o = document.createElement('canvas');
  o.width = Math.max(1, Math.round(c.width * scale));
  o.height = Math.max(1, Math.round(c.height * scale));
  const g = o.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(c, 0, 0, o.width, o.height);
  return o;
}

async function jpegBytes(canvas, q) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w: canvas.width, h: canvas.height };
}

// Minimal PDF 1.4 writer: one JPEG (DCTDecode) per A4 page, scaled to fit with margins.
export function buildPdf(images) {
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let length = 0;
  const push = chunk => { const b = typeof chunk === 'string' ? enc.encode(chunk) : chunk; parts.push(b); length += b.length; };
  const obj = (n, body) => { offsets[n] = length; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };

  const A4W = 595, A4H = 842, M = 24;
  const pageIds = images.map((_, i) => 3 + i * 3);
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Count ${images.length} /Kids [${pageIds.map(id => id + ' 0 R').join(' ')}] >>`));
  images.forEach((img, i) => {
    const pid = pageIds[i], cid = pid + 1, iid = pid + 2;
    const s = Math.min((A4W - 2 * M) / img.w, (A4H - 2 * M) / img.h);
    const w = img.w * s, h = img.h * s, x = (A4W - w) / 2, y = (A4H - h) / 2;
    obj(pid, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4W} ${A4H}] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`));
    const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${i} Do Q`;
    obj(cid, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    obj(iid, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`);
      push(img.bytes);
      push('\nendstream');
    });
  });
  const count = 3 + images.length * 3;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) push(String(offsets[n]).padStart(10, '0') + ' 00000 n \n');
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
