// Free hotel search for everyone (Hotels tab → Find hotels): real hotels only, never AI and never invented.
//   1. OpenStreetMap: the city (Nominatim) and hotels around it (Overpass). Kept 30 days per city.
//   2. Each hotel's own website: its phone number, when the map has none. Kept with the city.
//   3. Google Places (official API, optional: GOOGLE_PLACES_KEY in .env): more hotels with phone and full address.
//      Fetched live for each search and not stored (Google's terms), with a daily cap to stay in the free allowance.
// Every result says where it came from; OpenStreetMap and Google both ask for that credit.
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const env = process.env;
const UA = 'VisaFormHelper/1.0 (+https://ivh.techistbd.com; hotel search for Indian visa applicants)';
const DAY = 864e5;
const CACHE_DAYS = 30;
export const DEFAULT_HOTEL_SETTINGS = { hotelsEnabled: true, hotelsDailyPerVisitor: 30, googleDailyLimit: +(env.GOOGLE_DAILY_LIMIT || 30) };

// The visa site's names for a few states.
const STATE_FIX = { ODISHA: 'ORISSA', PUDUCHERRY: 'PONDICHERRY', 'NATIONAL CAPITAL TERRITORY OF DELHI': 'DELHI', 'NCT OF DELHI': 'DELHI', 'DELHI NCT': 'DELHI' };
const up = s => String(s || '').replace(/\s+/g, ' ').trim().toUpperCase();
const state = s => STATE_FIX[up(s)] || up(s);
const district = s => up(s).replace(/\s+DISTRICT$/, '');
const digits = s => String(s || '').replace(/[^\d+]/g, '');
const key = s => up(s).replace(/[^A-Z0-9]/g, '');

// Indian phone numbers on a web page: tel: links first, then +91 / 0-prefixed numbers in the text.
export function phonesIn(html) {
  const out = [];
  for (const m of html.matchAll(/href=["']tel:([^"']+)["']/gi)) out.push(m[1]);
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
  for (const m of text.matchAll(/(?:\+91|\b0091|\b0)[\s.-]?\(?\d{2,5}\)?[\s.-]?\d{3,5}[\s.-]?\d{3,5}\b/g)) out.push(m[0]);
  return [...new Set(out.map(digits).map(p => p.replace(/^0091/, '+91')).filter(p => {
    const d = p.replace(/^\+91/, '').replace(/^0/, '');
    return d.length === 10;
  }))];
}

async function get(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'User-Agent': UA, 'Accept-Language': 'en', ...(opts.headers || {}) }, signal: AbortSignal.timeout(opts.timeout || 20000), redirect: 'follow' });
  if (!res.ok) throw new Error(`${new URL(url).host} HTTP ${res.status}`);
  return res;
}

