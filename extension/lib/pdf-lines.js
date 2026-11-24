// Groups pdf.js text items into visual lines: [{page, y, cells:[{x, s}]}].
export async function pdfLines(doc) {
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { items } = await page.getTextContent();
    const rows = [];
    for (const it of items) {
      const s = it.str.trim();
      if (!s) continue;
      const x = it.transform[4], y = it.transform[5];
      let row = rows.find(r => Math.abs(r.y - y) < 3);
      if (!row) rows.push(row = { page: p, y, cells: [] });
      row.cells.push({ x: Math.round(x), s });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) { r.cells.sort((a, b) => a.x - b.x); r.y = Math.round(r.y); out.push(r); }
  }
  return out;
}
