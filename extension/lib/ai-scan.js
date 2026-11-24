// Optional AI passport scan: sends the passport page image(s) to Claude with the user's own Anthropic API key
// and gets the fields back as JSON. The MRZ line the model transcribes is checked with its check digits,
// so a misread passport number or date is flagged instead of trusted.
import { aiJson } from './ai-client.js';
import { fileToCanvases } from './image-tools.js';
import { bestLine2, parseMrz } from './mrz.js';


const str = description => ({ type: 'string', description });

// Every field is required; the model returns "" for anything it cannot read.
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['surname', 'givenName', 'gender', 'dob', 'birthPlace', 'nationalId', 'passportNo', 'passportIssueDate', 'passportExpiry', 'issuingAuthority', 'previousPassportNo', 'fatherName', 'motherName', 'spouseName', 'address', 'phone', 'religion', 'mrzLine2', 'unclear'],
  properties: {
    surname: str('Surname exactly as printed, uppercase'),
    givenName: str('Given name(s) exactly as printed, uppercase'),
    gender: { type: 'string', enum: ['M', 'F', 'X', ''] },
    dob: str('Date of birth as YYYY-MM-DD'),
    birthPlace: str('Place of birth, uppercase'),
    nationalId: str('Personal No. / national ID number, digits only'),
    passportNo: str('Passport number, e.g. A12345678'),
    passportIssueDate: str('Date of issue as YYYY-MM-DD'),
    passportExpiry: str('Date of expiry as YYYY-MM-DD'),
    issuingAuthority: str('Issuing authority as printed, e.g. DIP/DHAKA'),
    previousPassportNo: str('Previous passport number if printed'),
    fatherName: str("Father's name, uppercase"),
    motherName: str("Mother's name, uppercase"),
    spouseName: str("Spouse's name if printed, uppercase"),
    address: {
      type: 'object',
      additionalProperties: false,
      required: ['line1', 'villageTown', 'district', 'postalCode'],
      properties: {
        line1: str('House / road / village part of the permanent address, at most 35 characters'),
        villageTown: str('Village / town / upazila part, at most 35 characters'),
        district: str('District, uppercase'),
        postalCode: str('4-digit postal code'),
      },
    },
    phone: str('Telephone number as printed, digits and + only'),
    religion: { type: 'string', enum: ['HINDU', 'ISLAM', 'BUDDHISM', 'CHRISTIAN', 'OTHERS', ''], description: 'Not printed on Bangladesh passports: the most likely religion judged from the names, or "" if unclear' },
    mrzLine2: str('Second line of the machine-readable zone at the bottom, exactly 44 characters with < as printed'),
    unclear: { type: 'array', items: { type: 'string' }, description: 'Names of fields that were hidden, blurred or uncertain' },
  },
};

const SYSTEM = `You read Bangladesh passport scans for an Indian visa application helper; your answer fills the visa form.
Copy values exactly as printed in English; never guess a printed value you cannot see - use "" and list the field in "unclear".
The scan may show the photo page and the facing "Personal data and emergency contact" page; use both.
Dates must be YYYY-MM-DD. Names and places in uppercase, single spaces, no trailing punctuation.
Address: the permanent address is used as both present and permanent address on the form. Split it into
line1 = house / road / village / ward (max 35 characters), villageTown = upazila / post office / town without repeats
(max 35 characters), district, and the 4-digit postal code. Drop dashes, repeated words and the country name.
Spouse: if the emergency contact's relationship is SPOUSE, HUSBAND or WIFE, that person is the spouse.
Religion is not printed on Bangladesh passports: give the most likely value from the applicant's and parents' names
(for example DAS, RANI, CHANDRA, KUMAR -> HINDU; MD, HOSSAIN, BEGUM, KHATUN, ISLAM, RAHMAN -> ISLAM;
BARUA, CHAKMA -> BUDDHISM; GOMES, D'COSTA, ROZARIO -> CHRISTIAN), or "" when the names don't make it clear.`;

async function toImages(file) {
  const pages = (await fileToCanvases(file, 1600)).slice(0, 2);
  return pages.map(c => ({ mediaType: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.88).split(',')[1] }));
}

// settings.aiProvider: 'anthropic' (Claude), 'openai' (any OpenAI-compatible chat API) or 'helper' (Helper AI); see ai-client.js.
export async function aiScanPassport(file, settings) {
  const images = await toImages(file);
  const { data } = await aiJson(settings, { system: SYSTEM, text: 'Extract the passport fields.', images, schema: SCHEMA, name: 'passport' });
  return toProfile(normalize(data));
}