// Nominatim allows one request per second: queue them.
let lastNominatim = 0;
async function geocode(city) {
  const wait = lastNominatim + 1100 - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatim = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=in&q=${encodeURIComponent(city)}`;
  const [hit] = await (await get(url)).json();
  if (!hit) return null;
  const a = hit.address || {};
  return { lat: +hit.lat, lon: +hit.lon, name: a.city || a.town || a.village || hit.name, state: state(a.state), district: district(a.state_district || a.county || a.city || '') };
}

// Local list of India's hotels (server/osm/update-hotels.sh, monthly): fast and independent of busy public servers.
let local = { mtime: 0, list: [] };
async function localHotels(dataDir) {
  const file = join(dataDir, 'india-hotels.json');
  try {
    const { mtimeMs } = await stat(file);
    if (mtimeMs !== local.mtime) local = { mtime: mtimeMs, list: JSON.parse(await readFile(file, 'utf8')) };
  } catch { local = { mtime: 0, list: [] }; }
  return local.list;
}
const km = (a, b, c, d) => {
  const r = Math.PI / 180, x = (d - b) * r * Math.cos(((a + c) / 2) * r), y = (c - a) * r;
  return 6371 * Math.hypot(x, y);
};
async function nearby(dataDir, lat, lon, radiusM) {
  const list = await localHotels(dataDir);
  if (!list.length) return null; // no local list yet: use Overpass
  return list.filter(h => km(lat, lon, h.lat, h.lon) * 1000 <= radiusM).slice(0, 200);
}

// Fallback when there is no local list: the public Overpass servers (often busy), tried in turn.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
async function overpass(lat, lon, radius) {
  const q = `[out:json][timeout:25];(nwr["tourism"~"^(hotel|guest_house|motel)$"]["name"](around:${radius},${lat},${lon}););out center tags 80;`;
  let last;
  for (const server of OVERPASS) {
    try {
      const res = await get(server, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 });
      return (await res.json()).elements || [];
    } catch (e) { last = e; }
  }
  throw last;
}

function fromOsm(el, place) {
  const t = el.tags || {};
  const street = [t['addr:housenumber'], t['addr:street'], t['addr:suburb'] || t['addr:neighbourhood']].filter(Boolean).join(', ');
  return {
    name: up(t['name:en'] || t.name),
    address: up(street || t['addr:full'] || ''),
    city: up(t['addr:city'] || place.name),
    pincode: (t['addr:postcode'] || '').replace(/\s/g, ''),
    state: state(t['addr:state']) || place.state,
    district: place.district || up(place.name),
    phone: digits((t.phone || t['contact:phone'] || t['contact:mobile'] || '').split(';')[0]),
    email: String(t.email || t['contact:email'] || '').trim().toLowerCase(),
    website: t.website || t['contact:website'] || '',
    source: 'osm',
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  };
}

// Website links come from public map data: only open public internet addresses (never this server or a private
// network, e.g. the admin page), over http(s) on the usual ports.
const PRIVATE = /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|fc|fd|fe80:)/i;
async function publicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (!/^https?:$/.test(u.protocol) || (u.port && !['80', '443'].includes(u.port)) || u.username || u.password) return false;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  return addrs.length > 0 && addrs.every(a => !PRIVATE.test(a.address));
}

// Reads phone numbers from the hotels' own websites (a few at a time, small pages only).
async function phonesFromWebsites(hotels, max = 10) {
  const todo = hotels.filter(h => !h.phone && /^https?:\/\//i.test(h.website)).slice(0, max);
  await Promise.all(todo.map(async h => {
    try {
      // Follow up to 3 redirects by hand, checking every address on the way.
      let target = h.website, res = null;
      for (let hop = 0; hop < 4 && target; hop++) {
        if (!(await publicUrl(target))) return;
        res = await fetch(target, { headers: { 'User-Agent': UA }, redirect: 'manual', signal: AbortSignal.timeout(8000) });
        const next = res.status >= 300 && res.status < 400 && res.headers.get('location');
        target = next ? new URL(next, target).href : '';
      }
      if (!res?.ok) return;
      const html = (await res.text()).slice(0, 600000);
      const [phone] = phonesIn(html);
      if (phone) { h.phone = phone; h.phoneFrom = 'website'; }
    } catch { /* site down or slow: leave the phone empty */ }
  }));
}

// Google Places (New) Text Search: hotels in the city with phone and address parts.
async function google(city, apiKey) {
  const res = await get('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.addressComponents,places.websiteUri,places.googleMapsUri',
    },
    body: JSON.stringify({ textQuery: `hotels in ${city}, India`, languageCode: 'en', regionCode: 'IN', includedType: 'lodging', pageSize: 20 }),
  });
  const { places = [] } = await res.json();
  return places.map(p => {
    const comp = type => (p.addressComponents || []).find(c => c.types?.includes(type))?.longText || '';
    const street = [comp('street_number'), comp('route'), comp('sublocality_level_2'), comp('sublocality_level_1')].filter(Boolean).join(', ');
    return {
      name: up(p.displayName?.text),
      address: up(street),
      city: up(comp('locality') || city),
      pincode: comp('postal_code'),
      state: state(comp('administrative_area_level_1')),
      district: district(comp('administrative_area_level_3') || comp('administrative_area_level_2') || comp('locality')),
      phone: digits(p.internationalPhoneNumber || p.nationalPhoneNumber),
      email: '',
      website: p.websiteUri || '',
      source: 'google',
      sourceUrl: p.googleMapsUri || '',
    };
  }).filter(h => h.name);
}

const visitor = ip => createHash('sha256').update('ivh-hotels|' + ip).digest('hex').slice(0, 16);
const perVisitor = new Map();
let day = '', googleToday = 0;

export async function handleHotels(req, res, url, { load, save, send, ip, dataDir }) {
  if (url.pathname !== '/api/hotels') return false;
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Cache-Control': 'no-store' };
  const json = (code, obj) => send(res, code, JSON.stringify(obj), 'application/json', cors);
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return true; }
  if (req.method !== 'GET') { json(405, { error: 'method' }); return true; }

  const settings = { ...DEFAULT_HOTEL_SETTINGS, ...(await load('settings.json', {})) };
  if (!settings.hotelsEnabled) { json(503, { error: 'off' }); return true; }
  const city = String(url.searchParams.get('city') || '').replace(/[^\p{L}\p{N} ,.'-]/gu, '').trim().slice(0, 60);
  if (city.length < 2) { json(400, { error: 'no_city' }); return true; }

  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { perVisitor.clear(); googleToday = 0; day = today; }
  const who = visitor(ip), used = perVisitor.get(who) || 0;
  if (used >= settings.hotelsDailyPerVisitor) { json(429, { error: 'daily_limit' }); return true; }
  perVisitor.set(who, used + 1);

  // 1 + 2: OpenStreetMap and websites, cached per city.
  const file = `hotels-cache-${key(city).slice(0, 60)}.json`;
  let cached = await load(file, null);
  if (!cached || Date.now() - cached.at > CACHE_DAYS * DAY) {
    try {
      const place = await geocode(city);
      if (!place) { json(404, { error: 'city_not_found' }); return true; }
      // A small town has few hotels in 6 km: look wider before giving up.
      const find = async r => (await nearby(dataDir, place.lat, place.lon, r)) ?? overpass(place.lat, place.lon, r);
      let els = await find(6000);
      if (els.length < 10) els = await find(15000);
      const hotels = els.map(el => fromOsm(el, place)).filter(h => h.name);
      await phonesFromWebsites(hotels);
      cached = { at: Date.now(), place, hotels };
      if (hotels.length) await save(file, cached); // never keep an empty answer for 30 days
    } catch (e) {
      console.error('hotels osm', e.message);
      if (!cached) cached = { at: 0, place: null, hotels: [] };
    }
  }

  // 3: Google, live and within the daily cap.
  let googleHotels = [], googleNote = '';
  if (env.GOOGLE_PLACES_KEY && googleToday < settings.googleDailyLimit) {
    try { googleToday += 1; googleHotels = await google(cached.place?.name || city, env.GOOGLE_PLACES_KEY); } catch (e) { googleNote = 'google_failed'; console.error('hotels google', e.message); }
  } else if (env.GOOGLE_PLACES_KEY) googleNote = 'google_daily_cap';

  // Owner's checked hotels for this city first, then Google, then OpenStreetMap (same hotel once).
  const directory = ((await load('directory.json', { hotels: [] })).hotels || [])
    .filter(h => [h.district, h.address1, h.address2, h.name].some(v => up(v).includes(up(city))))
    .map(h => ({ ...h, name: up(h.name), source: 'checked' }));
  const seen = new Set(), list = [];
  for (const h of [...directory, ...googleHotels, ...cached.hotels]) {
    const k = key(h.name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    list.push(h);
  }
  list.sort((a, b) => (a.source === 'checked' ? -1 : 0) - (b.source === 'checked' ? -1 : 0) || (!!b.phone - !!a.phone));

  const month = today.slice(0, 7), statsFile = `hotels-${month}.json`;
  const stats = await load(statsFile, { month, searches: 0, google: 0 });
  stats.searches += 1; if (googleHotels.length) stats.google += 1;
  await save(statsFile, stats);

  const shown = list.slice(0, 40);
  json(200, { city: cached.place?.name || city, hotels: shown, withPhone: shown.filter(h => h.phone).length, google: !!googleHotels.length, note: googleNote });
  return true;
}
