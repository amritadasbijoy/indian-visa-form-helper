// Orchestrates filling on the visa site: loads the active session, runs the plan for the current page
// through the page bridge, shows a floating status panel, and moves on to the next page when allowed.
(() => {
  const IVH = globalThis.IVH;
  const t = k => IVH.t(k);
  // The site sometimes appends ";jsessionid=..." to the path.
  const page = (location.pathname.split('/').filter(Boolean).pop() || '').split(';')[0];
  let plan = IVH.PAGES[page];
  // Field and page renames from the helper server (see background.js), applied to every bridge operation.
  let renames = {};
  async function loadFieldMap() {
    chrome.runtime.sendMessage({ type: 'fieldMap' }).catch(() => {});
    const fm = (await IVH.store.get('fieldMap'))?.map;
    if (!fm) return;
    renames = { ...fm.ids, ...fm.pageIds?.[page] };
    if (!plan && IVH.PAGES[fm.pageAliases?.[page]]) plan = IVH.PAGES[fm.pageAliases[page]];
  }
  let reqSeq = 0;
  let countdown = null;

  // ---- bridge ----
  function runOps(ops) {
    const id = ++reqSeq + '-' + Date.now();
    return new Promise(resolve => {
      const onMsg = e => {
        if (e.source === window && e.data?.ivh === 'res' && e.data.id === id) {
          window.removeEventListener('message', onMsg);
          resolve(e.data.results);
        }
      };
      window.addEventListener('message', onMsg);
      window.postMessage({ ivh: 'req', id, ops: ops.map(o => (o.id && renames[o.id] ? { ...o, id: renames[o.id] } : o)) }, '*');
    });
  }

  // ---- data ----
  async function loadContext(s) {
    const [p, hotel, hotel2, hospital, bdHospital, contacts] = await Promise.all([
      IVH.store.find('profiles', s.profileId),
      s.hotelId ? IVH.store.find('hotels', s.hotelId) : null,
      s.hotel2Id ? IVH.store.find('hotels', s.hotel2Id) : null,
      s.hospitalId ? IVH.store.find('hospitals', s.hospitalId) : null,
      s.bdHospitalId ? IVH.store.find('hospitals', s.bdHospitalId) : null,
      IVH.store.list('contacts'),
    ]);
    if (!p) return null;
    const refIndia = s.refIndia === 'hotel' ? hotel : s.refIndia === 'hospital' ? hospital : contacts.find(c => c.id === s.refIndia);
    const relative = { father: p.fatherName, mother: p.motherName, spouse: p.spouseName }[s.refBd];
    const refBd = relative
      ? { name: relative, address1: p.presAdd1, address2: [p.presAdd2, p.presDistrict].filter(Boolean).join(', '), phone: p.phone }
      : contacts.find(c => c.id === s.refBd);
    return { p, s, hotel, hotel2, hospital, bdHospital, refIndia, refBd };
  }

  // Pages write it as "Temporary Application ID : X…" or "Temporary Application Id:-X…".
  const pageTempId = () => (/Temporary Application Id\s*:-?\s*([A-Z0-9]{8,})/i.exec(document.body.innerText)?.[1] || '').toUpperCase();

  async function rememberTempId(s, p) {
    const id = pageTempId();
    if (!id) return null;
    // One entry per Temporary ID, linked to the applicant, with the furthest page seen (shown in the side panel).
    const list = await IVH.store.list('tempIds');
    const lastPage = plan?.title || page;
    const existing = list.find(x => x.id === id);
    if (existing) {
      Object.assign(existing, { lastPage, seenAt: Date.now(), profileId: existing.profileId || p?.id });
    } else {
      list.unshift({ id, profileId: p?.id || '', name: IVH.fullName(p), passportNo: p?.passportNo || '', mission: s?.mission || '', purpose: s?.purpose || '', lastPage, at: Date.now(), seenAt: Date.now() });
    }
    await IVH.store.set('tempIds', list.slice(0, 300));
    if (s && s.tempId !== id) await IVH.store.set('session', { ...s, tempId: id });
    return id;
  }

  // Saves (or updates) the hospital from a medical invitation letter as an India hospital and selects it for
  // this application. Email, state and district typed earlier are kept; new ones are guessed from the address.
  async function saveLetterHospital(found, s) {
    const up = v => String(v || '').replace(/\s+/g, ' ').trim().toUpperCase();
    const name = up(found.name);
    const address = up(found.address);
    const list = await IVH.store.list('hospitals');
    const match = list.find(x => up(x.name) === name);
    const place = Object.entries(CITY_PLACES).find(([city]) => address.includes(city))?.[1] || {};
    const [address1, ...rest] = IVH.splitLines(address, 35, 2);
    const rec = await IVH.store.upsert('hospitals', {
      ...(match || {}),
      country: 'IN',
      name,
      address1: String(address1 || '').replace(/[,\s]+$/, ''),
      address2: rest.join(' ').replace(/^[,\s]+/, ''),
      doctor: up(found.doctor) || match?.doctor || '',
      phone: String(found.phone || '').trim() || match?.phone || '',
      // The letter's official email (from the lookup) wins; otherwise keep one typed earlier.
      email: String(found.email || '').trim().toLowerCase() || match?.email || '',
      state: match?.state || place.state || '',
      district: match?.district || place.district || '',
      fromLetter: s.medicalLetterNo || '',
    });
    const now = await IVH.store.get('session');
    if (now && now.hospitalId !== rec.id) await IVH.store.set('session', { ...now, hospitalId: rec.id });
    return rec;
  }

  // Cities that hospital addresses mention → the visa site's state and district names.
  const CITY_PLACES = {
    KOLKATA: { state: 'WEST BENGAL', district: 'KOLKATA' },
    CALCUTTA: { state: 'WEST BENGAL', district: 'KOLKATA' },
    SILIGURI: { state: 'WEST BENGAL', district: 'DARJILING' },
    CHENNAI: { state: 'TAMIL NADU', district: 'CHENNAI' },
    VELLORE: { state: 'TAMIL NADU', district: 'VELLORE' },
    BANGALORE: { state: 'KARNATAKA', district: 'BANGALORE' },
    BENGALURU: { state: 'KARNATAKA', district: 'BANGALORE' },
    HYDERABAD: { state: 'TELANGANA', district: 'HYDERABAD' },
    MUMBAI: { state: 'MAHARASHTRA', district: 'MUMBAI' },
    DELHI: { state: 'DELHI', district: 'NEW DELHI' },
    GURGAON: { state: 'HARYANA', district: 'GURGAON' },
    GURUGRAM: { state: 'HARYANA', district: 'GURGAON' },
    GUWAHATI: { state: 'ASSAM', district: 'KAMRUP METROPOLITAN' },
    AGARTALA: { state: 'TRIPURA', district: 'WEST TRIPURA' },
  };

  // ---- floating panel ----
  let ui;
  function panel() {
    if (ui) return ui;
    const host = document.createElement('div');
    host.id = 'ivh-host';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        .box{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:300px;font:13px/1.4 system-ui,-apple-system,"Noto Sans Bengali",sans-serif;
          background:#fff;color:#1d2433;border:1px solid #d6dae3;border-radius:12px;box-shadow:0 8px 28px rgba(16,24,40,.18);overflow:hidden}
        .hd{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#0b3d91;color:#fff}
        .hd b{flex:1;font-size:13px}.dot{width:10px;height:10px;border-radius:50%;background:#ff9933;box-shadow:0 0 0 2px #fff}
        .x{background:none;border:0;color:#fff;font-size:16px;cursor:pointer}
        .bd{padding:10px 12px}.who{font-weight:600}.pg{color:#5b6475;font-size:12px;margin-bottom:6px}
        .st{padding:8px;border-radius:8px;background:#eef3ff}.st.warn{background:#fff4e5}.st.ok{background:#e9f8ef}
        ul{margin:6px 0 0;padding-left:18px;color:#a14b00;max-height:120px;overflow:auto;font-size:12px}
        .ft{display:flex;gap:6px;padding:0 12px 12px}.ft[hidden]{display:none}
        button.b{flex:1;padding:7px 8px;border-radius:8px;border:1px solid #c9cfdb;background:#f7f8fb;cursor:pointer;font:inherit}
        button.b.p{background:#0b3d91;color:#fff;border-color:#0b3d91}
        .pick{padding:0 12px 8px}.pick[hidden]{display:none}
        .pick select{width:100%;padding:7px 8px;border-radius:8px;border:1px solid #c9cfdb;font:inherit;background:#fff}
        .mini{position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:8px 12px;border-radius:999px;border:0;background:#0b3d91;color:#fff;
          font:600 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 18px rgba(16,24,40,.25)}
      </style>
      <div class="box" hidden>
        <div class="hd"><span class="dot"></span><b>${t('appName')} <small style="font-weight:400;opacity:.75">v${chrome.runtime.getManifest().version}</small></b><button class="x" title="${t('hideTip')}">×</button></div>
        <div class="bd"><div class="who"></div><div class="pg"></div><div class="st"></div><ul hidden></ul></div>
        <div class="pick" hidden><select class="sel"></select></div>
        <div class="ft act" hidden><button class="b p go"></button></div>
      <div class="ft main"><button class="b refill">${t('fpRefill')}</button><button class="b pause">${t('fpPause')}</button><button class="b stop">${t('stopFill')}</button></div>
      </div>
      <button class="mini" hidden>${t('fpOpenPanel')}</button>`;
    document.documentElement.appendChild(host);
    const q = s => root.querySelector(s);
    ui = { box: q('.box'), mini: q('.mini'), who: q('.who'), pg: q('.pg'), st: q('.st'), issues: q('ul'), refill: q('.refill'), pause: q('.pause'), stop: q('.stop'),
      act: q('.act'), go: q('.go'), main: q('.main'), pick: q('.pick'), sel: q('.sel') };
    q('.x').onclick = () => { ui.box.hidden = true; ui.mini.hidden = false; };
    ui.mini.onclick = () => {
      if (ui.who.textContent) { ui.box.hidden = false; ui.mini.hidden = true; }
      else chrome.runtime.sendMessage({ type: 'openPanel' });
    };
    ui.refill.onclick = () => fillPage(true);
    ui.pause.onclick = async () => {
      const s = await IVH.store.get('session');
      if (!s) return;
      s.paused = !s.paused;
      await IVH.store.set('session', s);
      if (s.paused) cancelCountdown();
      ui.pause.textContent = t(s.paused ? 'fpResume' : 'fpPause');
    };
    ui.stop.onclick = async () => {
      cancelCountdown();
      const s = await IVH.store.get('session');
      if (s) await IVH.store.set('session', { ...s, active: false });
      ui.box.hidden = true;
      ui.mini.hidden = false;
    };
    return ui;
  }

  // `action` adds one button above the usual ones ({ label, onclick }); `jobPage` hides the filling buttons.
  function status(text, kind = '', issues = [], { action, jobPage } = {}) {
    const u = panel();
    u.act.hidden = !action;
    if (action) { u.go.textContent = action.label; u.go.onclick = action.onclick; }
    u.main.hidden = !!jobPage;
    u.box.hidden = false;
    u.mini.hidden = true;
    u.st.textContent = text;
    u.st.className = 'st ' + kind;
    u.issues.hidden = !issues.length;
    u.issues.innerHTML = '';
    for (const i of issues) {
      const li = document.createElement('li');
      li.textContent = i;
      u.issues.appendChild(li);
    }
  }

  // The declaration checkbox ("I …, hereby declare …") and the page's Save and Continue button, found by their text.
  const verifyDocsBox = () => [...document.querySelectorAll('input[type=checkbox]')]
    .find(cb => cb.offsetParent && /verified that all the documents/i.test(cb.closest('label,td,p,div,tr')?.innerText || ''));
  const confirmButton = () => [...document.querySelectorAll('input[type=submit],input[type=button],button')]
    .find(b => b.offsetParent && /^confirm$/i.test((b.value || b.textContent || '').trim()));
  const declarationBox = () => [...document.querySelectorAll('input[type=checkbox]')]
    .find(cb => cb.offsetParent && /hereby declare/i.test(cb.closest('label,td,p,div,tr')?.innerText || ''));
  const saveContinueButton = () => [...document.querySelectorAll('input[type=submit],input[type=button],button')]
    .find(b => b.offsetParent && /^save and continue$/i.test((b.value || b.textContent || '').trim()));

  function cancelCountdown() {
    if (countdown) clearInterval(countdown);
    countdown = null;
  }

  // ---- registered application: history, PDF and status ----
  // After "Verified and Continue" the site shows the 12-character Application Id (mission code first).
  const pageAppId = () => {
    const text = document.body.innerText;
    const id = (/Application\s*(?:Id|No\.?|Number)\s*[:\-]*\s*([A-Z0-9]{12})(?![A-Z0-9])/i.exec(text)?.[1] || /\b(BGD[DCKRS][A-Z0-9]{8})\b/.exec(text)?.[1] || '').toUpperCase();
    return IVH.appMission(id) ? id : '';
  };

  async function recordSubmitted(ctx, appId) {
    const { p, s } = ctx;
    const a = await IVH.saveApplication({
      id: appId, profileId: p.id, name: IVH.fullName(p), passportNo: p.passportNo, dob: p.dob,
      mission: s.mission, purpose: s.purpose, visaType: IVH.isMedical(s) ? 'medical' : 'tourist', tempId: s.tempId, submittedAt: Date.now(), source: 'site',
    });
    const temps = await IVH.store.list('tempIds');
    const temp = temps.find(x => x.id === s.tempId);
    if (temp && temp.appId !== appId) { Object.assign(temp, { appId, lastPage: 'Submitted', seenAt: Date.now() }); await IVH.store.set('tempIds', temps); }
    await IVH.store.set('session', { ...s, active: false, appId });
    return a;
  }

  // Sends the applicant to the site's reprint page, where the PDF is fetched after they type the captcha.
  async function goSavePdf(appId, profileId) {
    await IVH.store.set('siteJob', { kind: 'print', appId, profileId, at: Date.now() });
    location.href = 'PrintApplication';
  }

  // Reprint / status pages. Filled by themselves only right after "Save PDF" / "Check status" was clicked in the
  // side panel (once; a status check also comes back here with its result). Opened by hand, nothing is filled:
  // the floating panel offers a list of saved applications to choose from.
  async function jobPage() {
    const job = await IVH.store.get('siteJob');
    const kind = page === 'PrintApplication' ? 'print' : 'status';
    const apps = await IVH.store.list('applications');
    const recent = job && job.kind === kind && Date.now() - job.at < 3 * 60000 && (!job.used || job.stage === 'submitted');
    const a = recent && apps.find(x => x.id === job.appId);
    if (a) {
      await IVH.store.set('siteJob', job.stage === 'submitted' ? null : { ...job, used: true });
      return runJob(kind, a, job);
    }
    if (!apps.length) { panel().mini.hidden = false; return; }
    const u = panel();
    u.who.textContent = t('jobPickTitle');
    u.pg.textContent = kind === 'print' ? 'Print Registered Application' : 'Visa Status Enquiry';
    u.sel.replaceChildren(...[['', '— ' + t('jobPick') + ' —'], ...apps.map(x => [x.id, `${x.name || '—'} · ${x.id}`])].map(([v, txt]) => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = txt;
      return o;
    }));
    u.pick.hidden = false;
    status(t('jobPickHelp'), '', [], { jobPage: true, action: { label: t('jobFill'), onclick: async () => {
      const chosen = apps.find(x => x.id === u.sel.value);
      if (!chosen) return u.sel.focus();
      const picked = { kind, appId: chosen.id, profileId: chosen.profileId, at: Date.now(), used: true };
      await IVH.store.set('siteJob', picked);
      u.pick.hidden = true;
      runJob(kind, chosen, picked);
    } } });
  }

  async function runJob(kind, a, job) {
    const p = await IVH.store.find('profiles', a.profileId || job.profileId);
    const u = panel();
    u.pick.hidden = true;
    u.who.textContent = `${a.name || IVH.fullName(p)} · ${a.id}`;
    u.pg.textContent = kind === 'print' ? 'Print Registered Application' : 'Visa Status Enquiry';
    if (kind === 'print') return printJob(a, p);
    return statusJob(a, p, job);
  }

  async function printJob(a, p) {
    const form = document.querySelector('form[action*="PrintApplication"]');
    if (!form) return;
    const dob = IVH.toSiteDate(a.dob || p?.dob);
    const issues = (await runOps([
      { op: 'radio', id: 'visa_type2' },
      { op: 'set', id: 'missioncode_id_reprint', value: a.mission || IVH.appMission(a.id) },
      { op: 'set', id: 'application_id', value: a.id },
      { op: 'set', id: 'dob_id', value: dob, events: false },
      { op: 'set', id: 'passport_no', value: a.passportNo || p?.passportNo },
      { op: 'focus', id: 'captcha' },
    ])).filter(r => typeof r === 'string');
    status(t('fpPrintCaptcha'), issues.length ? 'warn' : 'ok', issues, { jobPage: true });
    if (form.dataset.ivh) return;
    form.dataset.ivh = '1';
    // The site's own check (onsubmit) runs first; when it passes, the form is sent here instead of navigating
    // away, so the PDF that comes back can be kept with the application.
    form.addEventListener('submit', async e => {
      if (e.defaultPrevented) return;
      e.preventDefault();
      status(t('fpPrintWorking'), '', [], { jobPage: true });
      const body = new URLSearchParams(new FormData(form));
      if (e.submitter?.name) body.set(e.submitter.name, e.submitter.value);
      try {
        const res = await fetch(form.action, { method: 'POST', body, credentials: 'same-origin' });
        const buf = await res.arrayBuffer();
        if (new TextDecoder().decode(buf.slice(0, 5)) === '%PDF-') return pdfArrived(a, new Blob([buf], { type: 'application/pdf' }));
        printHtmlArrived(form, new TextDecoder().decode(buf));
      } catch (err) {
        status(`${t('fpPrintError')} (${err.message})`, 'warn', [], { jobPage: true });
      }
    });
  }

  // Confirmation page: the "Print Form" button's form is sent here first; a PDF answer is kept with the
  // application and downloaded. Anything else (or an error) goes on to the site exactly as before.
  function catchPrintForm(a) {
    const btn = [...document.querySelectorAll('input[type=submit],input[type=button],button')].find(b => /print\s*form/i.test(b.value || b.textContent || ''));
    const form = btn?.form;
    if (!form) return false;
    if (form.dataset.ivh) return true;
    form.dataset.ivh = '1';
    form.addEventListener('submit', async e => {
      if (e.defaultPrevented || form.dataset.ivhPass) return;
      e.preventDefault();
      const body = new URLSearchParams(new FormData(form));
      if (e.submitter?.name) body.set(e.submitter.name, e.submitter.value);
      const get = (form.method || 'get').toLowerCase() === 'get';
      const url = form.action || location.href;
      try {
        const res = await fetch(get ? url + (url.includes('?') ? '&' : '?') + body : url, { method: get ? 'GET' : 'POST', body: get ? undefined : body, credentials: 'same-origin' });
        const buf = await res.arrayBuffer();
        if (new TextDecoder().decode(buf.slice(0, 5)) === '%PDF-') return pdfArrived(a, new Blob([buf], { type: 'application/pdf' }));
      } catch { /* fall through to the site's own handling */ }
      form.dataset.ivhPass = '1';
      HTMLFormElement.prototype.submit.call(form);
    });
    return true;
  }

  async function pdfArrived(a, blob) {
    const name = IVH.appPdfName(a);
    const dataUrl = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    await IVH.saveApplication({ id: a.id, pdf: { name, size: blob.size, dataUrl, at: Date.now() } });
    await IVH.store.set('siteJob', null);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    status(`${t('fpPrintSaved')} ${name}`, 'ok', [], { jobPage: true });
  }

  // Wrong captcha or details: the reprint form comes back with messages. Show them, take the new form token
  // and captcha, and let the applicant try again. Any other page is shown as the site sent it.
  function printHtmlArrived(form, html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const again = doc.querySelector('form[action*="PrintApplication"]');
    if (!again) {
      document.open();
      document.write(html);
      document.close();
      ui = null;
      return status(t('fpPrintPage'), 'warn', [], { jobPage: true });
    }
    const msgs = [...doc.querySelectorAll('.error, .alert, .errorMessage, font[color], span[style*="red"], label.error, div[style*="red"]')]
      .map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(x => x && x.length < 200);
    const token = doc.querySelector('input[name="token"]')?.value;
    if (token && form.elements.token) form.elements.token.value = token;
    form.elements.captcha.value = '';
    runOps([{ op: 'call', fn: 'refreshCaptcha' }, { op: 'focus', id: 'captcha' }]);
    status(t('fpPrintError'), 'warn', [...new Set(msgs)].slice(0, 5), { jobPage: true });
  }

  async function statusJob(a, p, job) {
    const text = document.body.innerText;
    // The result page repeats the Application Id as text (typed values in the inputs are not part of innerText).
    if (job.stage === 'submitted') {
      if (text.toUpperCase().includes(a.id)) return statusResult(a);
      await IVH.store.set('siteJob', { ...job, stage: 'filled' });
      status(t('fpStatusNone'), 'warn', [], { jobPage: true });
    }
    const form = document.querySelector('form[action*="StatusEnquiry"]');
    if (!form) return;
    const issues = (await runOps([
      { op: 'set', id: 'application_id', value: a.id },
      { op: 'set', id: 'passport_no', value: a.passportNo || p?.passportNo },
      { op: 'focus', id: 'captcha' },
    ])).filter(r => typeof r === 'string');
    if (job.stage !== 'submitted') status(t('fpStatusCaptcha'), issues.length ? 'warn' : 'ok', issues, { jobPage: true });
    if (form.dataset.ivh) return;
    form.dataset.ivh = '1';
    form.addEventListener('submit', e => {
      if (!e.defaultPrevented) IVH.store.set('siteJob', { ...job, stage: 'submitted', at: Date.now() });
    });
  }

  // Keeps the result rows (label → value) and picks the status line from them.
  async function statusResult(a) {
    const rows = [...document.querySelectorAll('tr')]
      .map(tr => [...tr.children].map(c => c.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean))
      .filter(r => r.length >= 2 && r.join(' ').length < 300 && !isFormRow(r));
    const pick = rows.find(r => /status/i.test(r[0])) || rows.find(r => /status/i.test(r.join(' ')));
    const textLine = document.body.innerText.split('\n').map(x => x.trim()).find(x => /status|process|granted|issued|rejected|received|dispatched|ready/i.test(x) && x.length < 200);
    const statusText = (pick ? pick[pick.length - 1] : textLine) || '—';
    const all = (await IVH.store.list('applications')).find(x => x.id === a.id) || a;
    const check = { text: statusText, rows: rows.slice(0, 15), at: Date.now() };
    await IVH.saveApplication({ id: a.id, status: check, checks: [check, ...(all.checks || [])].slice(0, 20).map(c => ({ text: c.text, at: c.at })) });
    await IVH.store.set('siteJob', null);
    status(`${t('fpStatusSaved')} ${statusText}`, 'ok', [], { jobPage: true });
  }
  const isFormRow = r => /please enter|enter 12 characters|captcha/i.test(r.join(' '));

  // ---- main ----
  async function fillPage(manual = false) {
    cancelCountdown();
    const settings = await IVH.settings();
    IVH.setLang(settings.lang);
    if (page === 'PrintApplication' || page === 'StatusEnquiry') return jobPage();
    const s = await IVH.store.get('session');
    if (!s?.active) {
      if (plan || /Temporary Application ID/i.test(document.body.innerText)) {
        panel().mini.hidden = false;
      }
      return;
    }
    // The site only opens Registration through the home page link (it runs verify()); a direct URL bounces
    // back here. Start in the side panel sets startPending, and we follow the link once.
    if (page === 'index.html' || page === 'visa') {
      if (s.startPending) {
        await IVH.store.set('session', { ...s, startPending: false });
        // 'resume' goes to "Complete Partially Filled Form", where the Temporary ID is filled in.
        await runOps([s.startPending === 'resume' ? { op: 'click', selector: 'a[href="CompletePartially"]' } : { op: 'call', fn: 'verify' }]);
      }
      return;
    }

    const ctx = await loadContext(s);
    if (!ctx) return status(t('needApplicant'), 'warn');
    const u = panel();
    u.who.textContent = IVH.fullName(ctx.p) + (s.tempId ? ` · ${s.tempId}` : '');
    u.pause.textContent = t(s.paused ? 'fpResume' : 'fpPause');
    // Never fill another application's page with this applicant's data.
    const onPage = pageTempId();
    if (s.tempId && onPage && onPage !== s.tempId) {
      return status(`${t('fpOtherApp')} ${onPage} ≠ ${s.tempId}`, 'warn');
    }
    await rememberTempId(s, ctx.p);

    // The page after "Verified and Continue" shows the Application Id: keep it with the applicant.
    // (Temporary IDs are 15 characters, so form pages never match.)
    const appId = pageAppId();
    if (appId) {
      u.pg.textContent = plan?.title || page;
      const a = await recordSubmitted(ctx, appId);
      // The site's "Print Form" gives the application PDF: it is caught on its way, downloaded as usual and kept
      // in the history, so nothing has to be downloaded again. The helper is then ready for the next application.
      const caught = catchPrintForm(a);
      return status(`✅ ${t('fpAppSaved')} ${appId}. ${t(caught ? 'fpPrintFormHint' : 'fpPdfBySite')} ${t('fpReadyNext')}`, 'ok', [], { jobPage: true });
    }

    if (!plan) {
      u.pg.textContent = page;
      if (/Temporary Application ID/i.test(document.body.innerText)) status(t('fpUnknown'), 'warn');
      return;
    }
    u.pg.textContent = plan.title;
    // Photo and document pages go through several steps on one URL; the step is part of the page key.
    ctx.state = plan.state ? plan.state(ctx) : '';
    const key = page + (ctx.state ? ':' + ctx.state : '');

    // Coming back to the step we just auto-submitted means the server rejected it: leave its error messages alone.
    const fresh = await IVH.store.get('session');
    if (!manual && fresh.lastAuto?.page === key && Date.now() - fresh.lastAuto.at < 90000) {
      await IVH.store.set('session', { ...fresh, lastAuto: null, paused: true });
      u.pause.textContent = t('fpResume');
      // Medical: the server refuses a letter issued for another passport; say so plainly.
      const wrongLetter = [...document.querySelectorAll('span,div,label,td')].some(e => !e.children.length && e.offsetParent && /issued on the same passport/i.test(e.textContent));
      if (wrongLetter) return status(`${t('medLetterWrongPassport')} ${ctx.s.medicalLetterNo || ''} ≠ ${ctx.p.passportNo || ''}`, 'warn');
      return status(t('fpStuck'), 'warn');
    }

    // After the final review the application is complete: pages opened with the site's "Modify" are the user's
    // own edits, so nothing is filled or clicked unless they ask for it ("Fill this page").
    // Upload pages are an exception once the user asks: "Fill this page" there finishes the upload steps
    // (upload, crop, save) like normal filling; on form pages it only fills and never clicks.
    const uploadPage = page === 'PhotoUpload' || page === 'DocumentUpload';
    // Leaving that upload page ends the exception, so a later visit asks again.
    if (fresh.editFill && fresh.editFill !== page) { fresh.editFill = null; await IVH.store.set('session', { ...fresh }); }
    if (!manual && fresh.reviewed && plan.after !== 'final' && !(uploadPage && fresh.editFill === page)) {
      return status(t('fpEditing'), 'ok', [], { jobPage: true, action: { label: '↻ ' + t('fpFillThis'), onclick: async () => {
        if (!uploadPage) return fillPage(true);
        await IVH.store.set('session', { ...(await IVH.store.get('session')), editFill: page, lastAuto: null, paused: false });
        fillPage();
      } } });
    }

    status(t('fpFilling'));
    const ops = plan.plan(ctx);
    const results = await runOps(ops);
    // Results line up with ops; one extra entry may report dropdowns the site reset after filling.
    const issues = results.flatMap((r, i) => (typeof r === 'string' ? [ops[i] && ops[i].op !== 'fail' ? `${ops[i].id || ops[i].op}: ${r}` : r] : []));

    if (IVH.monthsUntil(ctx.p.passportExpiry) < 6) issues.unshift(t('passportWarn'));
    // Site-change alarm: when several of the page's known fields are gone, the page itself has probably changed.
    if (issues.filter(i => /missing (field|button|upload field) /.test(i)).length >= 3) issues.unshift(t('fpSiteChanged'));

    // Medical: keep the hospital the invitation-letter lookup returned in the Hospitals list.
    const lookup = results.find(r => r && typeof r === 'object' && r.hospital);
    if (lookup) {
      const saved = await saveLetterHospital(lookup.hospital, ctx.s);
      // The Email box must belong to the letter's hospital, not to whichever hospital the Start screen had.
      await runOps([{ op: 'serviceByLabel', onlyMatched: true, rules: [{ re: '^email', value: saved.email || '' }] }]);
      if (!saved.email) {
        const i = issues.findIndex(x => /Email ID/i.test(x));
        const hint = `${t('medHospitalEmail')} ${saved.name}`;
        if (i >= 0) issues[i] = hint; else issues.push(hint);
      }
    }

    const after = typeof plan.after === 'function' ? plan.after(ctx) : plan.after;
    if (after === 'captcha') return status(t('fpCaptcha'), issues.length ? 'warn' : 'ok', issues);
    // Pages that end with a checkbox statement and a button: Additional questions (declaration → Save and Continue)
    // and Document upload (verification → Confirm). Settings → "Tick declarations automatically" (owner's decision,
    // on by default): after a countdown the box is ticked and the button clicked; Pause stops it. With the setting
    // off, or when something needs checking, one click on the panel button does the same.
    const tick = { declaration: [declarationBox, saveContinueButton, 'fpDeclareAuto', 'fpDeclareConfirm'], docsDone: [verifyDocsBox, confirmButton, 'fpDocsAuto', 'fpDocsConfirm'] }[after];
    if (tick) {
      const box = tick[0](), button = tick[1]();
      if (!box || !button) return status(t(after === 'declaration' ? 'fpDeclaration' : 'fpDocsDone'), 'warn', issues);
      const tickAndGo = async () => {
        if (!box.checked) box.click();
        // Coming back to this page afterwards means the site refused it (see the lastAuto check above).
        await IVH.store.set('session', { ...(await IVH.store.get('session')), lastAuto: { page: key, at: Date.now() } });
        button.click();
      };
      const confirmOnly = list => status(t(tick[3]), 'warn', list, { action: { label: '✓ ' + t('fpDeclareBtn'), onclick: tickAndGo } });
      const latest = await IVH.store.get('session');
      if (settings.autoDeclare === false || !settings.autoAdvance || latest.paused || issues.length || manual) return confirmOnly(issues);
      let left = Math.max(3, Math.round(settings.delayMs / 1000)); // time to press Pause
      status(`${t(tick[2])} ${left}…`, 'ok');
      countdown = setInterval(async () => {
        left -= 1;
        if (left > 0) return status(`${t(tick[2])} ${left}…`, 'ok');
        cancelCountdown();
        const now = await IVH.store.get('session');
        if (!now?.active || now.paused) return confirmOnly([]);
        tickAndGo();
      }, 1000);
      return;
    }
    // Final review: the helper stops here (no Fill again / Pause / Stop) and only waits for the user's own
    // "Verified and Continue", to save the Application ID and then the PDF.
    if (after === 'final') {
      const cur = await IVH.store.get('session');
      if (cur && !cur.reviewed) await IVH.store.set('session', { ...cur, reviewed: true });
      return status(t('fpFinal'), 'ok', issues, { jobPage: true });
    }

    const next = plan.next ? plan.next(ctx) : { op: 'click', id: 'continue' };
    const latest = await IVH.store.get('session');
    if (!plan.auto || !next || !settings.autoAdvance || latest.paused || issues.length || manual) {
      return status(t('fpDone'), issues.length ? 'warn' : 'ok', issues);
    }

    let left = Math.max(1, Math.round(settings.delayMs / 1000));
    status(`${t('fpNext')} ${left}…`, 'ok');
    countdown = setInterval(async () => {
      left -= 1;
      if (left > 0) return status(`${t('fpNext')} ${left}…`, 'ok');
      cancelCountdown();
      const now = await IVH.store.get('session');
      if (!now?.active || now.paused) return status(t('fpDone'), 'ok');
      // A dependent list (State → District) can be refilled late and wipe a choice; repair it or stop here.
      const [late] = await runOps([{ op: 'repairSelects' }]);
      if (late) return status(t('fpDone'), 'warn', [late]);
      await IVH.store.set('session', { ...now, lastAuto: { page: key, at: Date.now() } });
      await runOps([next]);
    }, 1000);
  }

  // Start filling when the side panel starts a session while this page is open.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.session) return;
    const { oldValue: o, newValue: n } = changes.session;
    // A new start/resume goes through the home page; a form page still open must not pick it up.
    if (n?.startPending && page !== 'index.html' && page !== 'visa') return;
    if (n?.active && (!o?.active || o.startedAt !== n.startedAt)) fillPage();
  });
  chrome.runtime.onMessage.addListener(msg => { if (msg?.type === 'fillNow') fillPage(true); });

  loadFieldMap().finally(() => fillPage());
})();
