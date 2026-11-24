// Turns osmium's GeoJSON lines (hotels in India) into a compact list for server/hotels.mjs:
//   [{ type, id, lat, lon, tags }] — buildings get the middle point of their outline. Only named places are kept.
//   node compact.mjs hotels.geojsonseq out.json
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const [, , input, output] = process.argv;
const KEEP = /^(name|name:en|tourism|phone|contact:phone|contact:mobile|email|contact:email|website|contact:website|addr:.*)$/;
const out = [];
const centre = g => {
  if (g.type === 'Point') return g.coordinates;
  const pts = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : g.type === 'LineString' ? g.coordinates : null;
  if (!pts?.length) return null;
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
};
for await (const line of createInterface({ input: createReadStream(input) })) {
  if (!line.trim()) continue;
  const f = JSON.parse(line);
  const p = f.properties || {};
  if (!p.name && !p['name:en']) continue;
  const c = f.geometry && centre(f.geometry);
  if (!c) continue;
  const tags = Object.fromEntries(Object.entries(p).filter(([k]) => KEEP.test(k)));
  // osmium's unique id: n123 / w456 / r789 (node, way, relation).
  const m = /^([nwr])(\d+)$/.exec(String(f.id || ''));
  out.push({ type: { n: 'node', w: 'way', r: 'relation' }[m?.[1]] || 'node', id: m?.[2] || '', lat: +c[1].toFixed(6), lon: +c[0].toFixed(6), tags });
}
writeFileSync(output, JSON.stringify(out));
console.log(`${out.length} hotels`);
