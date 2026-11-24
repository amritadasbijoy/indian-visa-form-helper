// Letters and lists printed for the IVAC appointment: cover letter, employer NOC, parents' consent for a minor and
// a document checklist. Each is plain text built from the applicant and the Start screen choices, shown for editing,
// then drawn on A4 pages and saved as a PDF. Wording is our own; the applicant checks and signs it.
import { canvasesToPdf } from './image-tools.js';

const IVH = globalThis.IVH;
const MISSION_OFFICE = { BGDD: 'High Commission of India, Dhaka', BGDC: 'Assistant High Commission of India, Chattogram', BGDR: 'Assistant High Commission of India, Rajshahi', BGDS: 'Assistant High Commission of India, Sylhet', BGDK: 'Assistant High Commission of India, Khulna' };
const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const title = s => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const addressOf = p => [p.presAdd1, p.presAdd2, title(p.presDistrict), p.presPostal].filter(Boolean).map(title).join(', ');
const pronoun = p => (p.gender === 'F' ? { he: 'she', his: 'her', him: 'her' } : { he: 'he', his: 'his', him: 'him' });
const ageOf = p => (p.dob ? Math.floor((Date.now() - new Date(p.dob + 'T00:00:00')) / (365.25 * 864e5)) : null);

export const LETTER_KINDS = ['cover', 'noc', 'consent', 'checklist'];

/** ctx: { p, s (Start screen draft), hotel, hospital }. Returns the editable text of the letter. */
export function letterText(kind, { p, s = {}, hotel, hospital }) {
  const name = IVH.fullName(p).toUpperCase();
  const medical = IVH.profileVisaType(p) === 'medical';
  const office = MISSION_OFFICE[s.mission] || MISSION_OFFICE.BGDD;
  const trip = s.journeyDate ? IVH.toSiteDate(s.journeyDate) : '__/__/____';
  const months = s.duration || '__';
  const pr = pronoun(p);
  const head = `Date: ${today()}\n\nTo\nThe Visa Officer\n${office}\nBangladesh\n\n`;

  if (kind === 'cover') {
    const purpose = medical ? 'Medical Visa' : 'Tourist Visa';
    const why = medical
      ? `I have been advised to take medical treatment${s.illness ? ` for ${s.illness.toLowerCase()}` : ''} at ${hospital?.name ? title(hospital.name) : '[hospital name]'}, India${s.medicalLetterNo ? ` (invitation letter no. ${s.medicalLetterNo})` : ''}.`
      : `I would like to visit ${title(s.places) || '[places]'} in India as a tourist.`;
    const stay = hotel?.name ? ` During my stay I will stay at ${title(hotel.name)}, ${[hotel.address1, hotel.district, hotel.state].filter(Boolean).map(title).join(', ')}.` : '';
    return head + `Subject: Application for an Indian ${purpose}.

Dear Sir/Madam,

I, ${name}, holder of Bangladesh passport no. ${p.passportNo || '[passport no.]'}, respectfully apply for an Indian ${purpose} for ${months} month(s). ${why} I plan to travel on or around ${trip}.${stay}

${employmentLine(p)} I will bear all the expenses of my trip myself, and I will return to Bangladesh before my visa expires. I will follow the laws of India during my stay.

My application form and the supporting documents are attached. I request you to kindly grant me the visa.

Sincerely,


____________________________
${name}
Passport no.: ${p.passportNo || ''}
Address: ${addressOf(p)}
Mobile: ${p.mobile || p.phone || ''}
`;
  }

  if (kind === 'noc') {
    const org = p.empName ? title(p.empName) : '[company name]';
    return `[Print on the company letterhead]\n\n` + head + `Subject: No Objection Certificate (NOC)

Dear Sir/Madam,

This is to certify that ${name}, passport no. ${p.passportNo || '[passport no.]'}, is a permanent employee of ${org}, working as ${p.empDesignation ? title(p.empDesignation) : '[designation]'} since [joining date].

${title(pr.he)} has been granted leave from ${trip} to [return date] to visit India${medical ? ' for medical treatment' : ' as a tourist'}. We have no objection to ${pr.his} visit to India. ${title(pr.he)} will resume ${pr.his} duties after the leave.

${title(pr.his)} expenses during the trip will be borne by ${pr.him}self.

Sincerely,


____________________________
Name:
Designation:
${org}
${p.empAddress ? title(p.empAddress) : '[company address]'}
Phone: ${p.empPhone || ''}
(Seal)
`;
  }

  if (kind === 'consent') {
    const age = ageOf(p);
    return head + `Subject: Parents' consent for the travel of our minor child to India

Dear Sir/Madam,

We, ${p.fatherName || '[father\'s name]'} (father) and ${p.motherName || '[mother\'s name]'} (mother), are the parents of ${name}${age !== null ? `, aged ${age}` : ''}, Bangladesh passport no. ${p.passportNo || '[passport no.]'}.

We give our full consent for our child to travel to India on or around ${trip} for ${months} month(s)${medical ? ' for medical treatment' : ' as a tourist'}, accompanied by [name, relation and passport no. of the person travelling with the child].

We take full responsibility for our child during the visit.

Sincerely,


____________________________          ____________________________
${p.fatherName || 'Father'}                          ${p.motherName || 'Mother'}
Passport/NID:                          Passport/NID:
Mobile:                                Mobile:
`;
  }

  // Document checklist.
  const docs = p.docs || [];
  const has = slot => docs.some(d => IVH.docSlot(d) === slot);
  const tick = ok => (ok ? '[✓]' : '[  ]');
  const occ = p.occupation || '';
  const job = /SERVICE|ENGINEER|DOCTOR|TEACHER|ACCOUNTANT|JOURNALIST|LAWYER|BANK|OFFICIAL|POLICE|MILITARY|NAVY|AIR FORCE|WORKER|LABOUR/.test(occ);
  const lines = [
    `Documents to take to IVAC — ${name} (${p.passportNo || ''})`,
    `Visa: ${medical ? 'Medical' : 'Tourist'} · Mission: ${office}`,
    '',
    'Commonly asked documents. Check the current list on the IVAC website before your appointment.',
    '[✓] = saved in Visa Helper or filled already · [  ] = still to arrange',
    '',
    `${tick(false)} Printed online application form, signed by the applicant`,
    `${tick(!!p.photo)} Recent photo (2 x 2 inch, white background)`,
    `${tick(IVH.monthsUntil(p.passportExpiry) >= 6)} Original passport, valid for at least 6 months, plus old passports if any`,
    `${tick(has('passport'))} Photocopy of the passport information page`,
    `${tick(!!p.nationalId && p.nationalId !== 'NA')} National ID card copy (birth certificate for children)`,
    `${tick(false)} Proof of address (utility bill)`,
    `${tick(false)} Proof of funds (bank statement or dollar endorsement)`,
  ];
  if (job) lines.push(`${tick(false)} No Objection Certificate (NOC) from the employer`, `${tick(false)} Office ID card copy`);
  if (/BUSINESS|TRADER|SELF EMPLOYED/.test(occ)) lines.push(`${tick(false)} Trade licence copy`);
  if (/STUDENT/.test(occ)) lines.push(`${tick(false)} Student ID card or letter from the school/college`);
  if (/HOUSE WIFE/.test(occ)) lines.push(`${tick(false)} Spouse's NID/passport copy and marriage certificate copy`);
  const age = ageOf(p);
  if (age !== null && age < 18) lines.push(`${tick(false)} Parents' consent letter, and parents' passport/NID copies`);
  if (medical) {
    lines.push(
      `${tick(has('hospitalLetter') || !!s.medicalLetterNo)} Hospital invitation letter from India`,
      `${tick(has('medUndertaking'))} Medical Visa Undertaking, signed`,
      `${tick(false)} Bangladesh doctor's referral and medical reports`,
    );
  }
  lines.push(`${tick(false)} Visa processing fee payment receipt`, '', 'Prepared with Visa Helper (unofficial).');
  return lines.join('\n');
}

