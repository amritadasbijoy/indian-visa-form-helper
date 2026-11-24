// Parses the two 44-character machine-readable lines (ICAO TD3) at the bottom of a passport photo page.
// OCR text is noisy, so digit fields are repaired with the check digits before being trusted.

const WEIGHTS = [7, 3, 1];
const val = ch => (ch === '<' ? 0 : /\d/.test(ch) ? +ch : ch.charCodeAt(0) - 55);
export const checkDigit = s => String([...s].reduce((sum, ch, i) => sum + val(ch) * WEIGHTS[i % 3], 0) % 10);

const TO_DIGIT = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6', T: '7' };
const TO_ALPHA = { 0: 'O', 1: 'I', 2: 'Z', 5: 'S', 8: 'B', 6: 'G' };
const digits = s => [...s].map(c => TO_DIGIT[c] || c).join('');
const alpha = s => [...s].map(c => TO_ALPHA[c] || c).join('');

function cleanLine(l) {
  return repairFiller(l.toUpperCase().replace(/[«‹]/g, '<').replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, ''));
}

// Tesseract often splits a '<' into "<K". An MRZ line is exactly 44 characters, so while the line is
// too long, drop a K that follows '<' — first where more filler follows, then anywhere.
function repairFiller(l) {
  while (l.length > 44 && /<K(?=[<KL]|$)/.test(l)) l = l.replace(/<K(?=[<KL]|$)/, '<');
  while (l.length > 44 && /<K/.test(l)) l = l.replace(/<K/, '<');
  return l;
}

// Picks the two MRZ lines out of OCR text (line 1 starts with P, both ~44 chars, lots of '<').
export function findMrzLines(text) {
  const lines = text.split(/\n/).map(cleanLine).filter(l => l.length >= 30);
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i], b = lines[i + 1];
    if (/^P[A-Z<]/.test(a) && (a.match(/</g) || []).length >= 3 && /\d{6}/.test(b)) return [fit(a), fit(b)];
  }
  // Fallback: line 2 alone is enough for number/dates if line 1 was garbled.
  const b = lines.find(l => /^[A-Z0-9<]{9}\d[A-Z<]{3}\d{6}/.test(digitsAt(l)));
  return b ? ['', fit(b)] : null;
}
const fit = l => (l + '<'.repeat(44)).slice(0, 44);
const digitsAt = l => l.slice(0, 10) + alpha(l.slice(10, 13)) + digits(l.slice(13, 19)) + l.slice(19);

// Picks the 44-character window of an OCR'd line that best satisfies the TD3 line-2 check digits
// (OCR often adds a stray character at either end). Returns null when nothing validates.
export function bestLine2(raw) {
  const s = (raw || '').toUpperCase().replace(/[^A-Z0-9<]/g, '');
  // Line 2 is mostly digits; this keeps MRZ line 1 (all letters and '<') from passing on its filler.
  if ((s.match(/\d/g) || []).length < 12) return null;
  let best = null, bestScore = 0;
  // Windows of the line, plus one with a placeholder in front: a scan cut off at the left edge loses the
  // passport number's first letter (the caller then works that letter out from the check digit).
  const windows = [];
  for (let i = 0; i + 28 <= s.length; i++) windows.push(fit(s.slice(i, i + 44)));
  windows.push(fit('<' + s.slice(0, 43)));
  for (const l of windows) {
    let score = 0;
    if (checkDigit(l.slice(0, 9)) === digits(l[9])) score += 2;
    if (checkDigit(digits(l.slice(13, 19))) === digits(l[19])) score += 2;
    if (checkDigit(digits(l.slice(21, 27))) === digits(l[27])) score += 2;
    if (/^[A-Z<]{3}$/.test(alpha(l.slice(10, 13)))) score += 1;
    if (/[MF<X]/.test(l[20])) score += 1;
    if (score > bestScore) { best = l; bestScore = score; }
  }
  return bestScore >= 4 ? best : null;
}

const JUNK = new Set(['<', 'C', 'L', 'K', 'S', 'E']);
// One misread letter allowed per 4 letters (RLNA ≈ RINA); dictionary words are at least 3 letters.
const near = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d <= Math.floor(a.length / 4);
};

