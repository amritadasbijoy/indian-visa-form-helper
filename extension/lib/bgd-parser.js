// Turns the text lines of a printed BGD visa application (see pdf-lines.js) into a profile,
// plus the hotel and both references it contains. Works on the layout the site prints (2026).

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const isoDate = s => {
  const m = /(\d{1,2})-([A-Z]{3})-(\d{4})/i.exec(s || '');
  if (!m) return '';
  const mon = MONTHS.indexOf(m[2].toUpperCase()) + 1;
  return mon ? `${m[3]}-${String(mon).padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
};
const NA = v => (!v || /^not applicable$|^na$|^\.?$/i.test(v.trim()) ? '' : v.trim());
const COUNTRY = { BANGLADESH: 'BGD', INDIA: 'IND', NEPAL: 'NPL', BHUTAN: 'BTN', PAKISTAN: 'PAK', 'SRI LANKA': 'LKA', MYANMAR: 'MMR' };
const code = name => COUNTRY[(name || '').trim().toUpperCase()] || 'BGD';
const STATES = ['WEST BENGAL', 'TAMIL NADU', 'KARNATAKA', 'DELHI', 'MAHARASHTRA', 'TELANGANA', 'ASSAM', 'TRIPURA', 'MEGHALAYA', 'KERALA', 'UTTAR PRADESH', 'ANDHRA PRADESH', 'BIHAR', 'ORISSA', 'PUNJAB', 'HARYANA', 'GUJARAT', 'RAJASTHAN', 'SIKKIM', 'JHARKHAND'];

export function parseBgd(lines) {
  const texts = lines.map(l => l.cells.map(c => c.s).join(' '));
  const all = texts.join('\n');
  if (!/Visa Application Form|Application Id/i.test(all)) throw new Error('This does not look like a BGD visa application PDF.');

  const idx = re => lines.findIndex(l => re.test(l.cells[0]?.s || ''));
  // Value cell to the right of a label cell anywhere in the document.
  const after = (re, from = 0) => {
    for (let i = from; i < lines.length; i++) {
      const cells = lines[i].cells;
      const k = cells.findIndex(c => re.test(c.s));
      if (k >= 0) return cells[k + 1]?.s || '';
    }
    return '';
  };
  // Cells inside an x-range between two line indexes (multi-line address columns).
  const column = (start, end, x0, x1) => {
    const out = [];
    for (let i = start; i < end && i < lines.length; i++) {
      for (const c of lines[i].cells) if (c.x >= x0 && c.x < x1) out.push(c.s);
    }
    return out;
  };

  const p = {};
  p.applicationId = (/Application Id\s*:\s*([A-Z0-9]+)/i.exec(all) || [])[1] || '';
  p.mission = (/HIGH COMMISSION OF INDIA\s*\n?\s*([A-Z]+)/i.exec(all) || [])[1] || '';
  p.surname = after(/^Surname/);
  p.givenName = after(/^Given Name/);
  const prev = NA(after(/^Previous\/other Name/));
  if (prev) { p.changedName = true; p.prevGivenName = prev; }
  p.gender = { MALE: 'M', FEMALE: 'F', TRANSGENDER: 'X' }[after(/^Gender$/).toUpperCase()] || '';
  p.maritalStatus = /MARRIED/i.test(after(/^Marital Status$/)) ? 'MARRIED' : 'SINGLE';
  p.dob = isoDate(after(/^Date of Birth$/));
  p.religion = after(/^Religion$/).toUpperCase();
  p.birthPlace = after(/^Place of Birth/);
  p.birthCountry = code(after(/^Country of Birth/));
  p.nationalId = NA(after(/National ID/)) || 'NA';
  p.education = after(/^Educational Qualification/).toUpperCase();
  p.identMarks = after(/^Visible identification/) || 'NO';
  p.nationalityBy = /NATURAL/i.test(after(/^Naturalization$/)) ? 'NATURALIZATION' : 'BY BIRTH';

  p.passportNo = after(/^Passport No\.$/);
  p.passportIssueDate = isoDate(after(/^Date of Issue \(/));
  p.passportIssuePlace = after(/^Place of Issue$/) || 'DHAKA';
  p.passportExpiry = isoDate(after(/^Date of Expiry/));
  p.otherPassport = /YES/i.test(after(/^Any other Passport/));

  // Contact: address lines sit in the column right of the labels, phone/mobile/email to the far right.
  const pres = idx(/^Present$/), perm = idx(/^Permanent$/), fam = idx(/^D\. Family/);
  const presX = lines[pres]?.cells[1]?.x ?? 133;
  const rightX = (lines[pres]?.cells.find(c => /Phone/i.test(c.s))?.x ?? 275) - 5;
  const presLines = column(pres, perm, presX - 5, rightX);
  const permLines = column(perm, fam, presX - 5, rightX);
  p.phone = after(/^Phone No$/);
  p.mobile = after(/^Mobile/).replace(/^880?0?/, '').replace(/^88/, '');
  if (p.mobile && !p.mobile.startsWith('1') && p.mobile.length > 10) p.mobile = p.mobile.slice(-10);
  p.email = after(/^Email address$/).toLowerCase();
  Object.assign(p, splitBdAddress(presLines));
  const permAddr = splitBdAddress(permLines);
  p.permSame = permAddr.presAdd1 === p.presAdd1 && permAddr.presDistrict === p.presDistrict;
  if (!p.permSame) Object.assign(p, { permAdd1: permAddr.presAdd1, permAdd2: permAddr.presAdd2, permAdd3: permAddr.presDistrict });

  // Family table: Name | Nationality | Prev. Nationality | Place/Country of Birth (place sits on the line above).
  for (const [key, re] of [['father', /^Father/], ['mother', /^Mother/], ['spouse', /^Spouse|^Husband|^Wife/]]) {
    const i = idx(re);
    if (i < 0) continue;
    const c = lines[i].cells;
    p[key + 'Name'] = c[1]?.s || '';
    p[key + 'Nationality'] = code(c[2]?.s);
    p[key + 'PrevNationality'] = code(c[3]?.s || c[2]?.s);
    p[key + 'BirthCountry'] = code(c[4]?.s);
    const placeLine = [lines[i - 1], lines[i + 1]].find(l => l && l.cells.length && l.cells[l.cells.length - 1].x >= (c[4]?.x ?? 435) - 5 && !/^[A-Z]\./.test(l.cells[0].s));
    p[key + 'BirthPlace'] = placeLine ? placeLine.cells[placeLine.cells.length - 1].s : '';
  }
  p.pakAncestry = /Pakistan[^\n]*:\s*YES/i.test(all);

  // Previous visits / refusal.
  p.visitedBefore = /YES/i.test(after(/^Have You Ever visited India/i));
  if (p.visitedBefore) {
    p.prevCities = after(/^Cities in India Visited/);
    p.prevVisaNo = after(/^Visa Number/);
    p.prevVisaPlace = after(/^Visa Issued Place/);
  }
  p.countriesVisited = NA(after(/^Countries visited in last 10 years/));
  p.refused = /YES/i.test(after(/^Have you been refused/));

  // Occupation: "G. Profession/Occupation Details : of Father" means the employment block is the father's.
  const occHead = texts.find(x => /^G\. Profession/.test(x)) || '';
  const of = /of (Father|Mother|Spouse)/i.exec(occHead)?.[1];
  p.occupation = after(/^Present Occupation$/).toUpperCase();
  if (of) p.occOf = of[0].toUpperCase();
  p.empDesignation = after(/^Designation\/Rank$/);
  p.empName = after(/^Employer name/);
  const occStart = idx(/^Employer Address/);
  const addr = column(occStart, occStart + 2, 160, 600).filter(s => !/^Phone/.test(s));
  p.empAddress = addr.join(' ');
  p.military = /YES/i.test(after(/^Are\/have you worked with Armed/));

  // Visa sought: useful to pre-fill the start screen.
  const visa = {
    type: after(/^Type Of Visa Required$/),
    entries: after(/^No of Entries$/),
    duration: (after(/^Period of Visa/).match(/\d+/) || [''])[0],
    portIn: after(/^Port Of Arrival$/),
    portOut: after(/^Port of Exit$/),
    places: after(/^Places to be Visited$/),
  };

  // References block: "In India" column and "In <country>" column.
  const ref = idx(/^Name$/);
  const refEnd = idx(/DOCUMENTS UPLOADED/);
  const head = lines[ref - 1]?.cells || [];
  const indX = (lines[ref]?.cells[1]?.x ?? 170) - 5;
  const bdX = (lines[ref]?.cells[2]?.x ?? 300) - 5;
  const indLines = column(ref + 1, refEnd, indX, bdX).filter(s => !/^\+?\d[\d\s-]{6,}$/.test(s));
  const bdLines = column(ref + 1, refEnd, bdX, 9999).filter(s => !/^\+?\d[\d\s-]{6,}$/.test(s));
  const phoneRow = lines.slice(ref, refEnd).find(l => /^Phone Number$/.test(l.cells[0]?.s));
  const refIndia = {
    country: 'IN',
    name: lines[ref]?.cells[1]?.s || '',
    ...indiaAddress(indLines.join(' ')),
    phone: phoneRow?.cells[1]?.s || '',
  };
  const refBd = {
    country: 'BD',
    name: lines[ref]?.cells[2]?.s || '',
    address1: bdLines.join(' ').slice(0, 35),
    address2: bdLines.join(' ').slice(35),
    phone: phoneRow?.cells[2]?.s || '',
  };
  if (!head.length) refBd.name = refBd.name || '';

  // Hotel row: "1 HOTEL NAME ADDRESS ... STATE. +PHONE,"
  const hotelRow = texts.find(x => /^1 \S/.test(x) && texts.indexOf(x) > idx(/^H\. Address of Place/));
  let hotel = null;
  if (hotelRow) {
    const body = hotelRow.replace(/^1\s+/, '').replace(/,\s*$/, '');
    const phone = (body.match(/(\+?\d[\d\s-]{6,})\s*$/) || ['', ''])[1].trim();
    let rest = body.slice(0, body.length - phone.length).replace(/[.,\s]+$/, '');
    const state = STATES.find(s => rest.toUpperCase().endsWith(s)) || '';
    if (state) rest = rest.slice(0, rest.length - state.length).trim();
    const name = refIndia.name && rest.toUpperCase().startsWith(refIndia.name.toUpperCase()) ? refIndia.name : rest.split(/\s+\d/)[0];
    const address = rest.slice(name.length).trim();
    const city = (address.match(/\b(KOLKATA|CHENNAI|VELLORE|BANGALORE|BENGALURU|DELHI|NEW DELHI|MUMBAI|HYDERABAD|SILIGURI|GUWAHATI|AGARTALA)\b/i) || [])[1] || '';
    hotel = { name, ...indiaAddress(address), state: state || refIndia.state, district: districtFor(city) || refIndia.district, phone };
  }

  return { profile: p, visa, hotel, refIndia, refBd };
}

// "MOLLA BARI / EAST PARA, WARD NO - 03, / SADAR / COMILLA, BANGLADESH 3500" (example)
function splitBdAddress(lines) {
  const ls = lines.map(s => s.trim()).filter(Boolean);
  if (!ls.length) return {};
  let last = ls[ls.length - 1];
  const postal = (last.match(/\b(\d{4})\b/) || [])[1] || '';
  last = last.replace(/\b\d{4}\b/, '').replace(/,?\s*BANGLADESH/i, '').replace(/[,\s]+$/, '');
  const district = last;
  const clean = s => s.replace(/,\s*$/, '').trim();
  const body = ls.slice(0, -1).map(clean);
  let add1 = body[0] || '';
  let add2 = body.slice(1).join(', ');
  if (add1.length > 35) { add2 = [add1.slice(35), add2].filter(Boolean).join(', '); add1 = add1.slice(0, 35); }
  return { presAdd1: add1.trim(), presAdd2: add2.slice(0, 35).trim(), presDistrict: district, presPostal: postal };
}

function indiaAddress(text) {
  let t = (text || '').replace(/\s+/g, ' ').trim();
  const state = STATES.find(s => t.toUpperCase().includes(s)) || '';
  if (state) t = t.replace(new RegExp('\\s*' + state + '\\.?', 'i'), '').trim();
  const city = (t.match(/\b(KOLKATA|CHENNAI|VELLORE|BANGALORE|BENGALURU|NEW DELHI|DELHI|MUMBAI|HYDERABAD|SILIGURI|GUWAHATI|AGARTALA)\b/i) || [])[1] || '';
  const [address1, ...rest] = splitWords(t, 35);
  return { address1, address2: rest.join(' '), state, district: districtFor(city) };
}

function districtFor(city) {
  const c = (city || '').toUpperCase();
  return { KOLKATA: 'KOLKATA', SILIGURI: 'DARJILING', CHENNAI: 'CHENNAI', VELLORE: 'VELLORE', BANGALORE: 'BANGALORE', BENGALURU: 'BANGALORE', 'NEW DELHI': 'NEW DELHI', DELHI: 'NEW DELHI', MUMBAI: 'MUMBAI', HYDERABAD: 'HYDERABAD', GUWAHATI: 'KAMRUP METROPOLITAN', AGARTALA: 'WEST TRIPURA' }[c] || '';
}

function splitWords(text, max) {
  const out = [''];
  for (const w of text.split(' ')) {
    const cur = out[out.length - 1];
    if (!cur) out[out.length - 1] = w;
    else if ((cur + ' ' + w).length <= max || out.length > 1) out[out.length - 1] = cur + ' ' + w;
    else out.push(w);
  }
  return out;
}