// Non-strict servers may leave out fields; fill them so the mapping below never trips.
function normalize(d) {
  const out = {};
  for (const k of SCHEMA.required) out[k] = d?.[k] ?? (k === 'unclear' ? [] : k === 'address' ? {} : '');
  out.address = { line1: '', villageTown: '', district: '', postalCode: '', ...(typeof out.address === 'object' ? out.address : {}) };
  for (const k of Object.keys(out)) if (typeof out[k] === 'string') out[k] = out[k].trim();
  if (!Array.isArray(out.unclear)) out.unclear = [];
  out.gender = { MALE: 'M', FEMALE: 'F' }[String(out.gender).toUpperCase()] || (['M', 'F', 'X'].includes(out.gender) ? out.gender : '');
  for (const k of ['dob', 'passportIssueDate', 'passportExpiry']) out[k] = isoDate(out[k]);
  const religion = String(out.religion).toUpperCase().replace(/^(MUSLIM|ISLAMIC)$/, 'ISLAM').replace(/^BUDDHIST$/, 'BUDDHISM');
  out.religion = ['HINDU', 'ISLAM', 'BUDDHISM', 'CHRISTIAN', 'OTHERS'].includes(religion) ? religion : '';
  return out;
}

const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
// "2008-12-03", "03 DEC 2008", "03-Dec-2008" or "03/12/2008" → "2008-12-03"; anything else → "".
function isoDate(s) {
  const v = String(s || '').trim().toUpperCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  let m = /^(\d{1,2})[\s\-/.]+([A-Z]{3})[A-Z]*[\s\-/.]+(\d{4})$/.exec(v);
  if (m && MONTHS[m[2]]) return `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, '0')}`;
  m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(v);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

function toProfile(d) {
  const warnings = (d.unclear || []).map(f => `unclear: ${f}`);
  const profile = {
    surname: d.surname,
    givenName: d.givenName,
    gender: d.gender,
    dob: d.dob,
    birthPlace: d.birthPlace,
    nationalId: d.nationalId,
    passportNo: d.passportNo,
    passportIssueDate: d.passportIssueDate,
    passportExpiry: d.passportExpiry,
    passportIssuePlace: 'DHAKA', // all Bangladesh passports: DIP/DHAKA
    fatherName: d.fatherName,
    motherName: d.motherName,
  };
  if (d.spouseName) { profile.spouseName = d.spouseName; profile.maritalStatus = 'MARRIED'; }
  // A suggestion from the names, never printed on the passport, so always flagged for review.
  if (d.religion) {
    profile.religion = d.religion;
    profile.religionGuessed = true;
  }
  // "SADAR, SADAR -" → "SADAR": drop repeated parts and trailing dashes/commas.
  const tidy = s => [...new Set(String(s || '').split(',').map(p => p.replace(/[\s\-–—]+$/, '').trim()).filter(Boolean))].join(', ');
  if (d.address?.line1) {
    Object.assign(profile, {
      presAdd1: tidy(d.address.line1).slice(0, 35),
      presAdd2: tidy(d.address.villageTown).slice(0, 35),
      presDistrict: d.address.district,
      presPostal: d.address.postalCode,
      permSame: true,
    });
  }
  // Place of birth not read: use the district of the permanent address (owner's rule).
  if (!profile.birthPlace && profile.presDistrict) profile.birthPlace = profile.presDistrict;
  const phone = (d.phone || '').replace(/[^\d+]/g, '');
  if (phone) {
    profile.phone = phone.replace(/^\+?880/, '0');
    profile.mobile = phone.replace(/^\+?880/, '').replace(/^0/, '');
  }

  // Cross-check with the MRZ check digits: they prove which value is right when the model and the line disagree.
  const line2 = bestLine2(d.mrzLine2);
  if (line2) {
    const mrz = parseMrz('', line2);
    const verified = { passportNo: !mrz.warnings.includes('passport number check failed'), dob: !mrz.warnings.includes('date of birth check failed'), passportExpiry: !mrz.warnings.includes('expiry date check failed') };
    for (const k of ['passportNo', 'dob', 'passportExpiry']) {
      if (verified[k] && mrz[k] && mrz[k] !== profile[k]) {
        warnings.push(`${k}: printed text read as ${profile[k] || '—'}, machine-readable line says ${mrz[k]} (used)`);
        profile[k] = mrz[k];
      }
    }
    if (!profile.gender && mrz.gender !== 'X') profile.gender = mrz.gender;
  } else {
    warnings.push('machine-readable line not verified — compare passport number and dates with the passport');
  }
  for (const k of Object.keys(profile)) if (profile[k] === '') delete profile[k];
  return { profile, warnings };
}

// Used by tools/test-ai-scan.mjs to run the same request and mapping from Node.
export const _forTests = { SCHEMA, SYSTEM, normalize, toProfile };
