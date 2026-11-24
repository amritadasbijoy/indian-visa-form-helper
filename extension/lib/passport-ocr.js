// Offline passport scan: OCR with the bundled Tesseract. The MRZ gives the reliable fields (passport no.,
// dates, sex) once its lines are read one at a time and checked with their check digits; the printed text
// gives names, NID, issue date, place of birth, issuing office and the emergency-contact page.
import { fileToCanvases } from './image-tools.js';
import { bestLine2, checkDigit, parseMrz, splitMrzNames } from './mrz.js';

let workerPromise;
function worker() {
  if (!workerPromise) {
    const base = chrome.runtime.getURL('lib/tesseract/');
    workerPromise = globalThis.Tesseract.createWorker('eng', 1, {
      workerPath: base + 'worker.min.js',
      corePath: base,
      langPath: base + 'lang',
      workerBlobURL: false,
      gzip: true,
    });
  }
  return workerPromise;
}

const MRZ_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
// The 64 districts (with common old/new spellings), used to pick the place of birth out of noisy lines.
const DISTRICTS = ['BAGERHAT', 'BANDARBAN', 'BARGUNA', 'BARISAL', 'BARISHAL', 'BHOLA', 'BOGRA', 'BOGURA', 'BRAHMANBARIA', 'CHANDPUR', 'CHAPAINAWABGANJ', 'CHAPAI NAWABGANJ', 'CHITTAGONG', 'CHATTOGRAM', 'CHUADANGA', 'COMILLA', 'CUMILLA', "COX'S BAZAR", 'COXS BAZAR', 'COX BAZAR', 'DHAKA', 'DINAJPUR', 'FARIDPUR', 'FENI', 'GAIBANDHA', 'GAZIPUR', 'GOPALGANJ', 'HABIGANJ', 'JAMALPUR', 'JESSORE', 'JASHORE', 'JHALOKATI', 'JHALOKATHI', 'JHENAIDAH', 'JOYPURHAT', 'KHAGRACHHARI', 'KHAGRACHARI', 'KHULNA', 'KISHOREGANJ', 'KURIGRAM', 'KUSHTIA', 'LAKSHMIPUR', 'LAXMIPUR', 'LALMONIRHAT', 'MADARIPUR', 'MAGURA', 'MANIKGANJ', 'MEHERPUR', 'MOULVIBAZAR', 'MAULVIBAZAR', 'MUNSHIGANJ', 'MYMENSINGH', 'NAOGAON', 'NARAIL', 'NARAYANGANJ', 'NARSINGDI', 'NATORE', 'NETROKONA', 'NETRAKONA', 'NILPHAMARI', 'NOAKHALI', 'PABNA', 'PANCHAGARH', 'PATUAKHALI', 'PIROJPUR', 'RAJBARI', 'RAJSHAHI', 'RANGAMATI', 'RANGPUR', 'SATKHIRA', 'SHARIATPUR', 'SHERPUR', 'SIRAJGANJ', 'SUNAMGANJ', 'SYLHET', 'TANGAIL', 'THAKURGAON'];

// Rows of dark text in the lower part of the page, found from a horizontal ink profile.
function textRows(page, fromRatio = 0.5) {
  const top = Math.floor(page.height * fromRatio), H = page.height - top, W = page.width;
  const d = page.getContext('2d').getImageData(0, top, W, H).data;
  const ink = new Array(H).fill(0);
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) { sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++; }
  const dark = (sum / n) * 0.55; // well below the page's average brightness
  for (let y = 0; y < H; y++) {
    let c = 0;
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4;
      if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < dark) c++;
    }
    ink[y] = c;
  }
  const th = Math.max(...ink) * 0.22;
  const rows = [];
  let s = -1;
  for (let y = 0; y <= H; y++) {
    const on = y < H && ink[y] > th;
    if (on && s < 0) s = y;
    if (!on && s >= 0) { if (y - s >= 8) rows.push([s + top, y + top]); s = -1; }
  }
  return rows;
}

