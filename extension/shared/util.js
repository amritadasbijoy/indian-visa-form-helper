// Storage, id and date helpers shared by the side panel and content scripts.
(() => {
  const IVH = (globalThis.IVH = globalThis.IVH || {});

  IVH.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Collections live under one key each: profiles, hotels, hospitals, contacts, tempIds, applications;
  // plus settings, session and siteJob (a status check or PDF save waiting for the applicant's captcha).
  IVH.store = {
    async get(key, fallback) {
      const r = await chrome.storage.local.get(key);
      return r[key] ?? fallback;
    },
    set(key, value) {
      return chrome.storage.local.set({ [key]: value });
    },
    async list(key) {
      return (await this.get(key, [])) || [];
    },
    async upsert(key, item) {
      const items = await this.list(key);
      if (!item.id) item.id = IVH.uid();
      item.updatedAt = Date.now();
      const i = items.findIndex(x => x.id === item.id);
      if (i >= 0) items[i] = item; else items.push(item);
      await this.set(key, items);
      return item;
    },
    async remove(key, id) {
      await this.set(key, (await this.list(key)).filter(x => x.id !== id));
    },
    async find(key, id) {
      return (await this.list(key)).find(x => x.id === id);
    },
  };

  IVH.DEFAULT_SETTINGS = { lang: 'en', autoAdvance: true, autoDeclare: true, delayMs: 1200, defaultBdRefId: '' };
  IVH.settings = async () => ({ ...IVH.DEFAULT_SETTINGS, ...(await IVH.store.get('settings', {})) });

  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  // Dates are stored as ISO (YYYY-MM-DD) and typed into the site as DD/MM/YYYY.
  IVH.toSiteDate = iso => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  IVH.fromSiteDate = s => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || '');
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
  };
  // "03-DEC-2008" or "03 DEC 2008" -> "2008-12-03"
  IVH.fromMonDate = s => {
    const m = /(\d{1,2})[\s\-/]+([A-Z]{3})[A-Z]*[\s\-/]+(\d{4})/i.exec(s || '');
    if (!m) return '';
    const mon = MONTHS.indexOf(m[2].toUpperCase()) + 1;
    return mon ? `${m[3]}-${String(mon).padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
  };

  IVH.monthsUntil = iso => {
    if (!iso) return Infinity;
    const d = new Date(iso + 'T00:00:00');
    return (d - new Date()) / (1000 * 60 * 60 * 24 * 30.44);
  };

  IVH.fullName = p => [p?.givenName, p?.surname].filter(Boolean).join(' ');

  // Reference in Bangladesh: the spouse when married, otherwise the father (mother if no father's name).
  IVH.defaultBdRef = p => (p?.maritalStatus === 'MARRIED' && p?.spouseName ? 'spouse' : p?.fatherName || !p?.motherName ? 'father' : 'mother');

  // Defaults after reading a Bangladesh passport: everyone is Bangladeshi by birth, the parents were born
  // where the applicant was, and the passport address is both present and permanent address.
  // Only empty fields are filled, so anything typed or imported wins.
  IVH.applyPassportDefaults = p => {
    const fill = (k, v) => { if (v && (p[k] === undefined || p[k] === null || p[k] === '')) p[k] = v; };
    fill('birthCountry', 'BGD');
    fill('nationalityBy', 'BY BIRTH');
    fill('passportIssuePlace', 'DHAKA');
    fill('identMarks', 'NO');
    for (const who of ['father', 'mother']) {
      fill(who + 'Nationality', 'BGD');
      fill(who + 'PrevNationality', 'BGD');
      fill(who + 'BirthCountry', 'BGD');
      fill(who + 'BirthPlace', p.birthPlace);
    }
    if (p.spouseName) {
      fill('maritalStatus', 'MARRIED');
      fill('spouseNationality', 'BGD');
      fill('spousePrevNationality', 'BGD');
      fill('spouseBirthCountry', 'BGD');
      fill('spouseBirthPlace', p.birthPlace);
    }
    if (p.presAdd1 && p.permSame === undefined) p.permSame = true;
    return p;
  };

  // ---- registered applications (history) ----
  // The site's Application Id has 12 letters/digits and starts with the mission code, e.g. BGDD1A2B3C4D.
  IVH.isAppId = v => /^[A-Z0-9]{12}$/.test(String(v || '').trim().toUpperCase());
  IVH.appMission = id => (IVH.MISSIONS || []).find(([code]) => String(id || '').toUpperCase().startsWith(code))?.[0] || '';
  const fileSafe = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  // NAME_PASSPORT_TEMPID.pdf (the Application Id when the Temporary ID is unknown).
  IVH.appPdfName = a => [a.name, a.passportNo, a.tempId || a.id].map(fileSafe).filter(Boolean).join('_') + '.pdf';

  // Adds or updates one application (keyed by Application Id); fields given here win, history is kept.
  IVH.saveApplication = async patch => {
    const id = String(patch.id || '').trim().toUpperCase();
    if (!IVH.isAppId(id)) throw new Error('Application Id must be 12 letters/digits');
    const list = await IVH.store.list('applications');
    const i = list.findIndex(x => x.id === id);
    const cur = i >= 0 ? list[i] : { id, at: Date.now(), checks: [] };
    const next = { ...cur, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && v !== '')), id, updatedAt: Date.now() };
    if (!next.mission) next.mission = IVH.appMission(id);
    if (i >= 0) list[i] = next; else list.unshift(next);
    await IVH.store.set('applications', list);
    return next;
  };

  // Applications that belong to an applicant: linked by profile id, or by passport number for older entries.
  IVH.applicationsOf = (p, list) => (list || []).filter(a => (a.profileId ? a.profileId === p?.id : a.passportNo && a.passportNo === p?.passportNo));

  IVH.upper = v => (typeof v === 'string' ? v.toUpperCase().trim() : v);

  // Splits an address into chunks of at most `max` characters on word boundaries (site lines allow 35).
  IVH.splitLines = (text, max = 35, count = 2) => {
    const words = (text || '').replace(/\s+/g, ' ').trim().split(' ');
    const lines = [''];
    for (const w of words) {
      const cur = lines[lines.length - 1];
      if (!cur) lines[lines.length - 1] = w;
      else if ((cur + ' ' + w).length <= max || lines.length === count) lines[lines.length - 1] = cur + ' ' + w;
      else lines.push(w);
    }
    return lines.map(l => l.slice(0, lines.length === count ? 200 : max));
  };
})();