function employmentLine(p) {
  const occ = p.occupation || '';
  if (p.empName && !IVH.DEPENDENT_OCCUPATIONS?.includes(occ)) return `I am working as ${p.empDesignation ? title(p.empDesignation) : title(occ)} at ${title(p.empName)}, and my employer's No Objection Certificate is attached.`;
  if (/STUDENT/.test(occ)) return 'I am a student, and my student identity documents are attached.';
  if (/HOUSE WIFE/.test(occ)) return `I am a housewife; my husband's details are attached.`;
  if (/BUSINESS|TRADER/.test(occ)) return 'I run my own business; my trade licence is attached.';
  return occ ? `My occupation is ${title(occ)}.` : '';
}

// Draws text on A4 pages (150 dpi) with word wrap, then makes one PDF.
export async function textToPdf(text) {
  const W = 1240, H = 1754, M = 120, size = 27, lh = 40;
  const pages = [];
  let g, y;
  const page = () => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#111';
    g.font = `${size}px Georgia, "Times New Roman", serif`;
    g.textBaseline = 'top';
    pages.push(c);
    y = M;
  };
  page();
  for (const para of String(text).split('\n')) {
    const words = para.split(/(\s+)/);
    let line = '';
    const flush = () => {
      if (y + lh > H - M) page();
      g.fillText(line, M, y);
      y += lh;
      line = '';
    };
    if (!para.trim()) { y += lh * 0.7; continue; }
    for (const w of words) {
      const next = line + w;
      if (g.measureText(next).width > W - 2 * M && line.trim()) { flush(); line = w.trimStart(); } else line = next;
    }
    if (line) flush();
  }
  return canvasesToPdf(pages, 1, 500 * 1024);
}
