// Example data for trying the extension right after installing it: a made-up Tourist applicant (RINA DAS) with a
// drawn photo and a SPECIMEN passport page, an example hotel, a sample printed BGD application (a real text PDF the
// "Import old BGD PDF" button can read) and a passport image for "Scan passport". Nothing here belongs to a real person.
// Never submit an application filled with this data.
import { canvasesToPdf, photoJpeg, readAsDataUrl } from './image-tools.js';
import { checkDigit } from './mrz.js';

const IVH = globalThis.IVH;
export const EXAMPLE = {
  surname: 'DAS', givenName: 'RINA', gender: 'F', dob: '1990-03-14', birthPlace: 'COMILLA', birthCountry: 'BGD',
  nationalId: '1990123456789', religion: 'HINDU', education: 'GRADUATE', identMarks: 'MOLE ON LEFT CHEEK', nationalityBy: 'BY BIRTH',
  passportNo: 'A12345679', passportIssuePlace: 'DHAKA', passportIssueDate: '2022-05-10', passportExpiry: '2032-05-09',
  presAdd1: 'HOUSE 12, ROAD 4', presAdd2: 'KANDIRPAR', presDistrict: 'COMILLA', presPostal: '3500', permSame: true,
  phone: '01712345678', mobile: '01712345678', email: 'visahelper.test@example.com',
  fatherName: 'SUBHASH DAS', fatherBirthPlace: 'COMILLA', motherName: 'MALATI DAS', motherBirthPlace: 'COMILLA',
  maritalStatus: 'MARRIED', spouseName: 'AMIT DAS', spouseBirthPlace: 'COMILLA',
  occupation: 'PRIVATE SERVICE', empName: 'EXAMPLE TRADING LTD', empDesignation: 'OFFICER', empAddress: '12 SAMPLE ROAD, MOTIJHEEL, DHAKA',
  visitedBefore: false, refused: false, pakAncestry: false, otherPassport: false, changedName: false, military: false,
};
export const EXAMPLE_HOTEL = { name: 'EXAMPLE HOTEL PARK', address1: '12 SAMPLE STREET', address2: 'PARK STREET AREA', state: 'WEST BENGAL', district: 'KOLKATA', phone: '03300000000', email: 'stay@example.com' };

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// A drawn head-and-shoulders picture (not a real face).
export function drawPhoto(size = 350) {
  const c = canvas(size, size), g = c.getContext('2d'), s = size / 120;
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#5b6b8a'; g.beginPath(); g.ellipse(60 * s, 128 * s, 50 * s, 36 * s, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c99a76'; g.fillRect(52 * s, 78 * s, 16 * s, 16 * s);
  g.beginPath(); g.arc(60 * s, 56 * s, 26 * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a1d16'; g.beginPath(); g.arc(60 * s, 50 * s, 27 * s, Math.PI, 0); g.fill();
  g.fillRect(33 * s, 50 * s, 8 * s, 30 * s); g.fillRect(79 * s, 50 * s, 8 * s, 30 * s);
  g.fillStyle = '#3b2a20'; g.beginPath(); g.arc(51 * s, 58 * s, 2.2 * s, 0, 7); g.arc(69 * s, 58 * s, 2.2 * s, 0, 7); g.fill();
  // Light grain like a real photo; a flat drawing makes a JPEG under the site's 10 KB minimum.
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 18; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  g.putImageData(img, 0, 0);
  g.strokeStyle = '#8c4a3a'; g.lineWidth = 2 * s; g.beginPath(); g.arc(60 * s, 66 * s, 7 * s, 0.2, Math.PI - 0.2); g.stroke();
  return c;
}

// MRZ for the example (TD3, 2 × 44 characters) with correct check digits, so the offline scan can read it.
export function exampleMrz(p = EXAMPLE) {
  const pad = (s, n) => (s + '<'.repeat(n)).slice(0, n);
  const ymd = iso => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
  const line1 = pad(`P<BGD${p.surname}<<${p.givenName.replace(/ /g, '<')}`, 44);
  const no = pad(p.passportNo, 9), dob = ymd(p.dob), exp = ymd(p.passportExpiry), pers = pad(p.nationalId, 14);
  const parts = [no + checkDigit(no), 'BGD', dob + checkDigit(dob), p.gender, exp + checkDigit(exp), pers + checkDigit(pers)];
  const composite = parts[0] + parts[2] + parts[4] + parts[5];
  return [line1, parts.join('') + checkDigit(composite)];
}

// SPECIMEN passport data page, drawn like a Bangladesh passport (big enough for OCR).
export function drawPassport(p = EXAMPLE) {
  const W = 1600, H = 1130, c = canvas(W, H), g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#eef4ec'); grad.addColorStop(1, '#e3ece6');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // light guilloche lines so the page looks printed (and the PDF is not almost empty)
  g.strokeStyle = 'rgba(40,110,80,.10)'; g.lineWidth = 1;
  for (let i = 0; i < 60; i++) { g.beginPath(); for (let x = 0; x <= W; x += 20) g.lineTo(x, 80 + i * 14 + Math.sin(x / 70 + i) * 9); g.stroke(); }
  g.fillStyle = '#0b3d2a'; g.font = 'bold 40px Arial'; g.fillText("PEOPLE'S REPUBLIC OF BANGLADESH", 420, 70);
  g.font = 'bold 30px Arial'; g.fillText('PASSPORT', 420, 115);
  g.fillStyle = '#b42318'; g.font = 'bold 34px Arial'; g.fillText('SPECIMEN — NOT A REAL PASSPORT', 830, 115);
  g.drawImage(drawPhoto(320), 60, 150, 320, 400);
  const row = (label, value, x, y) => { g.fillStyle = '#4a5d52'; g.font = '22px Arial'; g.fillText(label, x, y); g.fillStyle = '#111'; g.font = 'bold 32px Arial'; g.fillText(value, x, y + 36); };
  const d = iso => { const [y, m, day] = iso.split('-'); return `${day} ${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][m - 1]} ${y}`; };
  row('Type', 'P', 420, 170); row('Country Code', 'BGD', 560, 170); row('Passport No.', p.passportNo, 800, 170);
  row('Surname', p.surname, 420, 250); row('Given Name', p.givenName, 420, 330);
  row('Nationality', 'BANGLADESHI', 420, 410); row('Personal No.', p.nationalId, 800, 410);
  row('Date of Birth', d(p.dob), 420, 490); row('Sex', p.gender, 800, 490); row('Place of Birth', p.birthPlace, 960, 490);
  row('Date of Issue', d(p.passportIssueDate), 420, 570); row('Issuing Authority', `DIP/${p.passportIssuePlace}`, 800, 570);
  row('Date of Expiry', d(p.passportExpiry), 420, 650);
  g.fillStyle = '#fff'; g.fillRect(0, 860, W, 270);
  g.fillStyle = '#111'; g.font = '50px "OCR B", "OCR-B", "Courier New", monospace';
  const [l1, l2] = exampleMrz(p);
  g.fillText(l1, 40, 950); g.fillText(l2, 40, 1050);
  return c;
}

const jpegBlob = (c, q = 0.9) => new Promise(r => c.toBlob(r, 'image/jpeg', q));
export const samplePassportJpeg = () => jpegBlob(drawPassport());

/** The example applicant (with photo and passport copy) and hotel, ready to save. */
export async function exampleRecords() {
  const passPdf = await canvasesToPdf([drawPassport()]);
  const profile = IVH.applyPassportDefaults({
    ...EXAMPLE, visaType: 'tourist', example: true,
    photo: photoJpeg(drawPhoto()),
    docs: [{ id: IVH.uid(), slot: 'passport', label: 'PASSPORT COPY', name: 'passport-specimen.pdf', size: passPdf.size, dataUrl: await readAsDataUrl(passPdf) }],
  });
  return { profile, hotel: { ...EXAMPLE_HOTEL, example: true } };
}

// ---------- sample printed BGD application (text PDF) ----------
// Laid out like the site's printout so bgd-parser.js reads it: label/value cells on lines, the address and
// reference columns at their usual x positions, and the photo as an image on page 1.
export async function sampleBgdPdf(p = EXAMPLE, h = EXAMPLE_HOTEL) {
  const D = iso => { const [y, m, d] = iso.split('-'); return `${d}-${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][m - 1]}-${y}`; };
  const L = []; // [page, y, [[x, text], …]]
  let page = 0, y = 800;
  const line = (...cells) => {
    if (y < 60) { page += 1; y = 800; } // continue on a new page, like the site's printout
    L.push([page, y, cells]);
    y -= 14;
  };
  line([200, 'HIGH COMMISSION OF INDIA']); line([250, 'DHAKA']);
  line([180, 'Online Visa Application Form (SAMPLE - NOT A REAL APPLICATION)']);
  line([40, 'Application Id : EXAMPLE']);
  y -= 8;
  line([40, 'A. Applicant Details']);
  line([40, 'Surname'], [200, p.surname]);
  line([40, 'Given Name'], [200, p.givenName]);
  line([40, 'Previous/other Name'], [200, 'NA']);
  line([40, 'Gender'], [200, 'FEMALE']);
  line([40, 'Marital Status'], [200, p.maritalStatus]);
  line([40, 'Date of Birth'], [200, D(p.dob)]);
  line([40, 'Religion'], [200, p.religion]);
  line([40, 'Place of Birth'], [200, p.birthPlace]);
  line([40, 'Country of Birth'], [200, 'BANGLADESH']);
  line([40, 'Citizenship/National ID No.'], [200, p.nationalId]);
  line([40, 'Educational Qualification'], [200, p.education]);
  line([40, 'Visible identification marks'], [200, p.identMarks]);
  line([40, 'Naturalization'], [200, 'BY BIRTH']);
  y -= 6;
  line([40, 'B. Passport Details']);
  line([40, 'Passport No.'], [200, p.passportNo]);
  line([40, 'Place of Issue'], [200, p.passportIssuePlace]);
  line([40, 'Date of Issue (DD/MM/YYYY)'], [200, D(p.passportIssueDate)]);
  line([40, 'Date of Expiry (DD/MM/YYYY)'], [200, D(p.passportExpiry)]);
  line([40, 'Any other Passport/Identity Certificate held'], [300, 'NO']);
  y -= 6;
  line([40, 'C. Contact Details']);
  line([40, 'Present'], [133, `${p.presAdd1},`], [275, 'Phone No'], [340, p.phone]);
  line([133, `${p.presAdd2},`], [275, 'Mobile No'], [340, '880' + p.mobile.replace(/^0/, '')]);
  line([133, `${p.presDistrict}, BANGLADESH ${p.presPostal}`], [275, 'Email address'], [340, p.email]);
  line([40, 'Permanent'], [133, `${p.presAdd1},`]);
  line([133, `${p.presAdd2},`]);
  line([133, `${p.presDistrict}, BANGLADESH ${p.presPostal}`]);
  y -= 6;
  line([40, 'D. Family Details'], [133, 'Name'], [250, 'Nationality'], [340, 'Previous Nationality'], [435, 'Place/Country of Birth']);
  line([40, 'Father'], [133, p.fatherName], [250, 'BANGLADESH'], [340, 'BANGLADESH'], [435, 'BANGLADESH']);
  line([435, p.fatherBirthPlace]);
  line([40, 'Mother'], [133, p.motherName], [250, 'BANGLADESH'], [340, 'BANGLADESH'], [435, 'BANGLADESH']);
  line([435, p.motherBirthPlace]);
  line([40, 'Spouse'], [133, p.spouseName], [250, 'BANGLADESH'], [340, 'BANGLADESH'], [435, 'BANGLADESH']);
  line([435, p.spouseBirthPlace]);
  line([40, 'Were your Grandfather/Grandmother Pakistan Nationals : NO']);
  y -= 6;
  line([40, 'E. Visa Details']);
  line([40, 'Type Of Visa Required'], [200, 'TOURIST VISA']);
  line([40, 'No of Entries'], [200, 'MULTIPLE']);
  line([40, 'Period of Visa (Month/Days)'], [200, '12 MONTHS']);
  line([40, 'Port Of Arrival'], [200, 'BY AIR/ HARIDASPUR']);
  line([40, 'Port of Exit'], [200, 'BY AIR/ HARIDASPUR']);
  line([40, 'Places to be Visited'], [200, 'KOLKATA, DARJEELING']);
  y -= 6;
  line([40, 'F. Previous Visit Details']);
  line([40, 'Have You Ever visited India before?'], [300, 'NO']);
  line([40, 'Have you been refused an Indian Visa?'], [300, 'NO']);
  line([40, 'Countries visited in last 10 years'], [300, 'NA']);
  y -= 6;
  line([40, 'G. Profession/Occupation Details of Applicant']);
  line([40, 'Present Occupation'], [200, p.occupation]);
  line([40, 'Designation/Rank'], [200, p.empDesignation]);
  line([40, 'Employer name/business'], [200, p.empName]);
  line([40, 'Employer Address'], [200, p.empAddress]);
  line([40, 'Are/have you worked with Armed Forces/Police?'], [300, 'NO']);
  y -= 6;
  line([40, 'H. Address of Place to Stay']);
  line([40, `1 ${h.name} ${h.address1} ${h.address2} ${h.district} ${h.state}. ${h.phone},`]);
  y -= 6;
  line([40, 'I. Reference'], [170, 'In India'], [300, 'In Bangladesh']);
  line([40, 'Name'], [170, h.name], [300, p.spouseName]);
  line([40, 'Address'], [170, `${h.address1}, ${h.address2}`], [300, `${p.presAdd1}, ${p.presAdd2}`]);
  line([170, `${h.district}, ${h.state}`], [300, p.presDistrict]);
  line([40, 'Phone Number'], [170, h.phone], [300, p.mobile]);
  y -= 6;
  line([40, 'DOCUMENTS UPLOADED']);
  line([40, 'SAMPLE FILE MADE BY VISA HELPER FOR TESTING. ALL DATA IS MADE UP.']);

  const photo = drawPhoto(240);
  const jpg = new Uint8Array(await (await jpegBlob(photo, 0.85)).arrayBuffer());
  return textPdf(L, { jpg, w: photo.width, h: photo.height, x: 470, y: 660, size: 100 });
}

// Minimal PDF: Helvetica text cells on one or more A4 pages, plus one JPEG on page 1.
function textPdf(lines, img) {
  const esc = s => String(s).replace(/[\\()]/g, m => '\\' + m).replace(/[^\x20-\x7e]/g, '-');
  const pages = [];
  for (const [pg, y, cells] of lines) for (const [x, s] of cells) pages[pg] = (pages[pg] || '') + `BT /F1 9 Tf ${x} ${y} Td (${esc(s)}) Tj ET\n`;
  pages[0] += `q ${img.size} 0 0 ${img.size} ${img.x} ${img.y} cm /Im1 Do Q\n`;
  const enc = new TextEncoder();
  const parts = [], offsets = [];
  let length = 0;
  const push = b => { const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); length += u.length; };
  const obj = (n, body, stream) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${body}\n`);
    if (stream) { push('stream\n'); push(stream); push('\nendstream\n'); }
    push('endobj\n');
  };
  // Objects: 1 catalog, 2 pages, 3 font, 4 image, then a page and its content for each page.
  const pageIds = pages.map((_, i) => 5 + i * 2);
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${pageIds.map(n => n + ' 0 R').join(' ')}] /Count ${pages.length} >>`);
  obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj(4, `<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpg.length} >>`, img.jpg);
  pages.forEach((content, i) => {
    const c = enc.encode(content);
    obj(pageIds[i], `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${pageIds[i] + 1} 0 R /Resources << /Font << /F1 3 0 R >> /XObject << /Im1 4 0 R >> >> >>`);
    obj(pageIds[i] + 1, `<< /Length ${c.length} >>`, c);
  });
  const size = 5 + pages.length * 2;
  const xref = length;
  push(`xref\n0 ${size}\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`);
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
