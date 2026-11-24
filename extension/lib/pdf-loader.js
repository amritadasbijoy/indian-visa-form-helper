// Loads the bundled pdf.js once and opens PDF bytes with it.
let lib;

async function pdfLib() {
  if (!lib) {
    lib = await import(chrome.runtime.getURL('lib/pdfjs/pdf.min.mjs'));
    lib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdfjs/pdf.worker.min.mjs');
  }
  return lib;
}

export async function loadPdf(data) {
  return (await pdfLib()).getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
}

// The biggest roughly square picture on page 1 (the applicant photo on a printed BGD application),
// drawn on a canvas; null when there is none.
export async function firstPagePhoto(doc) {
  const { OPS } = await pdfLib();
  const page = await doc.getPage(1);
  const ops = await page.getOperatorList();
  const names = ops.fnArray.map((fn, i) => (fn === OPS.paintImageXObject ? ops.argsArray[i][0] : null)).filter(Boolean);
  let best = null;
  for (const name of new Set(names)) {
    const img = await new Promise(resolve => {
      try { page.objs.get(name, resolve); } catch { resolve(null); }
    });
    if (!img?.width || !img?.height) continue;
    const ratio = img.width / img.height;
    if (ratio < 0.75 || ratio > 1.33 || img.width < 80) continue; // a whole scanned A4 page is 0.71
    if (!best || img.width * img.height > best.width * best.height) best = img;
  }
  if (!best) return null;
  const c = document.createElement('canvas');
  c.width = best.width;
  c.height = best.height;
  const g = c.getContext('2d');
  if (best.bitmap) g.drawImage(best.bitmap, 0, 0);
  else if (best.data) {
    // kind 1: 1 bit grey, 2: RGB, 3: RGBA
    const out = g.createImageData(best.width, best.height);
    const n = best.width * best.height;
    if (best.kind === 3) out.data.set(best.data.subarray(0, n * 4));
    else if (best.kind === 2) for (let i = 0; i < n; i++) { out.data[i * 4] = best.data[i * 3]; out.data[i * 4 + 1] = best.data[i * 3 + 1]; out.data[i * 4 + 2] = best.data[i * 3 + 2]; out.data[i * 4 + 3] = 255; }
    else return null;
    g.putImageData(out, 0, 0);
  } else return null;
  return c;
}
