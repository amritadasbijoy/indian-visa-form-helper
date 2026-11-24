// Runs in the page's own JS world so it can use the site's jQuery handlers (onchange AJAX loaders,
// chosen-select widgets). The isolated content script sends it a list of operations via postMessage.
(() => {
  if (window.__ivhBridge) return;
  window.__ivhBridge = true;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = () => window.jQuery;
  const norm = s => (s || '').replace(/\s+/g, ' ').trim().toUpperCase();

  async function waitFor(fn, timeout = 8000, step = 150) {
    const end = Date.now() + timeout;
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() > end) return null;
      await sleep(step);
    }
  }

  function fire(el, names) {
    const jq = $();
    for (const n of names) {
      if (jq) jq(el).trigger(n);
      else el.dispatchEvent(new Event(n, { bubbles: true }));
    }
  }

  // Finds the option to select: exact value, then exact text, then text that starts with the wanted text.
  function findOption(el, value, byText) {
    const want = norm(String(value));
    const options = [...el.options];
    if (!byText) {
      const o = options.find(o => o.value === String(value)) || options.find(o => norm(o.value) === want);
      if (o) return o;
    }
    const byName = w => options.find(o => norm(o.text) === w) || options.find(o => o.value && norm(o.text).startsWith(w));
    // District names the site writes differently: without a "district" word ("KOLKATA DISTRICT" → "KOLKATA"), or
    // only the city for a part of it ("CENTRAL DELHI" / "SOUTH WEST DELHI" → "DELHI": the site lists Delhi as
    // DELHI, NEW DELHI, NOT KNOWN). The last word must match an option exactly.
    const shorter = want.replace(/\s+(DISTRICT|DIST\.?)$/, '');
    const last = want.split(' ').pop();
    return byName(want) || (shorter !== want ? byName(shorter) : undefined) ||
      (last !== want ? options.find(o => o.value && norm(o.text) === last) : undefined);
  }

  // Selects set during the current request, re-checked at the end in case an AJAX reload reset them.
  // lastSelects keeps the previous request's list for the check just before auto-advance clicks Continue.
  let setSelects = [];
  let lastSelects = [];

  // `reloads`: id of a dependent select (e.g. District) that the site refills over AJAX when this one changes.
  // Before that, District holds every district in India, so we must wait for the refill before choosing.
  async function setValue({ id, value, byText, events = true, timeout, reloads }) {
    const el = await waitFor(() => document.getElementById(id), 3000);
    if (!el) return `missing field #${id}`;
    if (value === undefined || value === null) return null;
    if (el.tagName === 'SELECT') {
      if (value === '') return null;
      const opt = await waitFor(() => findOption(el, value, byText), timeout ?? 8000);
      if (!opt) return `no option "${value}" in #${id}`;
      const unchanged = el.value === opt.value;
      const dep = reloads && document.getElementById(reloads);
      const before = dep ? [...dep.options].map(o => o.value).join('|') : '';
      el.value = opt.value;
      setSelects.push({ el, value: opt.value, text: opt.text });
      if (events) fire(el, ['input', 'keyup', 'change', 'blur']);
      if (el.classList.contains('chosen-select') && $()) $()(el).trigger('chosen:updated');
      if (dep && !unchanged) {
        await waitFor(() => [...dep.options].map(o => o.value).join('|') !== before, 10000);
        await waitStable(dep);
      }
      return null;
    }
    // Setting .value skips the box's maxlength; cut to it like typing would, and say so (stops auto-advance).
    const text = String(value);
    const max = el.maxLength > 0 ? el.maxLength : 0;
    el.value = max ? text.slice(0, max) : text;
    if (events) fire(el, ['input', 'keyup', 'change', 'blur']);
    return max && text.length > max ? `#${id}: shortened to ${max} characters ("${el.value}") — check it` : null;
  }

  // The site may refill a dependent list more than once; wait until it has stopped changing for ~1 s.
  async function waitStable(select, quietMs = 1000, timeout = 10000) {
    const sig = () => [...select.options].map(o => o.value).join('|');
    let last = sig(), since = Date.now();
    const end = Date.now() + timeout;
    while (Date.now() < end && Date.now() - since < quietMs) {
      await sleep(150);
      const now = sig();
      if (now !== last) { last = now; since = Date.now(); }
    }
  }

  // Re-checks every select set in this request; one reset by a late AJAX refill is set again (twice at most)
  // before it is reported, so auto-advance only stops when the value really won't stay.
  async function recheckSelects(list = setSelects) {
    lastSelects = list;
    let lost = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      await sleep(attempt ? 1200 : 700);
      lost = list.filter(s => s.el.isConnected && s.el.value !== s.value);
      if (!lost.length || attempt === 2) break;
      for (const s of lost) {
        await waitStable(s.el, 600, 5000);
        const opt = [...s.el.options].find(o => o.value === s.value);
        if (!opt) continue;
        s.el.value = s.value;
        fire(s.el, ['change', 'blur']);
      }
    }
    setSelects = [];
    return lost.map(s => `#${s.el.id} was reset (wanted "${s.text}")`);
  }

  async function setChecked({ id, value }) {
    const el = await waitFor(() => document.getElementById(id), 3000);
    if (!el) return `missing field #${id}`;
    if (el.type === 'radio') {
      if (!el.checked) el.click();
      el.checked = true;
    } else if (el.checked !== !!value) {
      el.click();
    }
    return null;
  }

  // Visa-type specific inputs share one name and get numeric ids; match them by the label beside them.
  function serviceFields() {
    return [...document.querySelectorAll('[name=service_req_form_values]')].map(el => {
      const row = el.closest('.row') || el.parentElement;
      const label = (row?.querySelector('.col-31')?.innerText || row?.innerText || '').replace(/\s+/g, ' ').trim();
      return { el, label };
    });
  }

  // Rules are tried in order; `keepFilled` leaves a value the site already put there (e.g. from the
  // medical invitation lookup) alone. Hidden inputs are section headers, not fields.
  async function serviceByLabel({ rules, onlyMatched = false }) {
    const problems = [];
    for (const { el, label } of serviceFields()) {
      if (el.type === 'hidden') continue;
      const rule = rules.find(r => new RegExp(r.re, 'i').test(label));
      if (!rule) { if (!el.value && !onlyMatched) problems.push(`no data for "${label}"`); continue; }
      if (rule.keepFilled && el.value) continue;
      if (el.tagName === 'SELECT') {
        const opt = findOption(el, rule.value, true);
        if (opt) el.value = opt.value; else problems.push(`no option "${rule.value}" for "${label}"`);
      } else {
        el.value = String(rule.value ?? '').slice(0, el.maxLength > 0 ? el.maxLength : 500);
      }
      fire(el, ['input', 'change', 'blur']);
    }
    return problems.length ? problems.join('; ') : null;
  }

  async function upload({ id, selector, name, type, dataUrl }) {
    const el = await waitFor(() => (id ? document.getElementById(id) : document.querySelector(selector)), 5000);
    if (!el) return `missing upload field ${id || selector}`;
    const blob = await (await fetch(dataUrl)).blob();
    const dt = new DataTransfer();
    dt.items.add(new File([blob], name, { type: type || blob.type }));
    el.files = dt.files;
    fire(el, ['input', 'change']);
    return null;
  }

  // Medical visa: typing the invitation letter number and leaving the box makes the site look it up and fill
  // the Indian hospital. Its error popups are caught (they would block the page) and reported instead.
  async function medicalLookup({ value, letterRe = 'medical certificate|invitation', resultRe = '^hospital name' }) {
    const fields = serviceFields().filter(f => f.el.type !== 'hidden');
    const letter = fields.find(f => new RegExp(letterRe, 'i').test(f.label));
    const result = fields.find(f => new RegExp(resultRe, 'i').test(f.label));
    if (!letter) return 'no medical invitation letter field on this page';
    if (!value) return 'no medical invitation letter number in the Start screen';
    const alerts = [];
    const realAlert = window.alert;
    window.alert = msg => alerts.push(String(msg));
    try {
      if (result) result.el.value = '';
      letter.el.value = String(value).trim();
      // Run the site's lookup exactly once: every run appends its bold copy of the hospital details, so
      // firing input/change/blur through jQuery showed them three times. Call it directly when we can.
      if (typeof window.fetchHospitalData === 'function') window.fetchHospitalData(letter.el.value);
      else letter.el.dispatchEvent(new Event('blur'));
      await waitFor(() => alerts.length || (result && result.el.value), 12000, 200);
      await sleep(400);
    } finally {
      window.alert = realAlert;
    }
    if (alerts.length) return `medical letter: ${[...new Set(alerts)].join(' ')}`;
    if (result && !result.el.value) return 'medical letter: the site returned no hospital for this number';
    // The site's own code never fills the email, but its lookup answer includes it: ask once more and fill it.
    const email = await letterEmail(letter.el.value);
    const emailField = fields.find(f => /^email/i.test(f.label));
    if (email && emailField) {
      emailField.el.value = email;
      fire(emailField.el, ['change']);
    }
    // Hand the official hospital details back so the extension can keep them in its Hospitals list.
    const read = re => fields.find(f => new RegExp(re, 'i').test(f.label))?.el.value || '';
    return { hospital: { name: read('^hospital name'), address: read('^address$'), doctor: read('^doctor'), phone: read('^(phone|fax)'), email } };
  }

  // Same request the site's fetchHospitalData makes (POST json/fetchHospitalDetails); returns the email or ''.
  async function letterEmail(fileNumber) {
    try {
      const res = await fetch('json/fetchHospitalDetails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
        body: new URLSearchParams({ file_number: fileNumber }),
        credentials: 'same-origin',
      });
      const data = await res.json();
      return String(data?.email || '').trim();
    } catch {
      return '';
    }
  }

  // Document table rows have no usable ids; find them by the serial number in the first cell.
  const rowBySerial = serial => [...document.querySelectorAll('tr')].find(tr => tr.cells.length >= 4 && tr.cells[0].innerText.trim() === String(serial));

  async function uploadRow({ serial, name, type, dataUrl }) {
    const row = rowBySerial(serial);
    const input = row && [...row.querySelectorAll('input[type=file]')].find(f => f.offsetParent);
    if (!input) return `no upload box in row ${serial}`;
    const blob = await (await fetch(dataUrl)).blob();
    const dt = new DataTransfer();
    dt.items.add(new File([blob], name, { type: type || blob.type }));
    input.files = dt.files;
    fire(input, ['change']);
    if ($()) $()('#doc_id').val(String(serial));
    return null;
  }

  const OPS = {
    fail: async ({ message }) => message,
    medicalLookup,
    // Run right before the auto-advance click: catches a dependent list refilled after the page was filled.
    repairSelects: async () => {
      const lost = await recheckSelects(lastSelects);
      return lost.length ? lost.join('; ') : null;
    },
    uploadRow,
    clickRow: async ({ serial, value }) => {
      const btn = rowBySerial(serial)?.querySelector(`input[type=submit][value="${value}"]`);
      if (!btn) return `no "${value}" button in row ${serial}`;
      btn.click();
      return null;
    },
    set: setValue,
    check: setChecked,
    radio: o => setChecked({ ...o, value: true }),
    wait: ({ ms }) => sleep(ms).then(() => null),
    waitVisible: async ({ id, timeout }) => ((await waitFor(() => document.getElementById(id)?.offsetParent, timeout ?? 5000)) ? null : `#${id} did not appear`),
    click: async ({ id, selector }) => {
      const el = id ? document.getElementById(id) : document.querySelector(selector);
      if (!el) return `missing button ${id || selector}`;
      el.click();
      return null;
    },
    focus: async ({ id }) => { document.getElementById(id)?.focus(); return null; },
    call: async ({ fn }) => { if (typeof window[fn] === 'function') window[fn](); return null; },
    serviceByLabel,
    serviceLabels: async () => serviceFields().map(f => f.label),
    upload,
  };

  window.addEventListener('message', async e => {
    const msg = e.data;
    if (e.source !== window || msg?.ivh !== 'req') return;
    const results = [];
    setSelects = [];
    for (const op of msg.ops) {
      try {
        const r = await OPS[op.op](op);
        results.push(r);
        if (op.op !== 'wait' && op.gap !== 0) await sleep(op.gap ?? 60);
      } catch (err) {
        results.push(`${op.op} ${op.id || ''}: ${err.message}`);
      }
    }
    // A field the site silently reset must stop auto-advance; report it as an extra problem.
    const lost = msg.ops.some(o => o.op === 'set') ? await recheckSelects() : [];
    if (lost.length) results.push(lost.join('; '));
    window.postMessage({ ivh: 'res', id: msg.id, results }, '*');
  });
})();
