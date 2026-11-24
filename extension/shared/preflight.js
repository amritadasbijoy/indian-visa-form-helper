// Pre-flight check: everything the visa site will ask for, checked before Start so a captcha is never spent
// on an application that would stop half-way. Errors block Start; warnings can be accepted.
// Each issue says where to fix it: { level: 'error' | 'warn', text, fix: 'profile' | 'hotels' | 'hospitals' | 'contacts' | 'start', id }.
(() => {
  const IVH = (globalThis.IVH = globalThis.IVH || {});
  const t = (key, vars = {}) => IVH.t(key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  const filled = v => v !== undefined && v !== null && String(v).trim() !== '';
  const DOC_MIN = 10 * 1024, DOC_MAX = 500 * 1024; // the site's PDF limits
  const SITE_MAX = 50; // visa-details, reference and hotel boxes take 50 characters

  // Months between two ISO dates (fractional).
  const monthsBetween = (fromIso, toIso) => (new Date(toIso + 'T00:00:00') - new Date(fromIso + 'T00:00:00')) / (1000 * 60 * 60 * 24 * 30.44);
  const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  IVH.preflight = ({ p, s, hotels = [], hospitals = [], contacts = [] }) => {
    const issues = [];
    const add = (level, text, fix, id) => issues.push({ level, text, fix, id });
    if (!p) { add('error', t('pfNoApplicant'), 'start'); return issues; }
    const who = IVH.fullName(p) || '—';
    const medical = IVH.isMedical(s);

    // Visa type on the Start screen should match the applicant's profile.
    if (IVH.profileVisaType(p) !== (medical ? 'medical' : 'tourist')) add('warn', t('pfTypeMismatch', { name: who }), 'start');

    // Required profile fields (same Required marks and show-rules as the editor) and the 35-character address lines.
    for (const g of IVH.PROFILE_SCHEMA) for (const f of g.fields) {
      if (f.show && !f.show(p)) continue;
      if (f.req && !filled(p[f.k])) add('error', t('pfEmptyField', { field: IVH.tl(f) }), 'profile', p.id);
      if (f.max && String(p[f.k] || '').length > f.max) add('error', t('pfTooLong', { field: IVH.tl(f), max: f.max, n: String(p[f.k]).length }), 'profile', p.id);
    }
    if (p.maritalStatus === 'MARRIED' && !filled(p.spouseName)) add('error', t('pfSpouseName'), 'profile', p.id);

    // Passport validity: at least 6 months beyond the arrival date (the site's own rule).
    if (filled(p.passportExpiry)) {
      const from = filled(s.journeyDate) ? s.journeyDate : todayIso();
      const left = monthsBetween(from, p.passportExpiry);
      if (left < 0) add('error', t('pfPassportExpired', { date: IVH.toSiteDate(p.passportExpiry) }), 'profile', p.id);
      else if (left < 6) add('error', t('pfPassportSix', { date: IVH.toSiteDate(p.passportExpiry) }), 'profile', p.id);
      else if (left < 12) add('warn', t('pfPassportYear', { date: IVH.toSiteDate(p.passportExpiry) }), 'profile', p.id);
    }

    // Photo and documents for this visa type.
    if (!p.photo) add('error', t('pfNoPhoto'), 'profile', p.id);
    const kind = medical ? 'medical' : 'tourist';
    const docs = p.docs || [];
    for (const slot of IVH.DOC_SLOTS) {
      if (!slot.for.includes(kind)) continue;
      const doc = docs.find(d => IVH.docSlot(d) === slot.key);
      if (!doc) { if (slot.required?.includes(kind)) add('error', t('pfDocMissing', { doc: IVH.tl(slot) }), 'profile', p.id); continue; }
      if (doc.size < DOC_MIN || doc.size > DOC_MAX) add('error', t('pfDocSize', { doc: IVH.tl(slot), kb: Math.round(doc.size / 1024) }), 'profile', p.id);
    }

    // Formats that the site accepts but that are usually typing mistakes.
    IVH.profileChecks(p).filter(text => text !== t('pfSpouseName')).forEach(text => add('warn', text, 'profile', p.id));

    // Trip choices.
    if (!filled(s.journeyDate)) add('error', t('pfNoDate'), 'start');
    else if (s.journeyDate < todayIso()) add('error', t('pfPastDate', { date: IVH.toSiteDate(s.journeyDate) }), 'start');
    if (!filled(s.email || p.email)) add('error', t('pfNoEmail'), 'start');
    if (!filled(s.portIn)) add('error', t('pfNoPort'), 'start');

    // Hotel: the place-of-stay page needs every one of these.
    const hotel = hotels.find(x => x.id === s.hotelId);
    if (!hotel) add('error', t('pfNoHotel'), 'start');
    else placeGaps(hotel).forEach(f => add('error', t('pfHotelGap', { name: hotel.name || '—', field: fieldName(f) }), 'hotels', hotel.id));
    // The place-of-stay address box takes 50 characters; longer addresses are cut.
    for (const x of [hotel, hotels.find(y => y.id === s.hotel2Id)].filter(Boolean)) {
      const n = [x.address1, x.address2].filter(Boolean).join(', ').length;
      if (n > SITE_MAX) add('warn', t('pfHotelLong', { name: x.name || '—', n }), 'hotels', x.id);
    }

    // References.
    const hospital = hospitals.find(x => x.id === s.hospitalId);
    const refIndia = s.refIndia === 'hotel' ? hotel : s.refIndia === 'hospital' ? hospital : contacts.find(c => c.id === s.refIndia);
    if (!refIndia) add('error', t('pfNoRefIndia'), 'start');
    else if (refIndia !== hotel) placeGaps(refIndia).forEach(f => add('error', t('pfRefIndiaGap', { name: refIndia.name || '—', field: fieldName(f) }), s.refIndia === 'hospital' ? 'hospitals' : 'contacts', refIndia.id));
    const relative = { father: p.fatherName, mother: p.motherName, spouse: p.spouseName }[s.refBd];
    if (['father', 'mother', 'spouse'].includes(s.refBd)) {
      if (!filled(relative)) add('error', t('pfRefBdRelative'), 'profile', p.id);
    } else {
      const c = contacts.find(x => x.id === s.refBd);
      if (!c) add('error', t('pfNoRefBd'), 'start');
      else ['name', 'address1', 'phone'].filter(k => !filled(c[k])).forEach(k => add('error', t('pfRefBdGap', { name: c.name || '—', field: fieldName(k) }), 'contacts', c.id));
    }

    // Medical: the visa-details page needs all of these.
    if (medical) {
      if (!filled(s.medicalLetterNo)) add('error', t('pfNoLetter'), 'start');
      if (!filled(s.illness)) add('error', t('pfNoIllness'), 'start');
      const bd = hospitals.find(x => x.id === s.bdHospitalId);
      if (!bd) add('error', t('pfNoBdHospital'), 'start');
      else ['name', 'address1', 'doctor', 'phone', 'email'].filter(k => !filled(bd[k])).forEach(k => add('error', t('pfBdHospitalGap', { name: bd.name || '—', field: fieldName(k) }), 'hospitals', bd.id));
      if (filled(s.illness) && s.illness.length > SITE_MAX) add('error', t('pfTooLong', { field: IVH.t('medIllness'), max: SITE_MAX, n: s.illness.length }), 'start');
    }
    return issues;
  };

  // Likely typing mistakes in a profile (warnings only): shown while editing and in the pre-flight check.
  // Short checks for a guessed religion and a phone number read from the passport (the editor adds a button).
  IVH.religionCheck = p => (p.religionGuessed && filled(p.religion) ? t('pfReligionGuessed', { religion: p.religion }) : '');
  IVH.mobileCheck = p => (p.mobileFromPassport && (filled(p.mobile) || filled(p.phone))
    ? t('pfMobileFromPassport', { phone: filled(p.mobile) ? '0' + String(p.mobile).replace(/^0/, '') : p.phone, year: String(p.passportIssueDate || '').slice(0, 4) || '—' }) : '');

  IVH.profileChecks = p => {
    const out = [];
    const today = todayIso();
    const nid = String(p.nationalId || '').replace(/\D/g, '');
    if (filled(p.nationalId) && p.nationalId !== 'NA' && ![10, 13, 17].includes(nid.length)) out.push(t('pfNid', { n: nid.length }));
    for (const k of ['phone', 'mobile']) {
      const v = String(p[k] || '').replace(/\D/g, '');
      // The mobile box holds the number without the leading 0 ("1712345678"), as the visa site wants it.
      const ok = /^(880)?01\d{9}$/.test(v) || /^0\d{6,10}$/.test(v) || (k === 'mobile' && /^(880)?1\d{9}$/.test(v));
      if (filled(p[k]) && !ok) out.push(t('pfPhone', { phone: p[k] }));
    }
    if (filled(p.email) && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(p.email)) out.push(t('pfEmailBad', { email: p.email }));
    [IVH.religionCheck(p), IVH.mobileCheck(p)].filter(Boolean).forEach(x => out.push(x));
    if (filled(p.dob)) {
      if (p.dob > today) out.push(t('pfDobFuture'));
      else {
        const age = Math.floor(monthsBetween(p.dob, today) / 12);
        if (age < 18 && filled(p.education) && p.education !== 'NA BEING MINOR') out.push(t('pfMinorEdu'));
        if (age >= 18 && p.education === 'NA BEING MINOR') out.push(t('pfAdultMinorEdu', { age }));
      }
    }
    if (filled(p.passportIssueDate)) {
      if (p.passportIssueDate > today) out.push(t('pfIssueFuture'));
      if (filled(p.passportExpiry) && p.passportIssueDate >= p.passportExpiry) out.push(t('pfIssueAfterExpiry'));
    }
    if (p.maritalStatus === 'MARRIED' && !filled(p.spouseName)) out.push(t('pfSpouseName'));
    return out;
  };

  const fieldName = k => IVH.t('pfF_' + k);

  // Fields a hotel / India reference / India hospital needs on the site.
  function placeGaps(x) {
    return ['name', 'address1', 'state', 'district', 'phone'].filter(k => !filled(x[k]));
  }
})();