// Splits the noisy name field of MRZ line 1 into surname / given names. `words` are names read from the
// printed part of the passport; they anchor the tokens so misread '<' fillers (C, L, K, S…) are dropped.
export function splitMrzNames(field, words = []) {
  const s = (field || '').toUpperCase().replace(/[^A-Z<]/g, '');
  // Two-letter OCR scraps ("SR", "AR") would match noise, so only 3+ letter printed words anchor tokens.
  // The page OCR also reads the MRZ itself, so drop filler-like words ("LLLLKLAS") from the dictionary.
  const fillerish = w => w.length > 20 || [...w].filter(c => JUNK.has(c)).length / w.length > 0.6 || /(.)\1\1/.test(w);
  const dict = [...new Set(words.filter(w => /^[A-Z]{3,}$/.test(w) && !fillerish(w)))].sort((a, b) => b.length - a.length);
  const tokens = []; // { word, sepBefore }
  const dictAt = j => dict.find(w => near(s.slice(j, j + w.length), w));
  // A letter that looks like a misread '<' counts as filler only when a known name follows it, it touches a
  // real '<' next to more filler, or everything after it is filler.
  const isSep = j => s[j] === '<' || (tokens.length > 0 && JUNK.has(s[j]) && (
    dictAt(j + 1) || (JUNK.has(s[j + 1]) && dictAt(j + 2)) || /^[<CLKSE]*$/.test(s.slice(j)) ||
    s[j + 1] === '<' || ((s[j - 1] === '<' || sep > 0) && JUNK.has(s[j + 1] || '<'))));
  let i = 0, sep = 0;
  while (i < s.length) {
    // Names never follow a long filler run; what is left is noise at the end of the line.
    if (sep >= 5) break;
    const hit = sep > 0 || tokens.length === 0 ? dictAt(i) : null;
    if (hit) { tokens.push({ word: hit, sepBefore: sep }); i += hit.length; sep = 0; continue; }
    if (isSep(i)) { sep++; i++; continue; }
    // Unknown letters: take the run up to the next '<' as a word (fallback when the printed name was not read).
    const m = /^[A-Z]+?(?=[<CLKSE]{3,}$|<|$)/.exec(s.slice(i)) || /^[A-Z]+/.exec(s.slice(i));
    tokens.push({ word: m[0], sepBefore: sep });
    i += m[0].length;
    sep = 0;
  }
  // Trailing filler often leaves short junk "words" like "KL"; keep only tokens before a long filler run.
  const real = tokens.filter((tk, k) => k === 0 || tk.word.length > 1 && !/^[CLKSE]+$/.test(tk.word));
  if (!real.length) return { surname: '', givenName: '' };
  // The surname ends at the first double separator ('<<'), or after the first token if none is found.
  let cut = real.findIndex((tk, k) => k > 0 && tk.sepBefore >= 2);
  if (cut < 0) cut = 1;
  return {
    surname: real.slice(0, cut).map(t => t.word).join(' '),
    givenName: real.slice(cut).map(t => t.word).join(' '),
  };
}

const yymmdd = (s, future) => {
  if (!/^\d{6}$/.test(s)) return '';
  let y = +s.slice(0, 2);
  const nowYY = new Date().getFullYear() % 100;
  y += future ? 2000 : y > nowYY ? 1900 : 2000;
  return `${y}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
};

export function parseMrz(line1, line2) {
  const warnings = [];
  const out = {};
  if (line1) {
    const country = alpha(line1.slice(2, 5)).replace(/</g, '');
    // Trailing filler is sometimes read as L/K; cut from the first '<' of the tail run.
    const names = alpha(line1.slice(5)).replace(/<[<LK]*$/, '');
    const [sur, given = ''] = names.split('<<');
    out.surname = (sur || '').replace(/</g, ' ').trim();
    out.givenName = given.replace(/</g, ' ').trim();
    out.issuingCountry = country;
  } else warnings.push('name line unreadable');

  const l2 = line2;
  let docNo = l2.slice(0, 9);
  // Passport numbers are letters+digits; try the common OCR swaps until the check digit agrees.
  const docCheck = digits(l2[9]);
  if (checkDigit(docNo) !== docCheck) {
    const fixed = [docNo, docNo[0] + digits(docNo.slice(1)), alpha(docNo[0]) + digits(docNo.slice(1))].find(d => checkDigit(d) === docCheck);
    if (fixed) docNo = fixed; else warnings.push('passport number check failed');
  }
  out.passportNo = docNo.replace(/</g, '');
  out.nationality = alpha(l2.slice(10, 13)).replace(/</g, '');

  const dob = digits(l2.slice(13, 19));
  if (checkDigit(dob) !== digits(l2[19])) warnings.push('date of birth check failed');
  out.dob = yymmdd(dob, false);

  const sex = l2[20];
  out.gender = sex === 'F' ? 'F' : sex === 'M' ? 'M' : 'X';

  const exp = digits(l2.slice(21, 27));
  if (checkDigit(exp) !== digits(l2[27])) warnings.push('expiry date check failed');
  out.passportExpiry = yymmdd(exp, true);

  const personal = l2.slice(28, 42).replace(/</g, '');
  if (personal) out.personalNumber = digits(personal);
  out.warnings = warnings;
  return out;
}