function cropRow(page, [a, b], scale = 2) {
  const pad = Math.round((b - a) * 0.35);
  const y = Math.max(0, a - pad), h = Math.min(page.height, b + pad) - y;
  const c = document.createElement('canvas');
  c.width = page.width * scale;
  c.height = h * scale;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(page, 0, y, page.width, h, 0, 0, c.width, c.height);
  return c;
}

function crop(page, top, bottom) {
  const c = document.createElement('canvas');
  c.width = page.width;
  c.height = Math.floor(page.height * (bottom - top));
  c.getContext('2d').drawImage(page, 0, page.height * top, page.width, c.height, 0, 0, c.width, c.height);
  return c;
}

// Black text on white: the darkest `share` of the pixels (the ink) become black, the rest white.
function inkOnly(canvas, share) {
  const g = canvas.getContext('2d');
  const img = g.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) hist[(d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0]++;
  let level = 0;
  for (let acc = 0, want = (d.length / 4) * share; level < 255 && (acc += hist[level]) < want; level++);
  for (let i = 0; i < d.length; i += 4) {
    const v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 <= level ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

// Reads rows from the bottom up, one line at a time, until a valid line 2 and the line above it are found.
async function readMrz(page, w) {
  await w.setParameters({ tessedit_char_whitelist: MRZ_CHARS, tessedit_pageseg_mode: '7' });
  const rows = textRows(page).reverse().slice(0, 8);
  const read = [];
  for (let k = 0; k < rows.length; k++) {
    const text = (await w.recognize(cropRow(page, rows[k]))).data.text.trim();
    read.push(text);
    const line2 = bestLine2(text);
    if (line2) {
      const above = k + 1 < rows.length ? (await w.recognize(cropRow(page, rows[k + 1]))).data.text.trim() : '';
      return { line1: above.replace(/[^A-Z0-9<]/gi, '').toUpperCase(), line2 };
    }
  }
  // Fallback: the whole bottom band in block mode.
  await w.setParameters({ tessedit_pageseg_mode: '6' });
  const band = (await w.recognize(crop(page, 0.7, 1))).data.text.split('\n');
  for (let k = band.length - 1; k >= 0; k--) {
    const line2 = bestLine2(band[k]);
    if (line2) return { line1: (band[k - 1] || '').replace(/[^A-Z0-9<]/gi, '').toUpperCase(), line2 };
  }
  return null;
}

export async function scanPassport(file, onProgress = () => {}) {
  onProgress('render');
  const [page] = await fileToCanvases(file, 2000);
  const w = await worker();

  onProgress('text');
  await w.setParameters({ tessedit_char_whitelist: '', tessedit_pageseg_mode: '3' });
  // Busy security backgrounds make whole-page OCR skip lines; each half on its own reads far better.
  // The bottom half (photo page) comes first so its "Place of Birth" etc. win over the full-page read.
  const parts = [];
  for (const [a, b] of [[0.45, 1], [0, 0.55], [0, 1]]) parts.push((await w.recognize(crop(page, a, b))).data.text);
  let raw = parts.join('\n');
  // Grey or black-and-white copies: the security pattern hides the photo page's text. Keep only the darkest ink
  // (the printed text) and read that half again; its text goes first so its "Place of Birth" etc. win.
  if (!/PLACE\s*OF\s*BI?RTH/i.test(raw)) {
    for (const share of [0.1, 0.13]) {
      const more = (await w.recognize(inkOnly(crop(page, 0.45, 1), share))).data.text;
      if (/PLACE\s*OF\s*BI?RTH/i.test(more)) { raw = more + '\n' + raw; break; }
    }
  }

  onProgress('mrz');
  const lines = await readMrz(page, w);
  if (!lines) throw new Error('mrz-not-found');
  return passportFromText(raw, lines, page);
}

// Server scan (free, ivh.techistbd.com): the OCR on the helper VPS reads the page's text rows (2–3 s, handles
// sideways and upside-down photos); the fields are then taken with the same rules as the scan above.
// The image is sent only for reading and is not kept there.
export const SERVER_OCR_URL = 'https://ivh.techistbd.com/api/ocr';
export async function serverScanPassport(file, onProgress = () => {}) {
  onProgress('render');
  const [page] = await fileToCanvases(file, 2000);
  const blob = await new Promise(r => page.toBlob(r, 'image/jpeg', 0.9));
  onProgress('text');
  let res;
  try {
    res = await fetch(SERVER_OCR_URL, { method: 'POST', body: blob, headers: { 'Content-Type': 'application/octet-stream' }, credentials: 'omit', cache: 'no-store' });
  } catch {
    throw new Error('offline');
  }
  if (res.status === 429) throw new Error('server-scan-limit');
  if (res.status === 503) throw new Error('server-scan-off');
  if (!res.ok) throw new Error('server-scan-failed');
  const { rows = [] } = await res.json();
  // The MRZ: the lowest row that reads as line 2, and the row above it as line 1.
  let lines = null;
  for (let k = rows.length - 1; k >= 0 && !lines; k--) {
    const line2 = bestLine2(rows[k]);
    if (line2) lines = { line1: (rows[k - 1] || '').replace(/[^A-Z0-9<]/gi, '').toUpperCase(), line2 };
  }
  if (!lines) throw new Error('mrz-not-found');
  return passportFromText(rows.join('\n'), lines, page);
}

// Fields from the page text and the two MRZ lines (shared by both scans).
function passportFromText(raw, lines, page) {
  const text = raw.toUpperCase();
  // Printed words only: the page OCR also reads the MRZ lines, whose misreads ("SRINA") must not anchor names.
  const words = text.split('\n').filter(l => !/[<«]|[A-Z0-9]{25,}/.test(l)).join(' ').match(/[A-Z]{2,}/g) || [];

  const mrz = parseMrz('', lines.line2);
  // Line 1: "P<BGD" + names. Cut at the country code from line 2 when it is visible.
  const l1 = lines.line1;
  const at = l1.indexOf(mrz.nationality);
  const nameField = at >= 0 && at < 8 ? l1.slice(at + mrz.nationality.length) : l1.replace(/^P.?.{3}/, '');
  const names = splitMrzNames(nameField, words);
  // The printed "Surname" / "Given Name(s)" lines (value on the next line) are complete and read more reliably than
  // MRZ line 1; use them when MRZ line 1 confirms them (its letters start the same way).
  // Stray marks around the value ('" SAHA', "MD KARIM.", "DAS SN") are dropped; a real name never ends in a
  // one- or two-letter word.
  const printed = re => { const v = (re.exec(text)?.[1] || '').replace(/\s+/g, ' ').replace(/^[^A-Z]+/, '').replace(/[\s.,]+$/, '').replace(/(\s[A-Z]{1,2})+$/, '').trim(); return /^[A-Z][A-Z .'-]{1,40}$/.test(v) ? v : ''; };
  const mrzLetters = l1.replace(/[^A-Z]/g, '');
  // Confirmed: the printed letters appear in order in MRZ line 1, allowing one letter the OCR dropped ("RINA" ~ "RNA").
  const inOrder = w => { let k = 0; for (const ch of mrzLetters) if (ch === w[k]) k++; return k === w.length; };
  const confirmed = v => {
    const want = v.replace(/[^A-Z]/g, '');
    if (want.length < 2) return false;
    return inOrder(want) || (want.length > 3 && [...want].some((_, i) => inOrder(want.slice(0, i) + want.slice(i + 1))));
  };
  // Labels may carry Bangla or slashes in front ("/Surname", "/GivenName") and OCR typos ("Suname", "Sutame",
  // "Givens Name").
  const pSurname = printed(/(?:^|\n)[^\n]*?\bS[UV]\w{0,3}?[NM]?AME\b[^\n]*\n([^\n]+)/), pGiven = printed(/(?:^|\n)[^\n]*?GIVEN\w?\s*NAMES?[^\n]*\n([^\n]+)/);
  // Same letters as the MRZ name (OCR dropped the space: "RINARANI"): keep the MRZ version with its spaces.
  const sameLetters = (a, b) => a.replace(/[^A-Z]/g, '') === (b || '').replace(/[^A-Z]/g, '');
  if (confirmed(pSurname) && !sameLetters(pSurname, names.surname)) names.surname = pSurname;
  if (confirmed(pGiven) && !sameLetters(pGiven, names.givenName)) names.givenName = pGiven;

  const profile = {
    surname: names.surname,
    givenName: names.givenName,
    gender: mrz.gender,
    dob: mrz.dob,
    passportNo: mrz.passportNo,
    passportExpiry: mrz.passportExpiry,
  };
  const warnings = mrz.warnings.filter(x => x !== 'name line unreadable' && x !== 'passport number check failed');
  // A finger or glare often hides the first letter of line 2. Try every letter: prefer one printed on the page,
  // then the usual Bangladesh series (A, B, E…). Several letters share a check digit, so ask for a check.
  if (mrz.warnings.includes('passport number check failed')) {
    const digitsPart = lines.line2.slice(1, 9), check = lines.line2[9];
    const printed = text.match(/\b[A-Z]{1,2}\d{7,8}\b/g) || [];
    const ok = [...'ABEKUCDFGHIJLMNOPQRSTVWXYZ'].map(ch => ch + digitsPart).filter(n => checkDigit(n) === check);
    const pick = ok.find(n => printed.includes(n)) || ok[0];
    if (pick) { profile.passportNo = pick; warnings.push('check the passport number (first letter was unclear)'); }
    else warnings.push('passport number check failed — compare with the passport');
  }
  // Cut-off scans can lose the number's first letter, and a missing letter can still pass the check digit ('<' and
  // 'A' weigh the same). Bangladesh numbers start with letters: take them from the printed number.
  if (/^\d/.test(profile.passportNo)) {
    // The number has 9 characters: as many letters as digits are missing, printed as their own word ("A12345679").
    const letters = Math.max(1, 9 - profile.passportNo.length);
    const full = (text.match(new RegExp(`\\b[A-Z]{${letters}}\\s?${profile.passportNo}\\b`)) || [])[0];
    if (full) profile.passportNo = full.replace(/\s/g, '');
    else warnings.push('check the passport number (first letter was not read)');
  }
  if (!names.surname) warnings.push('name not read — type it in');

  // Bangladesh e-passports print the NID as "Personal No.", but the MRZ keeps only its last 14 digits
  // (19905612345678901 → 05612345678901, example). Use the full printed number that ends with the MRZ digits.
  const pn = mrz.personalNumber || '';
  // Printed lines only: the page OCR also reads MRZ line 2, where expiry and check digits run into the number.
  // Digit groups split by a space ("202415916031 53056") are joined.
  const printedText = text.split('\n').filter(l => !/[<«]|[A-Z0-9]{25,}/.test(l)).join('\n').replace(/(\d)[ \t]+(?=\d)/g, '$1');
  const nid = [...printedText.matchAll(/\d{10,17}/g)].map(m => m[0]).find(d => [10, 13, 17].includes(d.length) && pn && d.endsWith(pn.slice(-8)));
  if (nid) profile.nationalId = nid;
  else if (pn.length === 10 || pn.length === 13) profile.nationalId = pn;

  // Printed dates look like "05 JUL 2026"; the one that is neither birth nor expiry is the issue date.
  // OCR may read a zero as the letter O ("O5JUL2026").
  const num = v => v.replace(/O/g, '0');
  const dates = [...text.matchAll(/([\dO]\d|\d[\dO])\s*([A-Z]{3})[A-Z]*\s*([12][\dO]{3})/g)]
    .filter(m => MONTHS[m[2]])
    .map(m => `${num(m[3])}-${MONTHS[m[2]]}-${num(m[1])}`);
  const issue = dates.find(d => d !== mrz.dob && d !== mrz.passportExpiry && d > mrz.dob);
  if (issue) profile.passportIssueDate = issue;
  // Month misread ("1200T2025" for 12 OCT 2025): passports run 5 or 10 years less a day, so the issue date is the
  // expiry date moved back. Accept it when its day and year are printed together.
  else if (mrz.passportExpiry) {
    const [y, m, d] = mrz.passportExpiry.split('-').map(Number);
    for (const years of [10, 5]) {
      const dt = new Date(Date.UTC(y - years, m - 1, d + 1)).toISOString().slice(0, 10);
      const [iy, , id] = dt.split('-');
      if (dt > mrz.dob && new RegExp(`${id}\\s*[A-Z0-9]{3}\\s*${iy}`).test(text)) { profile.passportIssueDate = dt; break; }
    }
  }

  // The value line under "Place of Birth" also holds the sex letter and a control number: "F COMILLA 123456" (example).
  const pob = /PLACE\s*OF\s*BI?RTH[^\n]*\n([^\n]+)/.exec(text);
  if (pob) {
    const line = pob[1].replace(/^[^A-Z]*[MFX]\s+/, '').replace(/\d+/g, '').replace(/[^A-Z' .-]/g, ' ');
    const flat = line.replace(/[^A-Z]/g, '');
    // Prefer a known district on that line; otherwise take the first word.
    const district = DISTRICTS.find(d => flat.includes(d.replace(/[^A-Z]/g, '')));
    const place = district || line.trim().split(/\s+/)[0];
    if (place && place.length > 2) profile.birthPlace = place;
  }
  // Label and value read on one line (tilted photo): a known district shortly after "Place of Birth".
  if (!profile.birthPlace) {
    const at = text.search(/PLACE\s*OF\s*BI?RTH/);
    const near = at >= 0 ? text.slice(at, at + 160).replace(/[^A-Z]/g, '') : '';
    const district = DISTRICTS.find(d => near.includes(d.replace(/[^A-Z]/g, '')));
    if (district) profile.birthPlace = district;
  }
  // Labels too blurred to read: the place of birth is printed on the same line as the date of birth ("14 MAR 1990 F COMILLA").
  if (!profile.birthPlace && mrz.dob) {
    const [y, m, d] = mrz.dob.split('-');
    const dob = d + Object.keys(MONTHS).find(k => MONTHS[k] === m) + y;
    const line = text.split('\n').find(l => l.replace(/\s/g, '').includes(dob));
    const flat = (line || '').replace(/[^A-Z]/g, '');
    const district = line && DISTRICTS.find(dd => flat.includes(dd.replace(/[^A-Z]/g, '')));
    if (district) profile.birthPlace = district;
  }
  // Bangladesh passports are all issued by DIP/DHAKA (owner's rule): never read the place, so a misread can't change it.
  profile.passportIssuePlace = 'DHAKA';

  // When the scan includes the facing "Personal data and emergency contact" page, take family and address too.
  Object.assign(profile, emergencyPage(raw));
  // Place of birth not read: use the district of the permanent address (owner's rule).
  if (!profile.birthPlace && profile.presDistrict) profile.birthPlace = profile.presDistrict;

  return { profile, warnings, mrzLines: [lines.line1, lines.line2], pageImage: page ? page.toDataURL('image/jpeg', 0.85) : '' };
}

// For dev checks (tools/test-passport-rows.mjs).
export const _forTests = { passportFromText };

// OCR sometimes drops the space before a family name ("SUBHASHDAS", example): put it back for common surnames.
const SURNAMES = ['CHOWDHURY', 'CHOWDHURI', 'HOSSAIN', 'HOSSEN', 'KHATUN', 'BEGUM', 'AKTER', 'AKHTER', 'ISLAM', 'RAHMAN', 'AHMED', 'UDDIN', 'MIAH', 'MOLLA', 'SARKAR', 'MONDAL', 'BISWAS', 'GHOSH', 'SAHA', 'ROY', 'DAS', 'DEY', 'PAUL', 'NATH', 'KHAN', 'SHEIKH', 'BARUA'];
// Common middle names, split off the same way ("GITARANI" → "GITA RANI", "RINARANIDAS" → "RINA RANI DAS").
// Only parts that are rarely the end of a longer name: not LAL (MOTILAL) or RANJAN (SUBHARANJAN), for example.
const MIDDLE = ['CHANDRA', 'KUMAR', 'KUMARI', 'RANI', 'BALA'];
function spaceSurname(name) {
  const split = w => {
    if (w.length < 6) return w;
    const s = [...SURNAMES, ...MIDDLE].find(x => w.endsWith(x) && w.length - x.length >= 3);
    return s ? split(w.slice(0, -s.length)) + ' ' + s : w;
  };
  return name.split(' ').map(split).join(' ');
}

export function emergencyPage(raw) {
  // OCR reads a capital I as "!" or "]" inside words ("URM!", "MISTR] BARI").
  const text = raw.toUpperCase().replace(/(?<=[A-Z])[!\]](?=[\sA-Z,.]|$)/gm, 'I');
  const out = {};
  // Values sit on the same line as their label; labels themselves are often misread, so match loosely.
  const field = re => (re.exec(text)?.[1] || '').replace(/\s+/g, ' ').trim();
  // "Name" is often misread ("Namo", "Narne"): any N + 2–3 letters.
  // Lazy "'S" so a label written together with the value ("FATHER'SNAME: SUBHASH") does not eat the name.
  // Label and value on one line only ([ \t]): "MOTHER" + "NEZAME…" on the next line is not "Mother's Name".
  const mother = field(/MOTHER\S*?[ \t]*N\w{2,3}[ \t]*[:;.]?[ \t]*([A-Z][A-Z .]{2,40})/);
  let father = field(/F\w{1,3}HER\S*?[ \t]*N\w{2,3}[ \t]*[:;.]?[ \t]*([A-Z][A-Z .]{2,40})/);
  // The emergency contact is usually the father: "Name: X … Relationship: FATHER".
  if (!father) {
    const ec = /NAME[ \t]*[:;][ \t]*([A-Z][A-Z .]{2,40})\n(?:[^\n]{0,4}\n)?[^\n]*RELATIONSHIP[ \t]*[:;]?[ \t]*FATHER/.exec(text);
    if (ec) father = ec[1].trim();
  }
  // Drop short trailing scraps that appear nowhere else on the page ("ROKEYA BEGUM STD" → "ROKEYA BEGUM", example).
  const tidy = name => {
    const parts = name.split(' ');
    // One or two letters at the end are always noise ("HOSSAIN SM"); three only when the word is nowhere else.
    const once = w => (text.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length <= 1;
    while (parts.length > 2 && (parts[parts.length - 1].length <= 2 || (parts[parts.length - 1].length <= 3 && once(parts[parts.length - 1])))) parts.pop();
    return parts.join(' ');
  };
  // Mother's label lost: her name is then a line of its own right after the father's line.
  let motherName = mother;
  if (!motherName && father) {
    const rows = text.split('\n');
    const i = rows.findIndex(r => r.includes(father));
    const next = (rows[i + 1] || '').trim();
    if (i >= 0 && /^[A-Z][A-Z .]{4,40}$/.test(next) && !/GUARDIAN|ADDRESS|CONTACT/.test(next)) motherName = next;
  }
  // The spouse is printed on the same page ("Spouse's Name: …"): the applicant is married.
  let spouse = field(/SPOUSE\S*?[ \t]*N\w{2,3}[ \t]*[:;.]?[ \t]*([A-Z][A-Z .]{2,40})/);
  // No spouse line, but the emergency contact is the husband or wife: "Name: X … Relationship: SPOUSE".
  if (!spouse) spouse = (/NAME[ \t]*[:;][ \t]*([A-Z][A-Z .]{2,40})\n(?:[^\n]{0,4}\n)?[^\n]*RELATIONSHIP[ \t]*[:;]?[ \t]*(?:SPOUSE|HUSBAND|WIFE)\b/.exec(text)?.[1] || '').trim();
  if (father) out.fatherName = spaceSurname(tidy(father));
  if (motherName) out.motherName = spaceSurname(tidy(motherName));
  if (spouse) { out.spouseName = spaceSurname(tidy(spouse)); out.maritalStatus = 'MARRIED'; }

  // "EAST PARA, WARD NO - 03, SADAR, SADAR -" with "3500, COMILLA" on a following line (example).
  // Trailing scraps after the wrap dash ("SADAR - PT", "SADAR - —") are background noise.
  // Label misreads ("PERMANENR ADDRESS", "PEMANENT ADDRESS"); without it, the emergency contact's address (usually the same home).
  // The address runs over up to three lines; the next lines belong to it until another label starts.
  const block = re => {
    const m = re.exec(text);
    if (!m) return '';
    const more = text.slice(m.index + m[0].length).split('\n').slice(1, 3);
    const lines = [m[1]];
    for (const l of more.map(x => x.trim())) {
      // Only clean address text (letters, digits, commas, dashes): OCR noise from the background stops it.
      if (!/[A-Z]{3}/.test(l) || !/^[A-Z0-9 ,.'/-]+$/.test(l) || /EMERGENCY|CONTACT|NAME|RELATION|TELEPHONE|ADDRESS|PASSPORT|REPUBLIC/.test(l)) break;
      lines.push(l);
    }
    // Each line: trailing scraps after a wrap dash ("SADAR - A") or stray letters ("COMILLA MN") are noise.
    const clean = l => l.replace(/\s\S*[^A-Z0-9,.'\/\s-]\S*/g, '').replace(/\s*[-–—]\s*[A-Z]{0,3}[\s\-–—]*$/, '').replace(/[\s\-–—]+$/, '').replace(/(\s[A-Z]{1,2})+$/, '');
    // A line ending in a comma starts a new part; otherwise a word wrapped onto the next line ("KALIR" / "BAZAR").
    return lines.map(l => clean(l) || l).reduce((a, l) => (a ? a + (/[A-Z]$/.test(a) && /^[A-Z]/.test(l) ? ' ' : ', ') + l : l), '')
      .replace(/\s+/g, ' ').trim();
  };
  const tidyAddr = a => a
    .replace(/([A-Z]) ?(?=WARD[-.\s]*(?:NO)?[-.\s]*\d)/g, '$1, ') // "PARAWARD-03", "PARA WARD-03" → "PARA, WARD-03"
    .replace(/([A-Z])(\d{4})\b/g, '$1 - $2'); // "BAZAR3500" → "BAZAR - 3500"
  // The value starts with a letter or digit, so a label line with nothing after it ("PERMANENT ADDRESS:") is skipped.
  // Labels as OCR reads them: "PERMANENT", "PEMANENT", "PRMANENT"; "ADDRESS:", "ADDRESS," or "ADRESS." (a few marks may come first).
  const emergencyAddr = tidyAddr(block(/(?:^|\n)[^A-Z\n]{0,6}ADD?R?E\w{1,3}\b[ \t]*[:;!,.]?[ \t]*([A-Z0-9][^\n]+)/));
  let addr = (tidyAddr(block(/P\w{0,2}?R?MA?N\w{2,4}\s*ADD?R?E\w{1,3}\b[ \t]*[:;!,.]?[ \t]*([A-Z0-9][^\n]+)/)) || emergencyAddr).replace(/\s*[-–—]\s*[A-Z]{0,3}[\s\-–—]*$/, '').replace(/[\s\-–—]+$/, '');
  if (addr) {
    // OCR glitches: "WARDNO-O1" → "WARD NO-01", a word read twice without a gap ("SADARSADAR" → "SADAR").
    addr = addr.replace(/WARD\s*NO[-\s]*([O0]?)(\d)/g, (m, z, d) => `WARD NO-${z ? '0' : ''}${d}`).replace(/WARD\s*NO/g, 'WARD NO').replace(/-O(\d)/g, '-0$1').replace(/\b([A-Z]{3,})\1\b/g, '$1')
      // A full stop read for a comma ("NO-01.SADAR"); the same place twice without its comma ("SADAR SADAR").
      .replace(/([A-Z0-9])\.(?=[A-Z])/g, '$1,').replace(/\b([A-Z]{3,}) \1\b/g, '$1, $1').replace(/,(?=\S)/g, ', ');
    // The district after the postcode is often on the next line: "SADAR - 3500," / "COMILLA" (example).
    const tail = /(\d{4})\s*,\s*([A-Z]{3,})/.exec(text);
    if (tail && !/\d{4}/.test(addr)) addr = addr + ' - ' + tail[1] + ', ' + tail[2];
    const postal = (addr.match(/\b(\d{4})\b/) || [])[1];
    // The emergency contact's address often has the same parts with better spaces ("KARIM MIA BARI").
    const spaced = emergencyAddr.split(',').map(x => x.replace(/\s*-\s*\d{4}/, '').trim()).filter(Boolean);
    const respace = v => spaced.find(x => x.replace(/\s/g, '') === v.replace(/\s/g, '') && x.split(' ').length > v.split(' ').length) || v;
    const parts = addr.replace(/\s*-\s*\d{4}/, '').split(',').map(s => respace(s.replace(/[\s-]+$/, '').trim())).filter(p => p && !/^\d{4}$/.test(p));
    let district = parts.pop();
    // The district may sit alone on the next line ("SADAR - 3500," / "COMILLA", example): when the last part
    // is not a district, use a line that is just a district name.
    const known = v => DISTRICTS.find(d => d.replace(/[^A-Z]/g, '') === String(v || '').replace(/[^A-Z]/g, ''));
    if (!known(district)) {
      const own = text.slice(Math.max(0, text.search(/ADD?RE\w{1,3}/))).split('\n').map(l => known(l.replace(/[^A-Z ]/g, ' ').trim())).find(Boolean);
      if (own) { parts.push(district); district = own; }
    }
    const uniq = parts.filter((p, i) => parts.indexOf(p) === i);
    if (uniq.length === 1) {
      // No commas read: split the one long line at the 35-character box size instead of repeating it.
      out.presAdd1 = uniq[0].slice(0, 35).trim();
      out.presAdd2 = uniq[0].slice(35, 70).trim();
    } else {
      // Each box holds 35 characters: first two parts in line 1, the rest in line 2. When line 2 is too long,
      // leave out the ward number, then the first parts, so the place names near the post office stay.
      let first = uniq.slice(0, 2), rest = uniq.slice(2);
      if (first.join(', ').length > 35) { rest = [first[1], ...rest]; first = [first[0]]; }
      const fit = list => list.join(', ').length <= 35;
      if (!fit(rest)) rest = rest.filter(x => !/^WARD/.test(x));
      while (rest.length > 1 && !fit(rest)) rest.shift();
      out.presAdd1 = first.join(', ').slice(0, 35);
      out.presAdd2 = rest.join(', ').slice(0, 35) || uniq[uniq.length - 1];
    }
    out.presDistrict = district;
    if (postal) out.presPostal = postal;
    out.permSame = true;
  }
  const phone = (/\+?880\s*1\d{9}/.exec(text.replace(/(\d)\s+(?=\d)/g, '$1'))?.[0] || '').replace(/\s/g, '');
  if (phone) {
    out.phone = phone.replace(/^\+?880/, '0');
    out.mobile = phone.replace(/^\+?880/, '');
  }
  return out;
}
