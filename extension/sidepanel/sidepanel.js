// Side panel: start screen, applicant / hotel / hospital / reference managers, imports and settings.
const IVH = globalThis.IVH;
const t = k => IVH.t(k);
const tl = o => IVH.tl(o);

// ---------- small DOM helpers ----------
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}
const $ = s => document.querySelector(s);
// replaceChildren() would print null/false as text, so drop them first.
const setKids = (el, ...kids) => el.replaceChildren(...kids.flat().filter(k => k !== null && k !== undefined && k !== false));
const opt = (value, text, selected) => h('option', { value, selected: selected ? true : undefined }, text);

let toastTimer;
function toast(msg, ms = 2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

function pickFile(accept, multiple = false) {
  return new Promise(resolve => {
    const input = $('#filePick');
    input.accept = accept;
    input.multiple = multiple;
    input.value = '';
    input.onchange = () => resolve(multiple ? [...input.files] : input.files[0]);
    // Closing the file dialog without a file: finish instead of waiting forever.
    input.oncancel = () => resolve(multiple ? [] : null);
    input.click();
  });
}

// Drag and drop from Finder / File Explorer: a dashed box that takes one passport photo or PDF.
const isScanFile = f => !!f && (/^image\//.test(f.type) || f.type === 'application/pdf' || /\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name));
function scanDropZone(onFile) {
  const zone = h('div', { class: 'dropzone' }, '⬇ ' + t('scanDrop'));
  const has = e => [...(e.dataTransfer?.types || [])].includes('Files');
  zone.addEventListener('dragenter', e => { if (has(e)) { e.preventDefault(); zone.classList.add('over'); } });
  zone.addEventListener('dragover', e => { if (has(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('over'); });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('over');
    const file = e.dataTransfer.files[0];
    if (!isScanFile(file)) return toast('⚠ ' + t('scanDropBad'), 4000);
    onFile(file);
  });
  return zone;
}
// A file dropped anywhere else must not open in place of the side panel.
for (const ev of ['dragover', 'drop']) document.addEventListener(ev, e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });

function download(name, text, type = 'application/json') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- generic schema form ----------
// Dates are typed and shown as DD/MM/YYYY (as people in Bangladesh write them); records keep YYYY-MM-DD.
const isoToDmy = iso => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : '');
const dmyToIso = v => {
  const s = String(v || '').trim();
  const m = /^(\d{1,2})\D+(\d{1,2})\D+(\d{4})$/.exec(s) || /^(\d{2})(\d{2})(\d{4})$/.exec(s);
  if (!m) return '';
  const [d, mo, y] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (y < 1900 || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};
// A DD/MM/YYYY text box (slashes added while typing) with a 📅 button that opens Chrome's calendar.
function dateBox(iso) {
  const text = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'DD/MM/YYYY', maxLength: 10, autocomplete: 'off', value: isoToDmy(iso) });
  const pick = h('input', { type: 'date', tabindex: '-1', 'aria-hidden': 'true', class: 'datebox-pick' });
  text.addEventListener('input', e => {
    if (String(e.inputType || '').startsWith('delete') || /[^\d/]/.test(text.value)) return;
    const d = text.value.replace(/\D/g, '').slice(0, 8);
    text.value = d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  });
  pick.addEventListener('change', () => {
    text.value = isoToDmy(pick.value);
    for (const ev of ['input', 'change']) text.dispatchEvent(new Event(ev, { bubbles: true }));
  });
  const btn = h('button', { type: 'button', class: 'datebox-btn', title: t('pickDate'), onclick: e => {
    e.preventDefault();
    pick.value = dmyToIso(text.value);
    try { pick.showPicker(); } catch { pick.click(); }
  } }, '📅');
  return { el: h('span', { class: 'datebox' }, text, btn, pick), text };
}

function renderForm(schema, record) {
  const rec = { ...IVH.defaultsFor(schema), ...record };
  const wrap = h('div');
  const rows = [];
  for (const g of schema) {
    const card = h('div', { class: 'card' }, h('h3', {}, tl(g)));
    for (const f of g.fields) {
      const label = h('span', {}, tl(f), f.req ? h('span', { class: 'req' }, ' *') : null);
      let input, row;
      if (f.type === 'bool') {
        input = h('input', { type: 'checkbox', checked: !!rec[f.k] });
        row = h('label', { class: 'chk' }, input, tl(f));
      } else {
        if (f.type === 'select') {
          input = h('select', {}, opt('', '—'), ...f.options().map(([v, txt]) => opt(v, txt, String(rec[f.k] ?? '') === String(v))));
        } else if (f.type === 'textarea') {
          input = h('textarea', {}, rec[f.k] || '');
        } else if (f.type === 'date') {
          const box = dateBox(rec[f.k]);
          input = box.text;
          row = h('label', { class: 'f' }, label, box.el);
        } else {
          input = h('input', { type: 'text', value: rec[f.k] ?? '', maxLength: f.max || undefined });
          if (f.list) {
            const id = 'dl-' + f.k + Math.random().toString(36).slice(2, 6);
            input.setAttribute('list', id);
            row = h('label', { class: 'f' }, label, input, h('datalist', { id }));
          }
        }
        row = row || h('label', { class: 'f' }, label, input);
      }
      input.dataset.k = f.k;
      const sync = () => {
        rec[f.k] = f.type === 'bool' ? input.checked : f.type === 'date' ? dmyToIso(input.value) : input.value;
        if (rec[f.k + 'Guessed']) rec[f.k + 'Guessed'] = false;
        // Typing a phone number confirms it (it no longer comes from the passport).
        if ((f.k === 'phone' || f.k === 'mobile') && rec.mobileFromPassport) rec.mobileFromPassport = false;
        refresh();
      };
      input.addEventListener('change', sync);
      for (const ev of ['input', 'change']) input.addEventListener(ev, () => { if (String(input.value ?? '').trim() || input.checked) input.classList.remove('missing'); });
      input.addEventListener('input', () => { if (f.type !== 'bool') rec[f.k] = f.type === 'date' ? dmyToIso(input.value) : input.value; });
      rows.push({ f, row, input });
      card.append(row);
    }
    wrap.append(card);
  }
  function refresh() {
    for (const { f, row, input } of rows) {
      row.hidden = f.show ? !f.show(rec) : false;
      if (f.list) {
        const dl = row.querySelector('datalist');
        dl.replaceChildren(...f.list(rec).map(v => h('option', { value: v })));
      }
      if (f.type === 'date') {
        // Keep what was typed while it is not a real date yet, and mark it.
        const want = isoToDmy(rec[f.k]);
        if (document.activeElement !== input && (want || !input.value.trim())) input.value = want;
        input.classList.toggle('bad', !!input.value.trim() && !rec[f.k]);
      } else if (input.tagName === 'INPUT' && input.type === 'text' && document.activeElement !== input) input.value = rec[f.k] ?? '';
    }
  }
  refresh();
  return {
    el: wrap,
    read() {
      const out = { ...record, ...rec };
      for (const { f } of rows) {
        if (typeof out[f.k] === 'string' && f.type !== 'date' && f.type !== 'select') out[f.k] = out[f.k].replace(/\s+/g, ' ').trim().toUpperCase();
      }
      if (out.email) out.email = out.email.toLowerCase();
      return out;
    },
    // Required fields still empty (used on Save): they are outlined in red and the first one is scrolled to and
    // focused, so the user goes straight to what is missing. The red goes away as soon as the field is filled.
    missing() {
      const empty = rows.filter(({ f, row }) => f.req && !row.hidden && !String(rec[f.k] ?? '').trim());
      for (const { input } of rows) input.classList.remove('missing');
      for (const { input } of empty) input.classList.add('missing');
      if (empty.length) {
        const first = empty[0].input;
        first.scrollIntoView({ block: 'center', behavior: 'smooth' });
        first.focus({ preventScroll: true });
      }
      return empty.map(({ f }) => tl(f));
    },
    set(values) { Object.assign(rec, values); for (const { f, input } of rows) { if (f.type === 'bool') input.checked = !!rec[f.k]; else input.value = f.type === 'date' ? isoToDmy(rec[f.k]) : rec[f.k] ?? ''; } refresh(); },
  };
}

// ---------- generic collection tab (hotels, hospitals, references) ----------
function collectionTab({ key, schema, section, describe, extraToolbar, extraBottom }) {
  let query = '';
  async function showList() {
    const items = (await IVH.store.list(key)).filter(x => JSON.stringify(x).toUpperCase().includes(query.toUpperCase()));
    items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const search = h('input', { type: 'search', placeholder: t('search'), value: query, oninput: e => { query = e.target.value; showList().then(() => section.querySelector('input[type=search]').focus()); } });
    setKids(section, 
      h('div', { class: 'toolbar' }, h('button', { class: 'primary', onclick: () => showEditor({}) }, '+ ' + t('add')), ...(extraToolbar ? extraToolbar(showList) : [])),
      search,
      h('div', { class: 'list', style: 'margin-top:8px' },
        items.length ? items.map(it => h('div', { class: 'item' },
          h('div', { class: 'txt' }, h('div', { class: 'ttl' }, it.name || '—'), h('div', { class: 'sub' }, describe(it))),
          h('button', { onclick: () => showEditor(it) }, t('edit')),
          h('button', { class: 'danger', onclick: async () => { if (confirm(t('confirmDelete'))) { await IVH.store.remove(key, it.id); showList(); refreshStart(); } } }, '✕'),
        )) : h('div', { class: 'empty' }, t('nothingYet'))),
      ...(extraBottom ? extraBottom(showList) : []),
    );
  }
  function showEditor(item) {
    const form = renderForm(schema, item);
    setKids(section, form.el, h('div', { class: 'sticky-actions' },
      h('button', { onclick: showList }, t('cancel')),
      h('button', { class: 'primary', onclick: async () => {
        const miss = form.missing();
        if (miss.length) return toast('⚠ ' + miss.join(', '), 3500);
        await IVH.store.upsert(key, form.read());
        toast(t('saved'));
        showList();
        refreshStart();
      } }, t('save'))));
  }
  return { showList, showEditor };
}

// ---------- applicants ----------
const profilesSection = () => $('#tab-profiles');
let profileQuery = '';
let showArchived = false;

async function showProfiles() {
  const sec = profilesSection();
  const [tempIds, apps] = await Promise.all([IVH.store.list('tempIds'), IVH.store.list('applications')]);
  const all = await IVH.store.list('profiles');
  const archivedCount = all.filter(p => p.archived).length;
  if (!archivedCount) showArchived = false;
  const items = all.filter(p => !!p.archived === showArchived).filter(p => JSON.stringify([p.surname, p.givenName, p.passportNo, ...tempIdsOf(p, tempIds).map(x => x.id), ...IVH.applicationsOf(p, apps).map(x => x.id)]).toUpperCase().includes(profileQuery.toUpperCase()));
  items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  setKids(sec, 
    h('div', { class: 'toolbar' },
      h('button', { class: 'primary', onclick: () => editProfile({ visaType: 'tourist' }) }, '+ ' + t('newTourist')),
      h('button', { class: 'primary', onclick: () => editProfile({ visaType: 'medical' }) }, '+ ' + t('newMedical')),
      h('button', { onclick: importBgdPdf }, '📄 ' + t('importBgd')),
      h('button', { onclick: () => scanPassportInto(null) }, '🛂 ' + t('scanPassport')),
      h('button', { onclick: () => scanPassportInto(null, true), title: t('aiScanHint') }, '✨ ' + t('aiScan'), h('span', { class: 'badge paid' }, t('paid'))),
      archivedCount ? h('button', { onclick: () => { showArchived = !showArchived; showProfiles(); } }, showArchived ? t('archivedBack') : '📦 ' + t('archived').replace('{n}', archivedCount)) : null),
    scanDropZone(file => scanPassportInto(null, false, file)),
    showArchived ? h('div', { class: 'note' }, t('archivedHelp')) : overviewCard(all, apps),
    h('input', { type: 'search', placeholder: t('search'), value: profileQuery, oninput: e => { profileQuery = e.target.value; showProfiles().then(() => sec.querySelector('input[type=search]').focus()); } }),
    h('div', { class: 'list', style: 'margin-top:8px' },
      items.length ? items.map(p => {
        const months = IVH.monthsUntil(p.passportExpiry);
        return h('div', { class: 'item' },
          p.photo ? h('img', { src: p.photo, alt: '' }) : h('img', { alt: '' }),
          h('div', { class: 'txt' },
            h('div', { class: 'ttl' }, IVH.fullName(p) || '—', ' ', visaBadge(p), p.example ? h('span', { class: 'badge opt' }, t('exBadge')) : null, months < 6 ? h('span', { class: 'badge', title: t('passportWarn') }, '⚠ < 6m') : null),
            h('div', { class: 'sub' }, [p.passportNo, p.passportExpiry && '→ ' + IVH.toSiteDate(p.passportExpiry), p.presDistrict].filter(Boolean).join(' · ')),
            tempIdsOf(p, tempIds)[0] ? h('div', { class: 'sub' }, '🆔 ', h('code', {}, tempIdsOf(p, tempIds)[0].id)) : null,
            IVH.applicationsOf(p, apps)[0] ? h('div', { class: 'sub' }, '📨 ', h('code', {}, IVH.applicationsOf(p, apps)[0].id),
              IVH.applicationsOf(p, apps)[0].status ? ' · ' + IVH.applicationsOf(p, apps)[0].status.text : '') : null),
          h('button', { onclick: () => editProfile(p) }, t('edit')),
          h('button', { title: t(IVH.profileVisaType(p) === 'medical' ? 'copyAsTourist' : 'copyAsMedical'), onclick: () => copyProfileAs(p) }, '⧉'),
          h('button', { title: p.archived ? t('restore') : t('archiveTip'), onclick: async () => {
            await IVH.store.upsert('profiles', { ...p, archived: !p.archived });
            toast(p.archived ? t('restore') + ' ✓' : t('archive') + ' ✓');
            showProfiles();
            refreshStart();
          } }, p.archived ? '↩' : '📦'),
          h('button', { class: 'danger', onclick: async () => { if (confirm(t('confirmDelete'))) { await IVH.store.remove('profiles', p.id); showProfiles(); refreshStart(); } } }, '✕'));
      }) : h('div', { class: 'empty' }, t('nothingYet'))),
  );
}

// Agency overview: applications per week (last 8 weeks), results, applicants and passports running out.
function overviewCard(profiles, apps) {
  if (!profiles.length) return null;
  const week = 7 * 864e5, now = Date.now();
  const weeks = Array.from({ length: 8 }, (_, i) => apps.filter(a => a.submittedAt && now - a.submittedAt >= (7 - i) * week && now - a.submittedAt < (8 - i) * week).length);
  const max = Math.max(1, ...weeks);
  const granted = apps.filter(a => /grant|issued|approv/i.test(a.status?.text || '')).length;
  const refused = apps.filter(a => /reject|refus|denied/i.test(a.status?.text || '')).length;
  const expiring = profiles.filter(p => !p.archived && p.passportExpiry && IVH.monthsUntil(p.passportExpiry) < 12).length;
  const stat = (n, label) => h('div', { style: 'flex:1;text-align:center' }, h('div', { style: 'font-size:20px;font-weight:700;color:var(--navy)' }, String(n)), h('div', { class: 'sub', style: 'color:var(--muted);font-size:12px' }, label));
  return h('details', { class: 'card', style: 'padding:10px 12px' },
    h('summary', { style: 'cursor:pointer;font-weight:600' }, '📊 ' + t('ovTitle')),
    h('div', { class: 'row', style: 'margin-top:8px' },
      stat(profiles.filter(p => !p.archived).length, t('ovApplicants')), stat(apps.length, t('ovApplications')), stat(granted, t('ovGranted')), stat(refused, t('ovRefused')), stat(expiring, t('ovExpiring'))),
    h('div', { style: 'margin-top:10px;font-size:12px;color:var(--muted)' }, t('ovWeeks')),
    h('div', { style: 'display:flex;align-items:flex-end;gap:4px;height:60px;margin-top:4px' },
      ...weeks.map(n => h('div', { title: String(n), style: `flex:1;background:var(--navy);opacity:${n ? 0.85 : 0.15};border-radius:3px 3px 0 0;height:${Math.max(4, Math.round((n / max) * 56))}px` }))));
}

const visaBadge = p => {
  const type = IVH.profileVisaType(p);
  return h('span', { class: 'badge ' + (type === 'medical' ? 'med' : 'tour') }, IVH.PROFILE_VISA_TYPES.find(x => x[0] === type)[IVH.lang() === 'bn' ? 2 : 1]);
};

// Copies an applicant into the other visa type (Tourist ⇄ Medical) with all details, photo and files, then opens
// the copy so the Medical documents (or anything else) can be added.
async function copyProfileAs(p) {
  const to = IVH.profileVisaType(p) === 'medical' ? 'tourist' : 'medical';
  const copy = JSON.parse(JSON.stringify(p));
  delete copy.id;
  delete copy.updatedAt;
  copy.visaType = to;
  const saved = await IVH.store.upsert('profiles', copy);
  toast(t(to === 'medical' ? 'copiedAsMedical' : 'copiedAsTourist'), 4000);
  refreshStart();
  editProfile(saved, t(to === 'medical' ? 'copiedAsMedical' : 'copiedAsTourist'));
}

// `pendingApp`: an application read from an imported BGD PDF, recorded once the applicant is saved.
function editProfile(profile, note, pendingApp) {
  const sec = profilesSection();
  const form = renderForm(IVH.PROFILE_SCHEMA, profile);
  const media = { photo: profile.photo || '', docs: [...(profile.docs || [])] };
  const mediaCard = h('div', { class: 'card' });

  const renderMedia = () => {
    setKids(mediaCard, 
      h('h3', {}, h('span', { class: 'badge req' }, t('docReqAll')), ' ', t('photo')),
      h('div', { class: 'row', style: 'align-items:flex-start' },
        media.photo ? h('img', { class: 'photo-thumb', src: media.photo, style: 'flex:0 0 96px' }) : h('div', { class: 'photo-thumb', style: 'flex:0 0 96px' }),
        h('div', {}, h('button', { onclick: async () => {
          const f = await pickFile('image/*');
          if (f) cropPhoto(f, url => { media.photo = url; renderMedia(); });
        } }, t('choosePhoto')), media.photo ? h('div', { class: 'sub', style: 'margin-top:6px;color:var(--muted)' }, '350×350 JPEG') : null)),
      h('h3', { style: 'margin-top:12px' }, t('documents')),
      h('div', { class: 'note' }, t('docsHelp')),
      h('button', { style: 'width:100%;margin-bottom:6px', onclick: () => undertakingDialog(form.read(), media, renderMedia) }, '✍ ' + t('utButton')),
      h('button', { style: 'width:100%;margin-bottom:6px', onclick: () => lettersDialog({ ...form.read(), photo: media.photo, docs: media.docs }) }, '📄 ' + t('lettersBtn')),
      // Tourist profiles only need the passport copy; Medical ones get the full Medical table.
      docGroup(t('docsAllVisas'), IVH.DOC_SLOTS.filter(d => d.for.includes('tourist'))),
      IVH.profileVisaType(form.read()) === 'medical' ? docGroup(t('docsMedical'), IVH.DOC_SLOTS.filter(d => !d.for.includes('tourist'))) : null,
      // Files saved before slots existed (or not tied to a site row) stay listed so they can be removed.
      ...media.docs.filter(d => !IVH.docSlot(d)).map(d => h('div', { class: 'doc' },
        h('span', { class: 'txt' }, `${d.label || d.name} — ${Math.round(d.size / 1024)} KB`),
        h('button', { onclick: () => window.open(URL.createObjectURL(dataUrlToBlob(d.dataUrl))) }, '👁'),
        h('button', { class: 'danger', onclick: () => { media.docs.splice(media.docs.indexOf(d), 1); renderMedia(); } }, '✕'))));
  };
  // One line per site document row: Required/Optional badge, the saved PDF (view, replace, remove) or Upload.
  const docGroup = (title, slots) => h('div', { style: 'margin-bottom:8px' },
    h('div', { style: 'font-weight:600;margin:8px 0 2px' }, title),
    ...slots.map(slot => {
      const doc = media.docs.find(d => IVH.docSlot(d) === slot.key);
      const need = slot.required?.length ? (slot.required.includes('tourist') ? t('docReqAll') : t('docReqMedical')) : t('docOptional');
      return h('div', { class: 'doc' },
        h('div', { class: 'txt', style: 'white-space:normal' },
          h('span', { class: slot.required?.length ? 'badge req' : 'badge opt' }, need), ' ', tl(slot),
          doc ? h('div', { class: 'sub', style: 'color:var(--muted)' }, `✓ ${Math.round(doc.size / 1024)} KB PDF`) : null),
        doc ? h('button', { title: t('docView'), onclick: () => window.open(URL.createObjectURL(dataUrlToBlob(doc.dataUrl))) }, '👁') : null,
        slot.key === 'medUndertaking' ? h('button', { title: t('utButton'), onclick: () => undertakingDialog(form.read(), media, renderMedia, slot) }, '✍') : null,
        h('button', { onclick: () => addDocument(media, renderMedia, slot) }, doc ? t('docReplace') : t('docUpload')),
        doc ? h('button', { class: 'danger', onclick: () => { media.docs.splice(media.docs.indexOf(doc), 1); renderMedia(); } }, '✕') : null);
    }));
  renderMedia();

  // Switching Tourist/Medical shows or hides the Medical documents straight away (saved files are kept).
  form.el.addEventListener('change', e => { if (e.target.dataset.k === 'visaType') renderMedia(); });

  // Phone and mobile are usually the same number ("01712345678" / "1712345678", example): while they match,
  // typing one fills the other. A landline, or two numbers that already differ, are left alone.
  const pBox = form.el.querySelector('[data-k=phone]'), mBox = form.el.querySelector('[data-k=mobile]');
  const asMobile = v => { const d = String(v || '').replace(/\D/g, '').replace(/^880/, ''); return /^0?1\d{0,9}$/.test(d) ? d.replace(/^0/, '') : null; };
  if (pBox && mBox) {
    // Linked or not is decided when the box is entered, so half-typed numbers ("+88") don't break the link.
    let linked = true, copying = false;
    const check = () => { linked = !pBox.value || !mBox.value || asMobile(pBox.value) === asMobile(mBox.value); };
    // The copied box updates the form record through its own input event; `copying` stops it copying back.
    const copy = (to, value) => { copying = true; to.value = value; to.dispatchEvent(new Event('input')); copying = false; };
    pBox.addEventListener('focus', check);
    mBox.addEventListener('focus', check);
    pBox.addEventListener('input', () => {
      const m = asMobile(pBox.value);
      if (!copying && linked && m !== null) copy(mBox, m);
    });
    mBox.addEventListener('input', () => {
      const m = asMobile(mBox.value);
      if (!copying && linked && m !== null) copy(pBox, m ? '0' + m : '');
    });
  }

  const tempCard = h('div');
  const renderTemp = () => IVH.store.list('tempIds').then(list => setKids(tempCard, tempIdsCard(profile, list, renderTemp)));
  if (profile.id) renderTemp();
  const appsCard = h('div');
  const renderApps = () => IVH.store.list('applications').then(list => setKids(appsCard, applicationsCard(profile, list, renderApps)));
  renderApps();

  // What the editor started with, to warn before Cancel throws changes away. A scan or import that was never
  // saved (no id, with a note) always counts as a change.
  const snapshot = () => JSON.stringify([form.read(), media.photo, media.docs.map(d => d.id)]);
  const start = profile.id || !note ? snapshot() : '';

  // Passport validity and likely typing mistakes, updated on every change.
  const warn = h('div', { class: 'note warn', hidden: true });
  const confirms = h('div');
  // "Change": jump to the mobile box with the number selected, ready to type the new one.
  const goToMobile = () => {
    const box = form.el.querySelector('[data-k=mobile]') || form.el.querySelector('[data-k=phone]');
    box?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    box?.focus({ preventScroll: true });
    box?.select?.();
  };
  // "Change" for the religion: jump to its list and open it (where Chrome allows).
  const goToReligion = () => {
    const box = form.el.querySelector('[data-k=religion]');
    box?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    box?.focus({ preventScroll: true });
    try { box?.showPicker(); } catch { /* older Chrome: the list is focused, ready to choose */ }
  };
  const checkProfile = () => {
    const p = form.read();
    const list = [IVH.monthsUntil(p.passportExpiry) < 6 ? t('passportWarn') : null, ...IVH.profileChecks(p)].filter(Boolean);
    // The religion and passport-phone warnings carry their confirm button on the same line.
    const confirmBtn = { [IVH.religionCheck(p)]: ['religionGuessed', 'relConfirm'], [IVH.mobileCheck(p)]: ['mobileFromPassport', 'mobConfirm'] };
    // Things to confirm (guessed religion, phone from the passport) get their own small cards with pill buttons;
    // other checks stay in the yellow note.
    const plain = list.filter(x => !confirmBtn[x]);
    setKids(warn, ...plain.map(x => h('div', {}, '⚠ ' + x)));
    warn.hidden = !plain.length;
    setKids(confirms, ...list.filter(x => confirmBtn[x]).map(x => {
      const [flag, label] = confirmBtn[x];
      const done = () => { form.set({ [flag]: false }); checkProfile(); };
      return h('div', { class: 'confirm-row' },
        h('span', { class: 'ic' }, flag === 'mobileFromPassport' ? '📞' : '🔍'),
        h('span', { class: 'tx' }, x),
        h('span', { class: 'acts' },
          h('button', { class: 'pill outline', onclick: flag === 'mobileFromPassport' ? goToMobile : goToReligion }, '✎ ' + t('mobChange')),
          h('button', { class: 'pill ok', onclick: done }, '✓ ' + t(label))));
    }));
  };
  form.el.addEventListener('change', checkProfile);
  checkProfile();

  // Family addresses: fill the address from a saved one or from another applicant, or save this one for later.
  // The passport scan fills its own address first; this is only used when the user picks it.
  const ADDR = ['presAdd1', 'presAdd2', 'presDistrict', 'presPostal'];
  const addrBar = h('div', { class: 'addr-bar' });
  const addrText = a => [a.presAdd1, a.presAdd2, a.presDistrict].filter(Boolean).join(', ');
  const renderAddrBar = async () => {
    const [saved, people] = await Promise.all([IVH.store.list('addresses'), IVH.store.list('profiles')]);
    const others = people.filter(p => p.id !== profile.id && !p.archived && p.presAdd1);
    const choices = new Map();
    const option = (key, item, text) => { choices.set(key, item); return opt(key, text); };
    const pick = h('select', { class: 'addr-pick', onchange: () => {
      const item = choices.get(pick.value);
      pick.value = '';
      if (!item) return;
      form.set(Object.fromEntries(ADDR.map(k => [k, item[k] || ''])));
      checkProfile();
      toast(t('addrFilled'), 3000);
    } },
      opt('', '📍 ' + t('addrFill')),
      saved.length ? h('optgroup', { label: t('addrSavedList') }, ...saved.map(a => option('a:' + a.id, a, `${a.label} — ${addrText(a)}`))) : null,
      others.length ? h('optgroup', { label: t('addrOthers') }, ...others.map(p => option('p:' + p.id, p, `${IVH.fullName(p)} — ${addrText(p)}`))) : null);
    pick.disabled = !saved.length && !others.length;
    const save = h('button', { class: 'pill outline', type: 'button', onclick: async () => {
      const cur = form.read();
      if (!cur.presAdd1 || !cur.presDistrict) return toast(t('addrNeed'), 3000);
      const list = await IVH.store.list('addresses');
      if (list.some(a => ADDR.every(k => (a[k] || '') === (cur[k] || '')))) return toast(t('addrExists'), 3000);
      // Suggested name: the applicant's first name ("RINA'S FAMILY"); titles like MD / MST are skipped.
      const first = String(cur.givenName || '').split(/\s+/).find(w => w && !/^(MD|MOHAMMAD|MOHAMMED|MUHAMMAD|MOHD|MST|MOST|MOSAMMAT|SK|SHEIKH|SYED)\.?$/i.test(w)) || cur.surname || '';
      const label = (prompt(t('addrName'), first ? t('addrFamily').replace('{name}', first) : cur.presAdd2 || '') || '').trim();
      if (!label) return;
      await IVH.store.upsert('addresses', { label: label.toUpperCase(), ...Object.fromEntries(ADDR.map(k => [k, cur[k] || ''])) });
      toast(t('addrSaved'), 3000);
      renderAddrBar();
    } }, '💾 ' + t('addrSave'));
    setKids(addrBar, pick, save);
  };
  const addrCard = form.el.querySelector('[data-k=presAdd1]')?.closest('.card');
  if (addrCard) { addrCard.querySelector('h3').after(addrBar); renderAddrBar(); }

  setKids(sec, 
    note ? h('div', { class: 'note warn' }, note) : null,
    h('div', { class: 'toolbar' },
      h('button', { onclick: () => scanPassportInto({ form, media, renderMedia }) }, '🛂 ' + t('scanPassport')),
      h('button', { onclick: () => scanPassportInto({ form, media, renderMedia }, true), title: t('aiScanHint') }, '✨ ' + t('aiScan'), h('span', { class: 'badge paid' }, t('paid')))),
    scanDropZone(file => scanPassportInto({ form, media, renderMedia }, false, file)),
    warn, confirms, appsCard, tempCard, form.el, mediaCard,
    h('div', { class: 'sticky-actions' },
      h('button', { onclick: () => { if (snapshot() === start || confirm(t('unsavedLeave'))) showProfiles(); } }, t('cancel')),
      h('button', { class: 'primary', onclick: async () => {
        const miss = form.missing();
        if (miss.length) return toast('⚠ ' + miss.slice(0, 4).join(', ') + (miss.length > 4 ? '…' : ''), 4000);
        // Phone number from the passport: ask once whether it is still in use (Cancel = change it now).
        const cur = form.read();
        if (cur.mobileFromPassport) {
          const num = cur.mobile ? '0' + String(cur.mobile).replace(/^0/, '') : cur.phone;
          if (!confirm(t('mobSaveAsk').replace('{phone}', num).replace('{date}', IVH.toSiteDate(cur.passportIssueDate) || '—'))) {
            goToMobile();
            return;
          }
          form.set({ mobileFromPassport: false });
        }
        const saved = await IVH.store.upsert('profiles', { ...form.read(), photo: media.photo, docs: media.docs });
        if (pendingApp) await IVH.saveApplication({ ...pendingApp, profileId: saved.id, name: IVH.fullName(saved), passportNo: saved.passportNo, dob: saved.dob });
        toast(t('saved'));
        showProfiles();
        refreshStart();
      } }, t('save'))));
}

function dataUrlToBlob(url) {
  const [head, b64] = url.split(',');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: /:(.*?);/.exec(head)[1] });
}

// Converts the chosen images/PDFs into one PDF of 100–500 KB and puts it in the given document slot
// (replacing what was there), so the upload page can match it to the site's row exactly.
async function addDocument(media, done, slot) {
  const files = await pickFile('image/*,application/pdf', true);
  if (!files?.length) return;
  toast(t('working'), 60000);
  try {
    const tools = await import('../lib/image-tools.js');
    const canvases = [];
    for (const f of files) canvases.push(...(await tools.fileToCanvases(f)));
    const blob = await tools.canvasesToPdf(canvases);
    const doc = { id: IVH.uid(), slot: slot.key, label: slot.en.toUpperCase(), name: slot.key + '.pdf', size: blob.size, dataUrl: await tools.readAsDataUrl(blob) };
    const i = media.docs.findIndex(d => IVH.docSlot(d) === slot.key);
    if (i >= 0) media.docs[i] = doc; else media.docs.push(doc);
    toast(`${tl(slot)}: ${Math.round(blob.size / 1024)} KB PDF`);
    done();
  } catch (e) {
    toast('⚠ ' + e.message, 4000);
  }
}

// IVAC's official Visa Undertaking Form filled from the profile. Every value can be edited first. "Download"
// saves the PDF to print and sign; with a slot (Medical Visa Undertaking) it is also put into that row.
// Cover letter, employer NOC, parents' consent and IVAC checklist (lib/letters.js): edit the text, then save a PDF.
async function lettersDialog(p) {
  const draft = await loadDraft();
  const s = draft.profileId === p.id ? draft : { mission: p.lastVisa?.mission };
  const [hotel, hospital] = await Promise.all([s.hotelId ? IVH.store.find('hotels', s.hotelId) : null, s.hospitalId ? IVH.store.find('hospitals', s.hospitalId) : null]);
  const { letterText, textToPdf, LETTER_KINDS } = await import('../lib/letters.js');
  const names = { cover: 'letterCover', noc: 'letterNoc', consent: 'letterConsent', checklist: 'letterChecklist' };
  const kindSel = h('select', { onchange: () => { area.value = letterText(kindSel.value, { p, s, hotel, hospital }); } }, ...LETTER_KINDS.map(k => opt(k, t(names[k]))));
  const area = h('textarea', { style: 'width:100%;min-height:340px;font:12px/1.45 Georgia,serif', spellcheck: 'false' });
  area.value = letterText('cover', { p, s, hotel, hospital });
  const dlg = h('dialog', { style: 'border:0;border-radius:12px;padding:14px;width:min(560px,94vw);max-height:92vh;overflow:auto' },
    h('h3', { style: 'margin:0 0 6px;color:var(--navy)' }, '📄 ' + t('lettersTitle')),
    h('div', { class: 'note' }, t('lettersHelp')),
    h('label', { class: 'f' }, h('span', {}, t('lettersKind')), kindSel),
    area,
    h('div', { class: 'row', style: 'margin-top:8px' },
      h('button', { onclick: () => dlg.close() }, t('cancel')),
      h('button', { onclick: () => navigator.clipboard.writeText(area.value).then(() => toast(t('copied'))) }, t('lettersCopy')),
      h('button', { class: 'primary', onclick: async () => {
        toast(t('working'), 30000);
        try {
          const blob = await textToPdf(area.value);
          const label = { cover: 'COVER_LETTER', noc: 'NOC', consent: 'CONSENT_LETTER', checklist: 'IVAC_CHECKLIST' }[kindSel.value];
          download(`${label}_${IVH.fullName(p).toUpperCase().replace(/\W+/g, '_')}_${p.passportNo || ''}.pdf`, blob, 'application/pdf');
          toast(t('lettersSaved'), 4000);
        } catch (e) { toast('⚠ ' + e.message, 5000); }
      } }, '⬇ ' + t('lettersPdf'))));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

async function undertakingDialog(p, media, done, slot) {
  const draft = await loadDraft();
  const hospital = draft.profileId === p.id && draft.hospitalId ? await IVH.store.find('hospitals', draft.hospitalId) : null;
  const medical = IVH.profileVisaType(p) === 'medical';
  const hosp = hospital?.name && hospital.name.length <= 28 ? ` AT ${hospital.name}` : '';
  const d = new Date();
  const today = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const values = {
    name: IVH.fullName(p).toUpperCase(),
    passportNo: p.passportNo || '',
    nationality: 'BANGLADESHI',
    dob: IVH.toSiteDate(p.dob),
    address: [p.presAdd1, p.presAdd2, p.presDistrict, p.presPostal].filter(Boolean).join(', '),
    purpose: medical ? `MEDICAL TREATMENT${hosp}` : 'TOURISM',
    returnTo: 'BANGLADESH',
    place: p.presDistrict || '',
    date: today,
  };
  const fields = [['name', 'utName'], ['passportNo', 'utPassport'], ['nationality', 'utNationality'], ['dob', 'utDob'], ['address', 'utAddress'], ['purpose', 'utPurpose'], ['returnTo', 'utReturn'], ['place', 'utPlace'], ['date', 'utDate']];
  const inputs = {};
  const dlg = h('dialog', { style: 'border:0;border-radius:12px;padding:14px;width:320px;max-height:90vh;overflow:auto' },
    h('h3', { style: 'margin:0 0 6px;color:var(--navy)' }, '✍ ' + t('utTitle')),
    h('div', { class: 'note' }, t('utHelp')),
    ...fields.map(([k, label]) => h('label', { class: 'f' }, h('span', {}, t(label)), (inputs[k] = h('input', { type: 'text', value: values[k] })))),
    h('div', { class: 'row', style: 'margin-top:8px' },
      h('button', { onclick: () => dlg.close() }, t('cancel')),
      h('button', { class: 'primary', onclick: async () => {
        for (const [k] of fields) values[k] = inputs[k].value.trim().toUpperCase();
        toast(t('working'), 30000);
        try {
          const { buildUndertaking } = await import('../lib/undertaking.js');
          const { blob } = await buildUndertaking(values);
          download(`VISA_UNDERTAKING_${values.name.replace(/\W+/g, '_')}_${values.passportNo}.pdf`, blob, 'application/pdf');
          if (slot) {
            const tools = await import('../lib/image-tools.js');
            const doc = { id: IVH.uid(), slot: slot.key, label: slot.en.toUpperCase(), name: slot.key + '.pdf', size: blob.size, dataUrl: await tools.readAsDataUrl(blob), generated: true };
            const i = media.docs.findIndex(x => IVH.docSlot(x) === slot.key);
            if (i >= 0) media.docs[i] = doc; else media.docs.push(doc);
            done();
          }
          toast(t(slot ? 'utSavedSlot' : 'utDownloaded'), 6000);
          dlg.close();
        } catch (e) {
          toast('⚠ ' + e.message, 5000);
        }
      } }, slot ? t('utMakeSlot') : t('utMake'))));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

// Square photo cropper: drag to move, slider to zoom; produces a 350×350 JPEG.
async function cropPhoto(file, done) {
  const tools = await import('../lib/image-tools.js');
  const img = await tools.loadImage(file);
  const view = { zoom: 1, dx: 0, dy: 0 };
  const canvas = h('canvas', { width: 350, height: 350 });
  const draw = () => canvas.getContext('2d').drawImage(tools.renderSquare(img, view), 0, 0);
  const box = h('div', { class: 'cropper' }, canvas);
  let drag = null;
  box.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, dx: view.dx, dy: view.dy }; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', e => {
    if (!drag) return;
    view.dx = drag.dx + (e.clientX - drag.x) / box.clientWidth;
    view.dy = drag.dy + (e.clientY - drag.y) / box.clientHeight;
    draw();
  });
  box.addEventListener('pointerup', () => (drag = null));
  const zoom = h('input', { type: 'range', min: '1', max: '3', step: '0.01', value: '1', style: 'width:100%', oninput: e => { view.zoom = +e.target.value; draw(); } });
  const dlg = h('dialog', { style: 'border:0;border-radius:12px;padding:14px;width:290px' },
    h('div', { class: 'note' }, t('cropHelp')),
    box, zoom,
    h('div', { class: 'row', style: 'margin-top:10px' },
      h('button', { onclick: () => dlg.close() }, t('cancel')),
      h('button', { class: 'primary', onclick: () => { done(tools.photoJpeg(tools.renderSquare(img, view))); dlg.close(); } }, t('save'))));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  draw();
  dlg.showModal();
}

// The saved applicant with this passport and visa type (a person can have a Tourist and a Medical copy).
async function findProfileFor(passportNo, visaType) {
  const same = (await IVH.store.list('profiles')).filter(p => passportNo && p.passportNo === passportNo);
  return same.find(p => IVH.profileVisaType(p) === (visaType || 'tourist')) || (visaType ? null : same[0]);
}

async function importBgdPdf() {
  const file = await pickFile('application/pdf');
  if (!file) return;
  toast(t('working'), 30000);
  try {
    const [{ loadPdf }, { pdfLines }, { parseBgd }] = await Promise.all([import('../lib/pdf-loader.js'), import('../lib/pdf-lines.js'), import('../lib/bgd-parser.js')]);
    const doc = await loadPdf(await file.arrayBuffer());
    const { profile, visa, hotel, refIndia, refBd } = parseBgd(await pdfLines(doc));

    // Save the hotel and Bangladesh reference for reuse unless they already exist.
    const added = [];
    if (hotel?.name) {
      const hotels = await IVH.store.list('hotels');
      if (!hotels.some(x => x.name === hotel.name)) { await IVH.store.upsert('hotels', hotel); added.push(hotel.name); }
    }
    if (refIndia?.name && refIndia.name !== hotel?.name) {
      const cs = await IVH.store.list('contacts');
      if (!cs.some(x => x.name === refIndia.name)) { await IVH.store.upsert('contacts', refIndia); added.push(refIndia.name); }
    }
    if (refBd?.name) {
      const cs = await IVH.store.list('contacts');
      if (!cs.some(x => x.name === refBd.name && x.country === 'BD')) { await IVH.store.upsert('contacts', refBd); added.push(refBd.name); }
    }
    const missionCode = { DHAKA: 'BGDD', CHITTAGONG: 'BGDC', RAJSHAHI: 'BGDR', SYLHET: 'BGDS', KHULNA: 'BGDK' }[profile.mission];
    profile.lastVisa = { ...visa, mission: missionCode, hotelName: hotel?.name, refBdName: refBd?.name };
    profile.visaType = /MEDICAL/i.test(visa.type || '') ? 'medical' : 'tourist';
    delete profile.mission;

    // The printed application is the registered one: keep its Application Id and the PDF in the history.
    const tools = await import('../lib/image-tools.js');
    const pendingApp = IVH.isAppId(profile.applicationId) ? {
      id: profile.applicationId, mission: missionCode, visaType: profile.visaType, source: 'import',
      pdf: { name: file.name, size: file.size, dataUrl: await tools.readAsDataUrl(file), at: Date.now() },
    } : null;
    delete profile.applicationId;

    // Same passport already saved? Update it instead of creating a duplicate.
    const existing = await findProfileFor(profile.passportNo, profile.visaType);
    // The applicant photo printed on the application, cropped square, when the applicant has none yet.
    let photoNote = '';
    if (!existing?.photo) {
      try {
        const { firstPagePhoto } = await import('../lib/pdf-loader.js');
        const c = await firstPagePhoto(doc);
        if (c) {
          const img = await tools.loadImage(c.toDataURL('image/jpeg', 0.95));
          profile.photo = tools.photoJpeg(tools.renderSquare(img, { zoom: 1, dx: 0, dy: 0 }));
          photoNote = ' ' + t('bgdPhotoTaken');
        }
      } catch { /* no usable picture: the photo stays empty */ }
    }
    editProfile(IVH.applyPassportDefaults(existing ? { ...existing, ...profile, id: existing.id } : profile),
      t('reviewImport') + (added.length ? ` (+ ${added.join(', ')})` : '') + photoNote, pendingApp);
    toast('✓ ' + IVH.fullName(profile));
  } catch (e) {
    toast('⚠ ' + e.message, 5000);
  }
}

// First normal scan: where to read the passport. Resolves to 'server', 'local' or null (cancelled).
function askScanEngine() {
  return new Promise(resolve => {
    let answer = null;
    const pick = v => { answer = v; dlg.close(); };
    const dlg = h('dialog', { style: 'border:0;border-radius:12px;padding:14px;width:320px' },
      h('h3', { style: 'margin:0 0 6px;color:var(--navy)' }, '🛂 ' + t('scanChooseTitle')),
      h('div', { class: 'note' }, t('scanChooseHelp')),
      h('button', { class: 'primary', style: 'width:100%;margin-bottom:6px', onclick: () => pick('server') }, t('scanServer')),
      h('button', { style: 'width:100%;margin-bottom:6px', onclick: () => pick('local') }, t('scanLocal')),
      h('div', { class: 'note', style: 'margin:0' }, t('scanChooseLater')));
    dlg.addEventListener('close', () => { dlg.remove(); resolve(answer); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

// Is the AI service chosen in Settings set up? Helper AI needs an access code, the others a key or server.
const aiIsReady = st => (st.aiProvider === 'helper' ? !!st.helperCode : st.aiProvider === 'openai' ? !!(st.oaBaseUrl && st.oaModel) : !!st.aiKey);
// AI error codes (ai-client.js) → message keys.
const AI_ERRORS = { 'server-scan-limit': 'scanServerLimit', 'server-scan-off': 'scanServerOff', 'server-scan-failed': 'scanServerFailed', 'bad-api-key': 'aiBadKey', 'rate-limited': 'aiRateLimited', offline: 'aiOffline', refused: 'aiRefused', incomplete: 'aiFailed', 'no-openai-config': 'aiNeedKey', 'no-api-key': 'aiNeedKey', 'no-helper-code': 'aiNeedKey', 'helper-bad-code': 'helperBadCode', 'helper-limit': 'helperLimit', 'helper-off': 'helperOff' };

// Offline OCR (default) or AI scan with the AI service chosen in Settings; fills a new or the open applicant.
async function scanPassportInto(target, ai = false, dropped = null) {
  const st = await IVH.settings();
  const aiReady = aiIsReady(st);
  if (ai && aiReady && !(await ensureAiPermission(st))) return toast('⚠ ' + t('oaNoPermission'), 5000);
  if (ai && !aiReady) {
    toast(t('aiNeedKey'), 5000);
    document.querySelector('[data-tab=settings]').click();
    return;
  }
  // Normal scan: on the free helper server (more accurate) or only on this computer — asked once, then a setting.
  // "Smart scan" (server + this computer) was removed in 1.0.50: it now means the server scan.
  let engine = st.scanEngine === 'smart' ? 'server' : st.scanEngine;
  if (!ai && !engine) {
    engine = await askScanEngine();
    if (!engine) return;
    await IVH.store.set('settings', { ...(await IVH.settings()), scanEngine: engine });
  }
  const file = dropped || await pickFile('image/*,application/pdf');
  if (!file) return;
  toast(t(ai ? 'aiRunning' : engine === 'server' ? 'scanServerRunning' : 'ocrRunning'), 180000);
  try {
    const ocr = ai ? null : await import('../lib/passport-ocr.js');
    let scanned;
    if (ai) scanned = await (await import('../lib/ai-scan.js')).aiScanPassport(file, st);
    else if (engine === 'server') {
      try {
        scanned = await ocr.serverScanPassport(file);
      } catch (e) {
        // Server unreachable, busy or the day's limit used: read it on this computer instead.
        if (e.message === 'mrz-not-found') throw e;
        toast((AI_ERRORS[e.message] ? t(AI_ERRORS[e.message]) : t('scanServerFailed')) + ' ' + t('scanFallback'), 180000);
        scanned = await ocr.scanPassport(file, () => {});
      }
    } else scanned = await ocr.scanPassport(file, () => {});
    const { profile, warnings } = scanned;
    // Religion is not on the passport: suggest one from the names (marked as guessed until confirmed).
    if (!profile.religion) {
      const guess = (await import('../lib/religion.js')).guessReligion(profile);
      if (guess) { profile.religion = guess; profile.religionGuessed = true; }
    }
    // The phone number printed in the passport may be years old: mark it until the applicant confirms it.
    if (profile.phone || profile.mobile) profile.mobileFromPassport = true;
    // A religion or phone number the applicant already has is never replaced by the scan.
    const keepReligion = base => {
      if (base.religion && profile.religionGuessed) { delete profile.religion; delete profile.religionGuessed; }
      if ((base.phone || base.mobile) && !base.mobileFromPassport) { delete profile.phone; delete profile.mobile; delete profile.mobileFromPassport; }
    };
    const tools = await import('../lib/image-tools.js');
    // The scan itself becomes the "PASSPORT COPY" document for the upload page.
    const passDoc = async () => {
      const blob = await tools.canvasesToPdf(await tools.fileToCanvases(file));
      return { id: IVH.uid(), slot: 'passport', label: 'PASSPORT COPY', name: 'passport.pdf', size: blob.size, dataUrl: await tools.readAsDataUrl(blob) };
    };
    const note = t('reviewImport') + (warnings.length ? ' ⚠ ' + warnings.join('; ') : '');
    if (target) {
      keepReligion(target.form.read());
      target.form.set(IVH.applyPassportDefaults({ ...target.form.read(), ...profile }));
      if (!target.media.docs.some(d => IVH.docSlot(d) === 'passport')) target.media.docs.push(await passDoc());
      target.renderMedia();
      toast(note, 9000);
    } else {
      const existing = await findProfileFor(profile.passportNo);
      const base = existing || {};
      keepReligion(base);
      const docs = [...(base.docs || [])];
      if (!docs.some(d => IVH.docSlot(d) === 'passport')) docs.push(await passDoc());
      editProfile(IVH.applyPassportDefaults({ ...base, ...profile, docs }), note);
      $('#toast').hidden = true;
    }
  } catch (e) {
    const known = { 'mrz-not-found': 'ocrFailed', ...AI_ERRORS };
    toast(known[e.message] ? t(known[e.message]) : '⚠ ' + e.message, 7000);
  }
}

// ---------- start screen ----------
async function refreshStart() {
  const sec = $('#tab-start');
  const [profiles, hotels, hospitals, contacts, settings, session, tempIds, apps] = await Promise.all([
    IVH.store.list('profiles'), IVH.store.list('hotels'), IVH.store.list('hospitals'), IVH.store.list('contacts'),
    IVH.settings(), IVH.store.get('session', {}), IVH.store.list('tempIds'), IVH.store.list('applications'),
  ]);
  const draft = await loadDraft();
  const s = { mission: 'BGDD', purpose: '544', duration: '12', entries: '2', portIn: 'BY AIR/ HARIDASPUR', portOut: 'BY AIR/ HARIDASPUR', places: 'KOLKATA', refIndia: 'hotel', autoAdvance: settings.autoAdvance, ...draft };
  // Reference in Bangladesh follows the applicant (spouse if married, else father) unless picked by hand for them.
  if (s.refBdManualFor !== s.profileId) s.refBd = IVH.defaultBdRef(profiles.find(x => x.id === s.profileId));
  const byName = (a, b) => (a.name || IVH.fullName(a)).localeCompare(b.name || IVH.fullName(b));
  const sel = (key, options, label) => {
    const el = h('select', { onchange: e => {
      s[key] = e.target.value;
      if (key === 'refBd') s.refBdManualFor = s.profileId;
      // A new applicant brings their own defaults (saved by applyProfileDefaults).
      if (key === 'profileId') applyProfileDefaults();
      else saveDraft({ [key]: s[key], refBdManualFor: s.refBdManualFor });
      update();
    } },
      ...options.map(([v, txt]) => opt(v, txt, String(s[key] ?? '') === String(v))));
    return h('label', { class: 'f', 'data-key': key }, h('span', {}, label), el);
  };
  const text = (key, label, type = 'text') => {
    if (type === 'date') {
      const box = dateBox(s[key]);
      box.text.addEventListener('input', () => { s[key] = dmyToIso(box.text.value); });
      box.text.addEventListener('change', () => { box.text.classList.toggle('bad', !!box.text.value.trim() && !s[key]); saveDraft({ [key]: s[key] }); });
      return h('label', { class: 'f', 'data-key': key }, h('span', {}, label), box.el);
    }
    return h('label', { class: 'f', 'data-key': key }, h('span', {}, label),
      h('input', { type, value: s[key] ?? '', oninput: e => {
        s[key] = e.target.value;
      }, onchange: () => saveDraft({ [key]: s[key] }) }));
  };

  const applyProfileDefaults = () => {
    const p = profiles.find(x => x.id === s.profileId);
    if (!p) return saveDraft({ profileId: s.profileId });
    s.email = s.email || p.email || '';
    // The applicant's profile type decides Tourist (T1) or Medical (M1).
    s.purpose = IVH.PROFILE_VISA_TYPES.find(v => v[0] === IVH.profileVisaType(p))[3];
    const lv = p.lastVisa;
    if (lv) {
      if (lv.mission) s.mission = lv.mission;
      if (lv.portIn) s.portIn = lv.portIn;
      if (lv.portOut) s.portOut = lv.portOut;
      if (lv.places) s.places = lv.places;
      const hotel = hotels.find(x => x.name === lv.hotelName);
      if (hotel) s.hotelId = hotel.id;
    }
    s.refBd = IVH.defaultBdRef(p);
    s.refBdManualFor = '';
    refreshStartWith(s);
  };

  const medical = () => IVH.isMedical(s) || IVH.isAttendant(s);
  const p = profiles.find(x => x.id === s.profileId);
  const warn = p && IVH.monthsUntil(p.passportExpiry) < 6 ? h('div', { class: 'note warn' }, t('passportWarn')) : null;

  const attendantBox = h('div', { class: 'card' }, h('h3', {}, t('patientName')),
    text('patientName', t('patientName')), text('patientPassport', t('patientPassport')),
    text('patientRelation', t('patientRelation')), text('patientApplicationId', t('patientAppId')));

  const auto = h('input', { type: 'checkbox', checked: !!s.autoAdvance, onchange: e => { s.autoAdvance = e.target.checked; saveDraft({ autoAdvance: s.autoAdvance }); } });

  const pfBox = h('div', { style: 'margin-top:8px' });
  const checkNow = () => {
    if (s.refIndia === 'hospital' && !s.hospitalId) s.refIndia = 'hotel';
    return IVH.preflight({ p: profiles.find(x => x.id === s.profileId), s, hotels, hospitals, contacts });
  };

  setKids(sec, 
    session.active ? h('div', { class: 'note ok' }, '▶ ', IVH.fullName(profiles.find(x => x.id === session.profileId)) || '', session.tempId ? ` · ${session.tempId}` : '',
      h('button', { style: 'margin-left:8px;padding:2px 8px', onclick: async () => { await IVH.store.set('session', { ...session, active: false }); refreshStart(); } }, t('stopFill'))) : null,
    h('div', { class: 'card' },
      sel('profileId', [['', '— ' + t('applicant') + ' —'], ...profiles.filter(x => !x.archived || x.id === s.profileId).sort(byName).map(x => [x.id, `${IVH.fullName(x)} · ${x.passportNo || ''} · ${IVH.PROFILE_VISA_TYPES.find(v => v[0] === IVH.profileVisaType(x))[IVH.lang() === 'bn' ? 2 : 1]}`])], t('applicant')),
      warn,
      h('div', { class: 'grid2' },
        sel('mission', IVH.MISSIONS, t('mission')),
        sel('purpose', IVH.PURPOSES.map(([v, l]) => [v, l]), t('visaType'))),
      h('div', { class: 'grid2' }, text('journeyDate', t('journeyDate'), 'date'), text('email', t('regEmail'), 'email')),
      h('div', { class: 'grid2' }, text('duration', t('duration'), 'number'), sel('entries', IVH.ENTRIES, t('entries'))),
      h('div', { class: 'grid2' }, sel('portIn', IVH.PORTS.map(x => [x, x]), t('portIn')), sel('portOut', IVH.PORTS.map(x => [x, x]), t('portOut'))),
      text('places', t('places'))),
    h('div', { class: 'card' },
      sel('hotelId', [['', '—'], ...hotels.sort(byName).map(x => [x.id, `${x.name} · ${x.district || x.state || ''}`])], t('hotel')),
      sel('hotel2Id', [['', '—'], ...hotels.sort(byName).map(x => [x.id, `${x.name} · ${x.district || x.state || ''}`])], t('hotel2')),
      // Medical visas: the invitation letter number makes the site fill the Indian hospital itself; the
      // Bangladesh doctor/hospital, illness and the hospital email come from here.
      h('div', { 'data-medical': '' },
        text('medicalLetterNo', t('medLetterNo')),
        h('div', { class: 'note', style: 'margin-top:-4px' }, t('medLetterHint')),
        text('illness', t('medIllness')),
        sel('hospitalId', [['', '—'], ...hospitals.filter(x => (x.country || 'IN') === 'IN').sort(byName).map(x => [x.id, `${x.name} · ${x.district || ''}`])], t('hospital')),
        sel('bdHospitalId', [['', '—'], ...hospitals.filter(x => x.country === 'BD').sort(byName).map(x => [x.id, `${x.name} · ${x.doctor || ''}`])], t('medBdHospital'))),
      sel('refIndia', [['hotel', t('sameAsHotel')], ['hospital', t('sameAsHospital')], ...contacts.filter(c => c.country === 'IN').sort(byName).map(c => [c.id, c.name])], t('refIndia')),
      sel('refBd', [['father', t('fromFather')], ['mother', t('fromMother')], ['spouse', t('fromSpouse')], ...contacts.filter(c => c.country !== 'IN').sort(byName).map(c => [c.id, c.name])], t('refBd'))),
    h('div', { 'data-attendant': '' }, attendantBox),
    h('label', { class: 'chk' }, auto, t('autoAdvance')),
    h('div', { class: 'card' },
      h('div', { class: 'row', style: 'justify-content:space-between' },
        h('h3', { style: 'margin:0;flex:1' }, '✔ ' + t('pfTitle')),
        h('button', { style: 'flex:0 0 auto', onclick: () => renderPreflight(pfBox, checkNow()) }, t('pfCheck'))),
      pfBox),
    h('button', { class: 'primary big', onclick: () => {
      // Pre-flight: errors block Start; warnings need a second click ("Start anyway").
      const issues = checkNow();
      if (issues.some(i => i.level === 'error')) { renderPreflight(pfBox, issues); return pfBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      if (issues.length) { renderPreflight(pfBox, issues, () => startSession(s)); return pfBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      startSession(s);
    } }, '▶ ' + t('startFill')),
    h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { onclick: () => chrome.tabs.create({ url: IVH.SITE + 'index.html' }) }, t('openSite'))),
    h('div', { class: 'note', style: 'margin-top:10px' }, t('resumeHint')),
    profiles.length ? null : h('div', { class: 'card' }, h('h3', {}, '🧪 ' + t('exTitle')), h('div', { class: 'note' }, t('exStartHint')),
      h('button', { class: 'primary', style: 'width:100%', onclick: addExampleData }, '+ ' + t('exAdd'))),
    queueCard(s, profiles, applyProfileDefaults),
    remindersCard(profiles, apps),
    apps.length ? h('div', { class: 'card' }, h('h3', {}, t('appsAll')), ...apps.slice(0, 30).map(a => appRow(a, refreshStart, true))) : null,
    tempIds.length ? h('div', { class: 'card' },
      h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px' },
        h('h3', { style: 'margin:0;flex:1' }, `${t('tempIds')} (${tempIds.length})`),
        tempIds.some(tempIdDone) ? h('button', { style: 'padding:3px 8px;font-size:12px;flex:0 0 auto', title: t('tempClearOldTip'), onclick: async () => {
          const n = await removeTempIds(tempIdDone);
          toast(t('tempCleared').replace('{n}', n));
          refreshStart();
        } }, '🧹 ' + t('tempClearOld')) : null,
        h('button', { class: 'danger', style: 'padding:3px 8px;font-size:12px;flex:0 0 auto', onclick: async () => {
          if (!confirm(t('tempClearConfirm').replace('{n}', tempIds.length))) return;
          const n = await removeTempIds(() => true);
          toast(t('tempCleared').replace('{n}', n));
          refreshStart();
        } }, t('tempClearAll'))),
      ...tempIds.slice(0, 20).map(x => {
      const owner = profiles.find(pp => pp.id === x.profileId) || profiles.find(pp => x.passportNo && pp.passportNo === x.passportNo);
      return h('div', { class: 'tempid' },
        h('div', {},
          h('code', { title: t('copyTip'), onclick: () => navigator.clipboard.writeText(x.id).then(() => toast(t('copied'))) }, x.id),
          h('div', { style: 'color:var(--muted)' }, `${x.name} · ${new Date(x.at).toLocaleDateString()}${x.lastPage ? ' · ' + t('lastPage') + ': ' + x.lastPage : ''}`)),
        // A submitted application can't be resumed; one whose applicant was deleted has nobody to fill it with.
        owner && !x.appId ? h('button', { style: 'padding:3px 8px;font-size:12px;flex:0 0 auto', onclick: () => resumeApplication(owner, x) }, '↻ ' + t('resume')) : null,
        h('button', { class: 'danger', style: 'padding:3px 8px;font-size:12px;flex:0 0 auto', title: t('tempRemove'), onclick: () => removeTempIds(y => y.id === x.id).then(refreshStart) }, '✕'));
    })) : null,
    h('div', { class: 'card' }, h('h3', {}, t('linksTitle')),
      ...IVH.USEFUL_LINKS.map(l => h('div', { class: 'tempid' },
        h('div', {}, h('div', { style: 'font-weight:600' }, t(l.key)), l.note ? h('div', { style: 'color:var(--muted)' }, t(l.note)) : null),
        h('button', { style: 'padding:3px 8px;font-size:12px;flex:0 0 auto', onclick: () => chrome.tabs.create({ url: l.url }) }, '↗')))),
  );

  function update() {
    sec.querySelector('[data-medical]').hidden = !medical();
    sec.querySelector('[data-attendant]').hidden = !IVH.isAttendant(s);
  }
  update();
}
function refreshStartWith(s) { saveDraft(s).then(refreshStart); }

// Family / client queue: line up applicants who travel together; "Next" makes the first one the Start screen's
// applicant (with their own defaults) while the trip choices stay. Each application still needs its own captcha.
function queueCard(s, profiles, applyProfileDefaults) {
  const queue = (s.queue || []).filter(id => profiles.some(p => p.id === id));
  const nameOf = id => IVH.fullName(profiles.find(p => p.id === id)) || '—';
  const setQueue = q => { s.queue = q; refreshStartWith({ queue: q }); };
  const others = profiles.filter(p => !p.archived && p.id !== s.profileId && !queue.includes(p.id)).sort((a, b) => IVH.fullName(a).localeCompare(IVH.fullName(b)));
  const pick = h('select', {}, opt('', '+ ' + t('queueAdd')), ...others.map(p => opt(p.id, `${IVH.fullName(p)} · ${p.passportNo || ''}`)));
  pick.onchange = () => { if (pick.value) setQueue([...queue, pick.value]); };
  return h('div', { class: 'card' },
    h('h3', {}, '👪 ' + t('queueTitle') + (queue.length ? ` (${queue.length})` : '')),
    queue.length ? null : h('div', { class: 'note', style: 'margin:0 0 6px' }, t('queueHelp')),
    ...queue.map((id, i) => h('div', { class: 'tempid' },
      h('div', {}, `${i + 1}. ${nameOf(id)}`),
      h('button', { style: 'padding:3px 8px;font-size:12px;flex:0 0 auto', onclick: () => setQueue(queue.filter(x => x !== id)) }, '✕'))),
    h('div', { class: 'row', style: 'margin-top:6px' },
      pick,
      queue.length ? h('button', { class: 'primary', onclick: () => {
        const [next, ...rest] = queue;
        s.queue = rest;
        s.profileId = next;
        applyProfileDefaults();
      } }, '▶ ' + t('queueNext') + ': ' + nameOf(queue[0])) : null));
}

// Reminders: passports running out within a year, and submitted applications still waiting for a result.
function remindersCard(profiles, apps) {
  const active = profiles.filter(p => !p.archived);
  const expiring = active.filter(p => p.passportExpiry && IVH.monthsUntil(p.passportExpiry) < 12)
    .sort((a, b) => a.passportExpiry.localeCompare(b.passportExpiry));
  const FINAL = /grant|issued|approv|reject|refus|denied|deliver|collect|dispatch/i;
  const waiting = apps.filter(a => a.submittedAt && !FINAL.test(a.status?.text || '') && Date.now() - a.submittedAt > 3 * 864e5);
  if (!expiring.length && !waiting.length) return null;
  const openApplicant = p => { document.querySelector('[data-tab=profiles]').click(); editProfile(p); };
  return h('div', { class: 'card' },
    h('h3', {}, '🔔 ' + t('remindersTitle')),
    ...expiring.slice(0, 10).map(p => {
      const m = IVH.monthsUntil(p.passportExpiry);
      return h('div', { class: 'tempid' },
        h('div', {}, h('div', { style: 'font-weight:600' }, IVH.fullName(p)),
          h('div', { style: 'color:' + (m < 6 ? '#b42318' : 'var(--muted)') }, (m < 0 ? t('remExpired') : t('remExpires')) + ' ' + IVH.toSiteDate(p.passportExpiry))),
        h('button', { style: 'padding:3px 8px;font-size:12px;flex:0 0 auto', onclick: () => openApplicant(p) }, t('edit')));
    }),
    ...waiting.slice(0, 10).map(a => h('div', { class: 'tempid' },
      h('div', {}, h('div', { style: 'font-weight:600' }, a.name || a.id),
        h('div', { style: 'color:var(--muted)' }, t('remWaiting').replace('{days}', Math.floor((Date.now() - a.submittedAt) / 864e5)) + (a.status?.text ? ` · ${a.status.text}` : ''))),
      h('button', { style: 'padding:3px 8px;font-size:12px;flex:0 0 auto', onclick: () => openSiteJob('status', a) }, '🔎 ' + t('appStatusBtn')))));
}

// The Start screen's choices are kept as a draft of their own ("startDraft"), saved on every change, so they
// survive the panel re-drawing or closing. The running session ("session") is only written by Start/Resume:
// picking another applicant while an application is being filled no longer changes whose data it fills.
const RUN_KEYS = ['active', 'paused', 'lastAuto', 'startPending', 'startedAt', 'tempId', 'appId', 'reviewed', 'editFill'];
const draftOnly = s => Object.fromEntries(Object.entries(s).filter(([k]) => !RUN_KEYS.includes(k)));
async function loadDraft() {
  // Before 1.0.26 the choices were kept in the session itself.
  return (await IVH.store.get('startDraft')) || draftOnly(await IVH.store.get('session', {}));
}
// Saves run one after another, so two quick changes can't overwrite each other.
let draftQueue = Promise.resolve();
function saveDraft(patch) {
  draftQueue = draftQueue.then(async () => IVH.store.set('startDraft', { ...(await loadDraft()), ...draftOnly(patch) })).catch(() => {});
  return draftQueue;
}

// Runs after the pre-flight check has passed (or its warnings were accepted).
async function startSession(s) {
  await saveDraft(s);
  const settings = await IVH.settings();
  await IVH.store.set('settings', { ...settings, autoAdvance: !!s.autoAdvance });
  await openSiteWith({ ...s, tempId: '' }, true);
  refreshStart();
}

// Pre-flight results: red problems (each with a Fix button that opens the right editor), yellow things to check,
// and "Start anyway" when only warnings are left.
function renderPreflight(box, issues, onStartAnyway) {
  const errors = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warn');
  const list = items => h('ul', { style: 'margin:6px 0 0;padding-left:18px' }, ...items.map(i => h('li', { style: 'margin-bottom:4px' }, i.text, ' ',
    i.fix !== 'start' ? h('button', { style: 'padding:1px 8px;font-size:11px', onclick: () => openFix(i) }, t('pfFix')) : null)));
  if (!issues.length) return setKids(box, h('div', { class: 'note ok', style: 'margin:0' }, '✓ ' + t('pfAllGood')));
  setKids(box,
    errors.length ? h('div', { class: 'note warn', style: 'background:#fde8e8;color:#b42318' }, t('pfErrors').replace('{n}', errors.length), list(errors)) : null,
    warnings.length ? h('div', { class: 'note warn' }, t('pfWarnings').replace('{n}', warnings.length), list(warnings)) : null,
    !errors.length && onStartAnyway ? h('button', { class: 'primary', style: 'width:100%', onclick: onStartAnyway }, '▶ ' + t('pfStartAnyway')) : null);
}

// Opens the editor where a pre-flight problem can be fixed.
async function openFix(issue) {
  const tab = { profile: 'profiles', hotels: 'hotels', hospitals: 'hospitals', contacts: 'contacts' }[issue.fix];
  if (!tab) return;
  document.querySelector(`[data-tab=${tab}]`).click();
  if (issue.fix === 'profile') {
    const p = await IVH.store.find('profiles', issue.id);
    if (p) editProfile(p);
    return;
  }
  const item = await IVH.store.find(issue.fix, issue.id);
  const editors = { hotels: hotelsTab, hospitals: hospitalsTab, contacts: contactsTab };
  if (item) editors[issue.fix].showEditor(item);
}

// Starts (startPending true) or resumes (startPending 'resume') through the visa home page:
// Registration and "Complete Partially Filled Form" can't be opened by URL, so the content script
// on the home page follows the right link once.
async function openSiteWith(s, startPending) {
  const tabs = await chrome.tabs.query({ url: IVH.SITE + '*' });
  const home = tabs.find(tb => /\/visa\/(index\.html)?(\?.*)?$/.test(tb.url));
  const other = tabs.find(tb => tb !== home);
  // Point a non-home tab at the home page before the session changes, so its old form page is never filled.
  if (!home && other) await chrome.tabs.update(other.id, { active: true, url: IVH.SITE + 'index.html' });
  await IVH.store.set('session', { ...s, active: true, paused: false, lastAuto: null, reviewed: false, editFill: null, startPending, startedAt: Date.now() });
  // A tab already on the home page reacts to the session change itself; reloading it would race that.
  if (home) await chrome.tabs.update(home.id, { active: true });
  else if (!other) await chrome.tabs.create({ url: IVH.SITE + 'index.html' });
}

const tempIdsOf = (p, list) => list.filter(x => (x.profileId ? x.profileId === p.id : x.passportNo && x.passportNo === p.passportNo));

async function resumeApplication(p, entry) {
  const draft = await loadDraft();
  await openSiteWith({
    ...draft,
    profileId: p.id,
    mission: entry.mission || draft.mission,
    purpose: entry.purpose || draft.purpose,
    tempId: entry.id,
  }, 'resume');
  toast(`${t('resume')}: ${entry.id}`);
}

function tempIdsCard(p, list, rerender) {
  const mine = tempIdsOf(p, list);
  if (!mine.length) return null;
  return h('div', { class: 'card' }, h('h3', {}, t('tempIdsFor')), ...mine.map(x => h('div', { class: 'tempid' },
    h('div', {},
      h('code', { title: t('copyTip'), onclick: () => navigator.clipboard.writeText(x.id).then(() => toast(t('copied'))) }, x.id),
      h('div', { style: 'color:var(--muted)' }, `${new Date(x.at).toLocaleDateString()}${x.lastPage ? ' · ' + t('lastPage') + ': ' + x.lastPage : ''}`)),
    x.appId ? null : h('button', { style: 'padding:3px 8px;font-size:12px', onclick: () => resumeApplication(p, x) }, '↻ ' + t('resume')),
    h('button', { class: 'danger', style: 'padding:3px 8px;font-size:12px', title: t('tempRemove'), onclick: () => removeTempIds(y => y.id === x.id).then(rerender) }, '✕'))));
}

// Removes Temporary IDs from the saved list (only from this list: the application on the visa site is not touched).
// Returns how many were removed.
async function removeTempIds(match) {
  const list = await IVH.store.list('tempIds');
  const keep = list.filter(x => !match(x));
  if (keep.length !== list.length) await IVH.store.set('tempIds', keep);
  return list.length - keep.length;
}
// Finished (submitted) or older than 30 days: the site's unfinished drafts expire by then.
const tempIdDone = x => !!x.appId || Date.now() - (x.at || 0) > 30 * 864e5;

// ---------- application history ----------
// Submitted applications of one applicant, with status check, final PDF and adding an older Application Id.
function applicationsCard(p, list, rerender) {
  if (!p.id) return h('div', { class: 'card' }, h('h3', {}, t('appsTitle')), h('div', { class: 'note' }, t('appsSaveFirst')));
  const input = h('input', { placeholder: t('appIdPh'), maxlength: 12, style: 'flex:1;text-transform:uppercase' });
  const add = async () => {
    const id = input.value.trim().toUpperCase();
    if (!IVH.isAppId(id)) return toast('⚠ ' + t('appBadId'), 4000);
    await IVH.saveApplication({ id, profileId: p.id, name: IVH.fullName(p), passportNo: p.passportNo, dob: p.dob, visaType: IVH.profileVisaType(p), source: 'manual' });
    rerender();
    refreshStart();
  };
  return h('div', { class: 'card' }, h('h3', {}, t('appsTitle')),
    ...IVH.applicationsOf(p, list).map(a => appRow(a, rerender)),
    h('div', { class: 'note', style: 'margin-top:6px' }, t('appsHelp')),
    h('div', { style: 'display:flex;gap:6px' }, input, h('button', { style: 'flex:0 0 auto', onclick: add }, t('appAdd'))));
}

// One application: id (copy), mission, type, date, last status; buttons for status, PDF, attach and remove.
function appRow(a, rerender, withName = false) {
  const mission = IVH.MISSIONS.find(([c]) => c === a.mission)?.[1] || a.mission || '';
  const type = IVH.PROFILE_VISA_TYPES.find(x => x[0] === a.visaType)?.[IVH.lang() === 'bn' ? 2 : 1] || '';
  const small = { style: 'padding:3px 8px;font-size:12px' };
  // The PDF the site downloaded on submit can be dropped onto the row (from Finder / File Explorer / Chrome's
  // download bar) or picked with "Add downloaded PDF"; it is kept with the application.
  const row = h('div', { class: 'tempid app-row', style: 'flex-direction:column;gap:4px' },
    h('div', {},
      withName ? h('div', { style: 'font-weight:600' }, a.name || '—') : null,
      h('code', { title: t('copyTip'), onclick: () => navigator.clipboard.writeText(a.id).then(() => toast(t('copied'))) }, a.id),
      h('div', { style: 'color:var(--muted)' }, [mission, type, a.submittedAt ? t('appSubmitted') + ' ' + new Date(a.submittedAt).toLocaleDateString() : t('appAdded') + ' ' + new Date(a.at).toLocaleDateString()].filter(Boolean).join(' · ')),
      h('div', {}, a.status ? [h('b', {}, t('appStatus') + ': '), a.status.text, h('span', { style: 'color:var(--muted)' }, ` (${t('appChecked')} ${new Date(a.status.at).toLocaleString()})`)] : h('span', { style: 'color:var(--muted)' }, t('appNoStatus'))),
      a.pdf ? h('div', { style: 'color:var(--muted)' }, `📄 ${a.pdf.name} · ${Math.round(a.pdf.size / 1024)} KB`) : null),
    h('div', { style: 'display:flex;gap:4px;flex-wrap:wrap' },
      h('button', { ...small, onclick: () => openSiteJob('status', a) }, '🔎 ' + t('appStatusBtn')),
      a.pdf ? h('button', { ...small, title: t('docView'), onclick: () => window.open(URL.createObjectURL(dataUrlToBlob(a.pdf.dataUrl))) }, '👁') : null,
      a.pdf ? h('button', { ...small, title: t('downloadTip'), onclick: () => { const l = document.createElement('a'); l.href = URL.createObjectURL(dataUrlToBlob(a.pdf.dataUrl)); l.download = a.pdf.name; l.click(); } }, '⬇') : null,
      h('button', { ...small, onclick: () => openSiteJob('print', a) }, '📄 ' + t(a.pdf ? 'appPdfAgain' : 'appPdfBtn')),
      h('button', { ...small, class: a.pdf ? '' : 'pill outline', onclick: () => attachAppPdf(a, rerender) }, '📎 ' + t(a.pdf ? 'appAttachAgain' : 'appAttach')),
      h('button', { ...small, class: 'danger', onclick: async () => {
        if (!confirm(t('appRemove'))) return;
        await IVH.store.remove('applications', a.id);
        rerender();
        refreshStart();
      } }, '✕')));
  const hasFile = e => [...(e.dataTransfer?.types || [])].includes('Files');
  row.addEventListener('dragover', e => { if (hasFile(e)) { e.preventDefault(); row.classList.add('over'); } });
  row.addEventListener('dragleave', e => { if (!row.contains(e.relatedTarget)) row.classList.remove('over'); });
  row.addEventListener('drop', e => {
    e.preventDefault();
    row.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (!f || !(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) return toast('⚠ ' + t('appPdfOnly'), 3500);
    attachAppPdf(a, rerender, f);
  });
  return row;
}

// Opens the site's Visa Status Enquiry or Print Registered Application page in a new tab; the content script
// fills it from the application and the applicant types the captcha.
async function openSiteJob(kind, a) {
  if (kind === 'print' && !a.dob && !(await IVH.store.find('profiles', a.profileId))?.dob) return toast('⚠ ' + t('appNoDob'), 4000);
  await IVH.store.set('siteJob', { kind, appId: a.id, profileId: a.profileId, at: Date.now() });
  await chrome.tabs.create({ url: IVH.SITE + (kind === 'print' ? 'PrintApplication' : 'StatusEnquiry') });
  toast(t('appOpening'), 3000);
}

// For a PDF saved by hand (e.g. the browser's Print → Save as PDF).
async function attachAppPdf(a, rerender, dropped = null) {
  const f = dropped || await pickFile('application/pdf');
  if (!f) return;
  const tools = await import('../lib/image-tools.js');
  await IVH.saveApplication({ id: a.id, pdf: { name: IVH.appPdfName(a), size: f.size, dataUrl: await tools.readAsDataUrl(f), at: Date.now() } });
  toast(t('saved'));
  rerender();
  refreshStart();
}

// ---------- settings ----------
async function showSettings() {
  const sec = $('#tab-settings');
  const st = await IVH.settings();
  const save = async patch => { Object.assign(st, patch); await IVH.store.set('settings', st); toast(t('saved')); };
  setKids(sec, 
    h('div', { class: 'card' },
      h('label', { class: 'f' }, h('span', {}, t('language')),
        h('select', { onchange: async e => { await save({ lang: e.target.value }); applyLang(e.target.value); } }, opt('en', 'English', st.lang === 'en'), opt('bn', 'বাংলা', st.lang === 'bn'))),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: st.autoAdvance, onchange: e => save({ autoAdvance: e.target.checked }) }), t('autoAdvance')),
      h('label', { class: 'f' }, h('span', {}, t('scanEngine')),
        h('select', { onchange: e => save({ scanEngine: e.target.value }) },
          opt('', '— ' + t('scanAsk') + ' —', !st.scanEngine), opt('server', t('scanServer'), st.scanEngine === 'server' || st.scanEngine === 'smart'), opt('local', t('scanLocal'), st.scanEngine === 'local'))),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: st.autoDeclare !== false, onchange: e => save({ autoDeclare: e.target.checked }) }), t('autoDeclare')),
      h('div', { class: 'note', style: 'margin:0 0 8px' }, t('autoDeclareHelp')),
      h('label', { class: 'f' }, h('span', {}, t('delay')), h('input', { type: 'number', min: '500', step: '100', value: st.delayMs, onchange: e => save({ delayMs: Math.max(500, +e.target.value || 1200) }) })),
      h('div', { class: 'note', style: 'margin:0' }, t('bdRefRule'))),
    exampleCard(),
    aiSettingsCard(st, save),
    syncCard(st, save),
    lockCard(st, save),
    h('div', { class: 'card' },
      h('div', { class: 'toolbar' },
        h('button', { onclick: exportBackup }, '⬇ ' + t('exportData')),
        h('button', { onclick: importBackup }, '⬆ ' + t('importData'))),
      h('button', { style: 'width:100%', onclick: importCsv }, '⬆ ' + t('importHotels')),
      h('div', { class: 'note', style: 'margin-top:8px' }, t('csvHelp')),
      h('div', { class: 'note', style: 'margin-top:8px' }, t('familyFormNote'), ' ',
        h('a', { href: FAMILY_FORM_URL, target: '_blank' }, FAMILY_FORM_URL.replace('https://', '')), ' ',
        h('button', { style: 'padding:2px 8px;font-size:12px', onclick: () => navigator.clipboard.writeText(FAMILY_FORM_URL).then(() => toast(t('copied'))) }, t('lettersCopy')))),
  );
}
// Phone form on the helper website: a relative or client fills their own details and sends the file (no upload).
const FAMILY_FORM_URL = 'https://ivh.techistbd.com/family';

// AI passport scan settings: Claude (Anthropic) or any OpenAI-compatible server. Keys stay in this
// browser and are left out of backups.
function aiSettingsCard(st, save) {
  const provider = st.aiProvider || 'anthropic';
  const body = h('div');
  const base = h('input', { type: 'text', placeholder: 'https://api.openai.com/v1', value: st.oaBaseUrl || '' });
  const model = h('input', { type: 'text', placeholder: t('oaModelPh'), value: st.oaModel || '', list: 'oa-models' });
  const key = h('input', { type: 'password', autocomplete: 'off', placeholder: t('oaKeyPh'), value: st.oaKey || '' });
  // Ask the server which models it has, instead of guessing names that may not exist there.
  const modelList = h('datalist', { id: 'oa-models' });
  const modelPick = h('select', { hidden: true, style: 'margin-bottom:8px', onchange: e => { model.value = e.target.value; } });
  const listModels = async () => {
    let url;
    try { url = new URL(base.value.trim()); } catch { return toast('⚠ ' + t('oaBadUrl'), 4000); }
    const asked = await askOrigin(url.origin + '/*');
    if (asked !== 'ok') return toast('⚠ ' + t(asked === 'denied' ? 'oaNoPermission' : 'oaNotAllowed'), 6000);
    toast(t('working'), 20000);
    try {
      const ids = await (await import('../lib/ai-client.js')).listOpenAIModels(base.value, key.value.trim());
      setKids(modelList, ...ids.map(v => h('option', { value: v })));
      setKids(modelPick, opt('', `— ${ids.length} ${t('oaModelsFound')} —`), ...ids.map(v => opt(v, v, v === model.value)));
      modelPick.hidden = !ids.length;
      toast(ids.length ? `✓ ${ids.length} ${t('oaModelsFound')}` : t('oaNoModels'), 4000);
    } catch (e) {
      toast(e.message === 'bad-api-key' ? t('aiBadKey') : e.message === 'offline' ? t('aiOffline') : '⚠ ' + e.message, 6000);
    }
  };
  const saveOpenAI = async () => {
    let url;
    try { url = new URL(base.value.trim()); } catch { return toast('⚠ ' + t('oaBadUrl'), 4000); }
    // Chrome must allow the extension to call this server; asked once per server, from this click.
    const asked = await askOrigin(url.origin + '/*');
    if (asked !== 'ok') return toast('⚠ ' + t(asked === 'denied' ? 'oaNoPermission' : 'oaNotAllowed'), 6000);
    await save({ oaBaseUrl: base.value.trim(), oaModel: model.value.trim(), oaKey: key.value.trim() });
  };
  if (provider === 'helper') {
    const code = h('input', { type: 'password', autocomplete: 'off', placeholder: 'IVH-XXXX-XXXX-XXXX', value: st.helperCode || '' });
    const info = h('div', { class: 'note', hidden: true });
    const check = async (persist = true) => {
      const c = code.value.trim().toUpperCase();
      if (!c) return code.focus();
      if (persist) await save({ helperCode: c });
      try {
        const me = await (await import('../lib/ai-client.js')).helperStatus(c);
        info.className = 'note ok';
        info.textContent = t('helperOk').replace('{name}', me.name).replace('{used}', me.used).replace('{limit}', me.limit) + (me.enabled ? '' : ' ' + t('helperOff'));
      } catch (e) {
        info.className = 'note warn';
        info.textContent = AI_ERRORS[e.message] ? t(AI_ERRORS[e.message]) : '⚠ ' + e.message;
      }
      info.hidden = false;
    };
    setKids(body,
      h('div', { class: 'note' }, t('helperPrivacy')),
      h('label', { class: 'f' }, h('span', {}, t('helperCode')), code),
      h('button', { class: 'primary', style: 'width:100%', onclick: () => check() }, t('helperSave')),
      info,
      h('div', { class: 'note', style: 'margin:8px 0 0' }, t('helperHelp')));
    if (st.helperCode) check(false);
  } else if (provider === 'openai') {
    setKids(body,
      h('div', { class: 'note' }, t('oaPrivacy')),
      h('label', { class: 'f' }, h('span', {}, t('oaBaseUrl')), base),
      h('label', { class: 'f' }, h('span', {}, t('oaKey')), key),
      h('label', { class: 'f' }, h('span', {}, t('oaModel')), model, modelList),
      h('button', { style: 'width:100%;margin-bottom:8px', onclick: listModels }, '↻ ' + t('oaListModels')),
      modelPick,
      h('button', { class: 'primary', style: 'width:100%', onclick: saveOpenAI }, t('oaSave')),
      h('div', { class: 'note', style: 'margin:8px 0 0' }, t('oaHelp')));
  } else {
    setKids(body,
      h('div', { class: 'note' }, t('aiPrivacy')),
      h('label', { class: 'f' }, h('span', {}, t('aiKey')),
        h('input', { type: 'password', autocomplete: 'off', placeholder: 'sk-ant-…', value: st.aiKey || '', onchange: e => save({ aiKey: e.target.value.trim() }) })),
      h('label', { class: 'f' }, h('span', {}, t('aiModel')),
        h('select', { onchange: e => save({ aiModel: e.target.value }) }, ...IVH.AI_MODELS.map(([v, l]) => opt(v, l, (st.aiModel || IVH.DEFAULT_AI_MODEL) === v)))),
      h('div', { class: 'note', style: 'margin:0' }, t('aiKeyHelp')));
  }
  const withKey = h('input', { type: 'checkbox' });
  const share = h('div', { style: 'margin-top:10px;border-top:1px dashed var(--line);padding-top:10px' },
    h('label', { class: 'chk' }, withKey, t('aiShareKey')),
    h('button', { style: 'width:100%', onclick: () => exportAiSetup(withKey.checked) }, '⬇ ' + t('aiShare')),
    h('div', { class: 'note', style: 'margin:8px 0 0' }, t('aiShareHelp')));
  return h('div', { class: 'card' },
    h('h3', {}, '✨ ' + t('aiTitle')),
    h('div', { class: 'note ok', style: 'margin:0 0 8px' }, '✅ ' + t('freeNote')),
    h('label', { class: 'f' }, h('span', {}, t('aiProvider')),
      h('select', { onchange: async e => { await save({ aiProvider: e.target.value }); showSettings(); } },
        opt('helper', t('helperProvider'), provider === 'helper'),
        opt('anthropic', 'Anthropic (Claude)', provider === 'anthropic'),
        opt('openai', t('oaProvider'), provider === 'openai'))),
    body,
    provider === 'helper' ? null : share);
}

// ---------- example data (try the extension right after installing) ----------
function exampleCard() {
  return h('div', { class: 'card' },
    h('h3', {}, '🧪 ' + t('exTitle')),
    h('div', { class: 'note' }, t('exHelp')),
    h('button', { class: 'primary', style: 'width:100%;margin-bottom:6px', onclick: addExampleData }, '+ ' + t('exAdd')),
    h('div', { class: 'row' },
      h('button', { onclick: () => downloadSample('bgd') }, '⬇ ' + t('exBgd')),
      h('button', { onclick: () => downloadSample('passport') }, '⬇ ' + t('exPassport'))),
    h('button', { class: 'danger', style: 'width:100%;margin-top:6px', onclick: removeExampleData }, t('exRemove')));
}

// Adds the made-up Tourist applicant, the example hotel and Start screen choices that pass the pre-flight check.
async function addExampleData() {
  const profiles = await IVH.store.list('profiles');
  if (profiles.some(p => p.example)) { toast(t('exExists'), 4000); return; }
  toast(t('working'), 20000);
  const { exampleRecords } = await import('../lib/example-data.js');
  const { profile, hotel } = await exampleRecords();
  const savedHotel = await IVH.store.upsert('hotels', hotel);
  const saved = await IVH.store.upsert('profiles', profile);
  const d = new Date(Date.now() + 30 * 864e5);
  const journeyDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await saveDraft({ profileId: saved.id, mission: 'BGDD', purpose: '544', journeyDate, email: profile.email, duration: '12', entries: '2',
    portIn: 'BY AIR/ HARIDASPUR', portOut: 'BY AIR/ HARIDASPUR', places: 'KOLKATA, DARJEELING', hotelId: savedHotel.id, refIndia: 'hotel', refBd: 'spouse' });
  toast(t('exAdded'), 7000);
  renderAll();
  document.querySelector('[data-tab=start]').click();
}

async function removeExampleData() {
  if (!confirm(t('exRemoveConfirm'))) return;
  const { EXAMPLE, EXAMPLE_HOTEL } = await import('../lib/example-data.js');
  // Example records, plus those an import of the sample BGD PDF created (same made-up passport, hotel and reference).
  const isExample = p => p.example || p.passportNo === EXAMPLE.passportNo;
  const profiles = await IVH.store.list('profiles'), hotels = await IVH.store.list('hotels'), contacts = await IVH.store.list('contacts');
  const gone = profiles.filter(isExample).map(p => p.id);
  await IVH.store.set('profiles', profiles.filter(p => !isExample(p)));
  await IVH.store.set('hotels', hotels.filter(x => !x.example && x.name !== EXAMPLE_HOTEL.name));
  await IVH.store.set('contacts', contacts.filter(c => !(c.name === EXAMPLE.spouseName && c.phone === EXAMPLE.mobile) && c.name !== EXAMPLE_HOTEL.name));
  await IVH.store.set('tempIds', (await IVH.store.list('tempIds')).filter(x => !gone.includes(x.profileId)));
  const draft = await loadDraft();
  if (gone.includes(draft.profileId)) await saveDraft({ profileId: '' });
  toast(t('exRemoved'), 4000);
  renderAll();
}

async function downloadSample(kind) {
  const ex = await import('../lib/example-data.js');
  if (kind === 'bgd') download('SAMPLE_BGD_RINA_DAS.pdf', await ex.sampleBgdPdf(), 'application/pdf');
  else download('SAMPLE_PASSPORT_RINA_DAS.jpg', await ex.samplePassportJpeg(), 'image/jpeg');
  toast(t(kind === 'bgd' ? 'exBgdSaved' : 'exPassportSaved'), 7000);
}

// ---------- panel lock (PIN) ----------
// Hides the side panel behind a PIN, and locks again after a while without use. It protects the screen on a shared
// computer; the data itself stays in Chrome's storage (use a locked backup to move it safely).
function lockCard(st, save) {
  const minutes = h('select', { onchange: e => save({ lock: { ...st.lock, minutes: +e.target.value } }) },
    ...[5, 15, 30, 60].map(m => opt(String(m), `${m} ${t('minutes')}`, (st.lock?.minutes || 15) === m)));
  return h('div', { class: 'card' },
    h('h3', {}, '🔒 ' + t('lockTitle')),
    h('div', { class: 'note' }, t('lockHelp')),
    st.lock?.hash
      ? h('div', {}, h('label', { class: 'f' }, h('span', {}, t('lockAfter')), minutes),
        h('div', { class: 'row' },
          h('button', { onclick: () => lockPanel() }, '🔒 ' + t('lockNow')),
          h('button', { class: 'danger', onclick: async () => { if (await checkPin(st)) { await save({ lock: null }); showSettings(); } } }, t('lockRemove'))))
      : h('button', { style: 'width:100%', onclick: async () => {
        const pin = await askPassword(t('lockSet'), t('lockSetHelp'), true);
        if (!pin) return;
        await save({ lock: { ...(await (await import('../lib/crypto.js')).hashPin(pin)), minutes: 15 } });
        showSettings();
      } }, t('lockSet')));
}

async function checkPin(st) {
  const pin = await askPassword(t('lockEnter'), '');
  if (pin === null) return false;
  const { hash } = await (await import('../lib/crypto.js')).hashPin(pin, st.lock.salt);
  if (hash !== st.lock.hash) { toast('⚠ ' + t('pwWrong'), 3000); return false; }
  return true;
}

let lastUse = Date.now();
async function lockPanel() {
  const st = await IVH.settings();
  if (!st.lock?.hash || $('#lock')) return;
  const box = h('div', { id: 'lock', style: 'position:fixed;inset:0;z-index:50;background:var(--bg,#f6f8fb);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;text-align:center' },
    h('div', { style: 'font-size:40px' }, '🔒'),
    h('div', { style: 'font-weight:600' }, t('lockedText')),
    h('button', { class: 'primary', onclick: async () => { if (await checkPin(await IVH.settings())) { box.remove(); lastUse = Date.now(); } } }, t('lockUnlock')));
  document.body.append(box);
}
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { lastUse = Date.now(); }, true));
setInterval(async () => {
  const st = await IVH.settings();
  if (st.lock?.hash && Date.now() - lastUse > (st.lock.minutes || 15) * 60e3) lockPanel();
}, 30e3);
IVH.settings().then(st => { if (st.lock?.hash) lockPanel(); });

// ---------- agency sync ----------
// One encrypted copy of the applicant list on the helper server, shared by the agency's computers. Encrypted here
// with the agency password; the server only stores the encrypted file. Needs a Helper AI access code (invited).
// Documents and application PDFs stay on each computer (too large to sync).
const SYNC_URL = 'https://ivh.techistbd.com/api/sync/';
const SYNC_KEYS = ['profiles', 'hotels', 'hospitals', 'contacts', 'tempIds', 'applications', 'addresses'];
let syncPassword = null; // kept only while the panel is open

function syncCard(st, save) {
  const info = h('div', { class: 'note', hidden: !st.syncAt }, st.syncAt ? t('syncLast').replace('{when}', new Date(st.syncAt).toLocaleString()) : '');
  return h('div', { class: 'card' },
    h('h3', {}, '🔄 ' + t('syncTitle')),
    h('div', { class: 'note' }, t('syncHelp')),
    h('button', { class: 'primary', style: 'width:100%', onclick: async () => {
      if (!st.helperCode) { toast(t('syncNeedCode'), 6000); return; }
      if (!syncPassword) syncPassword = await askPassword(t('syncPwTitle'), t('syncPwHelp'), !st.syncAt);
      if (!syncPassword) return;
      toast(t('working'), 60000);
      try {
        const n = await syncNow(st, syncPassword);
        await save({ syncAt: Date.now() });
        toast(t('syncDone').replace('{n}', n), 5000);
        renderAll();
      } catch (e) {
        if (e.message === 'wrong-password') syncPassword = null;
        const msg = { 'wrong-password': 'syncWrongPw', 'helper-bad-code': 'helperBadCode', 'too-large': 'syncTooLarge', offline: 'aiOffline' }[e.message];
        toast('⚠ ' + (msg ? t(msg) : e.message), 7000);
      }
    } }, '🔄 ' + t('syncNow')),
    info);
}

async function syncNow(st, password) {
  const { encryptJson, decryptJson, syncSpaceId } = await import('../lib/crypto.js');
  const url = SYNC_URL + await syncSpaceId(password);
  const headers = { Authorization: `Bearer ${st.helperCode}`, 'Content-Type': 'application/json' };
  const call = async (method, body) => {
    let res;
    try { res = await fetch(url, { method, headers, body, cache: 'no-store' }); } catch { throw new Error('offline'); }
    if (res.status === 401) throw new Error('helper-bad-code');
    if (res.status === 413) throw new Error('too-large');
    return res;
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    // 1. Download and merge the shared copy.
    const res = await call('GET');
    const remote = res.status === 404 ? { version: 0 } : await res.json();
    let merged = 0;
    if (remote.box) {
      const data = await decryptJson(remote.box, password);
      for (const k of SYNC_KEYS) merged += await mergeInto(k, data[k] || []);
    }
    // 2. Upload this computer's merged list (without documents and PDFs).
    const local = {};
    for (const k of SYNC_KEYS) local[k] = (await IVH.store.list(k)).map(x => stripLarge(k, x));
    const up = await call('PUT', JSON.stringify({ baseVersion: remote.version || 0, box: await encryptJson(local, password) }));
    if (up.status === 409) continue; // another computer synced in between: merge again
    if (!up.ok) throw new Error(`HTTP ${up.status}`);
    return merged;
  }
  throw new Error('busy');
}

const stripLarge = (k, x) => {
  if (k === 'profiles') { const { docs, ...rest } = x; return rest; }
  if (k === 'applications') { const { pdf, ...rest } = x; return rest; }
  return x;
};

// Adds or updates items by id; the newer change wins. Local documents and PDFs are kept.
async function mergeInto(key, incoming) {
  const list = await IVH.store.list(key);
  let changed = 0;
  for (const item of incoming) {
    if (!item?.id) continue;
    const i = list.findIndex(x => x.id === item.id);
    if (i < 0) { list.push(item); changed++; continue; }
    const cur = list[i];
    if ((item.updatedAt || item.at || 0) > (cur.updatedAt || cur.at || 0)) {
      list[i] = { ...item, ...(cur.docs && !item.docs ? { docs: cur.docs } : {}), ...(cur.pdf && !item.pdf ? { pdf: cur.pdf } : {}) };
      changed++;
    }
  }
  if (changed) await IVH.store.set(key, list);
  return changed;
}

async function exportBackup() {
  const keys = ['profiles', 'hotels', 'hospitals', 'contacts', 'settings', 'tempIds', 'applications', 'addresses'];
  const data = { app: 'indian-visa-helper', version: 1, exportedAt: new Date().toISOString() };
  for (const k of keys) data[k] = await IVH.store.get(k, k === 'settings' ? {} : []);
  // Never put the API key in a backup file that may be shared.
  delete data.settings.aiKey;
  delete data.settings.oaKey;
  delete data.settings.helperCode;
  delete data.settings.lock;
  const password = await askPassword(t('backupPwTitle'), t('backupPwHelp'), true, true);
  if (password === null) return;
  const out = password ? await (await import('../lib/crypto.js')).encryptJson(data, password) : data;
  download(`visa-helper-backup-${new Date().toISOString().slice(0, 10)}${password ? '-locked' : ''}.json`, JSON.stringify(out));
}

// Small password dialog. `confirm`: ask twice. `optional`: an empty answer means "no password".
// Resolves to the password, '' (no password, only when optional) or null (cancelled).
function askPassword(title, help, confirm = false, optional = false) {
  return new Promise(resolve => {
    const a = h('input', { type: 'password', autocomplete: 'new-password' });
    const b = h('input', { type: 'password', autocomplete: 'new-password' });
    const err = h('div', { class: 'note warn', hidden: true });
    let answer = null;
    const ok = () => {
      if (!a.value && !optional) return a.focus();
      if (a.value && a.value.length < 6) { err.textContent = t('pwShort'); err.hidden = false; return; }
      if (confirm && a.value !== b.value) { err.textContent = t('pwMismatch'); err.hidden = false; return; }
      answer = a.value;
      dlg.close();
    };
    const dlg = h('dialog', { style: 'border:0;border-radius:12px;padding:14px;width:300px' },
      h('h3', { style: 'margin:0 0 6px;color:var(--navy)' }, '🔒 ' + title),
      help ? h('div', { class: 'note' }, help) : null,
      h('label', { class: 'f' }, h('span', {}, t('password')), a),
      confirm ? h('label', { class: 'f' }, h('span', {}, t('passwordAgain')), b) : null,
      err,
      h('div', { class: 'row', style: 'margin-top:8px' },
        h('button', { onclick: () => dlg.close() }, t('cancel')),
        h('button', { class: 'primary', onclick: ok }, t('ok'))));
    a.addEventListener('keydown', e => { if (e.key === 'Enter' && !confirm) ok(); });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(answer); });
    document.body.append(dlg);
    dlg.showModal();
    a.focus();
  });
}

async function importBackup() {
  const f = await pickFile('application/json,.json');
  if (!f) return;
  try {
    let data = JSON.parse(await f.text());
    if (data.app !== 'indian-visa-helper') throw new Error('Not a Visa Helper backup');
    if (data.encrypted) {
      const password = await askPassword(t('backupPwOpen'), '');
      if (password === null) return;
      try { data = await (await import('../lib/crypto.js')).decryptJson(data, password); } catch { return toast('⚠ ' + t('pwWrong'), 5000); }
    }
    // A shared AI setup (from "Share AI setup"): only the AI service settings, maybe with a key.
    if (data.aiSettings) {
      const allowed = ['aiProvider', 'aiModel', 'aiKey', 'oaBaseUrl', 'oaModel', 'oaKey'];
      const patch = Object.fromEntries(Object.entries(data.aiSettings).filter(([k]) => allowed.includes(k)));
      await IVH.store.set('settings', { ...(await IVH.settings()), ...patch });
    }
    for (const k of ['profiles', 'hotels', 'hospitals', 'contacts', 'tempIds', 'applications', 'addresses']) {
      const cur = await IVH.store.list(k);
      for (const item of data[k] || []) {
        const i = cur.findIndex(x => x.id === item.id);
        if (i >= 0) cur[i] = item; else cur.push(item);
      }
      await IVH.store.set(k, cur);
    }
    toast(data.aiSettings ? t('aiSetupImported') : t('saved'), data.aiSettings ? 6000 : 2200);
    renderAll();
  } catch (e) { toast('⚠ ' + e.message, 4000); }
}

// "Share AI setup": a small file with the AI service settings for another computer. The key is only
// included when the box is ticked; send such a file privately and revoke the key when testing ends.
async function exportAiSetup(includeKey) {
  const st = await IVH.settings();
  const aiSettings = { aiProvider: st.aiProvider || 'anthropic', aiModel: st.aiModel, oaBaseUrl: st.oaBaseUrl, oaModel: st.oaModel };
  if (includeKey) Object.assign(aiSettings, { aiKey: st.aiKey, oaKey: st.oaKey });
  const data = { app: 'indian-visa-helper', kind: 'ai-setup', version: chrome.runtime.getManifest().version, includesKey: !!includeKey, aiSettings };
  download(includeKey ? 'visa-helper-ai-setup-WITH-KEY.json' : 'visa-helper-ai-setup.json', JSON.stringify(data, null, 1));
}

// Chrome only lets the extension reach the AI servers listed under optional_host_permissions in the manifest.
// Asks for one from the click: 'ok', 'denied' (the user said no) or 'notallowed' (not in the manifest's list).
async function askOrigin(origin) {
  try { return (await chrome.permissions.request({ origins: [origin] })) ? 'ok' : 'denied'; } catch { return 'notallowed'; }
}

// AI calls to an OpenAI-compatible server need Chrome's permission for that site; ask from the click if missing
// (e.g. after importing a shared AI setup).
async function ensureAiPermission(st) {
  if (st.aiProvider !== 'openai' || !st.oaBaseUrl) return true;
  let origin;
  try { origin = new URL(st.oaBaseUrl).origin + '/*'; } catch { return false; }
  if (await chrome.permissions.contains({ origins: [origin] }).catch(() => false)) return true;
  return chrome.permissions.request({ origins: [origin] }).catch(() => false);
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

async function importCsv() {
  const f = await pickFile('.csv,text/csv');
  if (!f) return;
  const rows = parseCsv(await f.text());
  if (!rows.length) return toast('⚠ ' + t('csvEmpty'), 4000);
  const head = rows[0].map(x => x.trim().toLowerCase());
  const body = head.includes('name') ? rows.slice(1) : rows;
  const cols = head.includes('name') ? head : ['type', 'name', 'address1', 'address2', 'state', 'district', 'phone', 'doctor'];
  let n = 0;
  for (const r of body) {
    const o = Object.fromEntries(cols.map((c, i) => [c, c === 'email' ? (r[i] || '').trim().toLowerCase() : (r[i] || '').trim().toUpperCase()]));
    if (!o.name) continue;
    const type = o.type || 'HOTEL';
    const rec = { name: o.name, address1: o.address1, address2: o.address2, state: o.state || 'WEST BENGAL', district: o.district, phone: o.phone, ...(o.email ? { email: o.email } : {}) };
    const key = type.startsWith('HOSP') ? 'hospitals' : type.startsWith('REF') ? 'contacts' : 'hotels';
    if (key === 'hospitals') Object.assign(rec, { doctor: o.doctor, treatment: 'MEDICAL TREATMENT' });
    if (key === 'contacts') rec.country = type === 'REF_IN' ? 'IN' : 'BD';
    const cur = await IVH.store.list(key);
    const same = cur.find(x => x.name === rec.name);
    await IVH.store.upsert(key, same ? { ...same, ...rec } : rec);
    n++;
  }
  toast(`✓ ${n}`);
  renderAll();
}

// ---------- wiring ----------
// "Find hotels" box on the Hotels tab: kept across list re-renders so results stay visible after saving one.
const hotelFinder = (() => {
  let box, city, results, builtLang, useAi, aiRow;
  const build = () => {
  city = h('input', { type: 'text', placeholder: t('hfCityPh'), onkeydown: e => { if (e.key === 'Enter') find(); } });
  results = h('div');
  // Free search for everyone (helper server: OpenStreetMap, hotel websites, Google); AI search only with an AI service.
  useAi = h('input', { type: 'checkbox' });
  aiRow = h('label', { class: 'chk', style: 'margin:6px 0 0', hidden: true }, useAi, t('hfUseAi'));
  IVH.settings().then(st => { aiRow.hidden = !aiIsReady(st); });
  box = h('div', { class: 'card', style: 'flex-basis:100%;margin:6px 0 0' },
    h('h3', {}, '🏨 ' + t('hfTitle')),
    h('div', { class: 'row' }, city, h('button', { class: 'primary', style: 'flex:0 0 auto', onclick: () => find() }, t('hfFind'))),
    aiRow,
    results);
  builtLang = IVH.lang();
  };
  let refreshList = () => {};

  async function find() {
    if (!city.value.trim()) return city.focus();
    const st = await IVH.settings();
    if (!useAi.checked) return findFree(city.value.trim());
    const ready = aiIsReady(st);
    if (!ready) { toast(t('aiNeedKey'), 5000); document.querySelector('[data-tab=settings]').click(); return; }
    if (!(await ensureAiPermission(st))) return toast('⚠ ' + t('oaNoPermission'), 5000);
    setKids(results, h('div', { class: 'note' }, h('span', { class: 'spinner' }), t('hfSearching')));
    try {
      const hotels = await (await import('../lib/ai-hotels.js')).findHotels(city.value, st);
      if (!hotels.length) return setKids(results, h('div', { class: 'note warn' }, t('hfNone')));
      setKids(results,
        ['openai', 'helper'].includes(st.aiProvider) ? h('div', { class: 'note warn' }, t('hfMemoryWarn')) : h('div', { class: 'note' }, t('hfWebNote')),
        ...hotels.map(hotel => h('div', { class: 'item', style: 'display:block' },
          h('div', { class: 'ttl' }, hotel.name),
          h('div', { class: 'sub', style: 'white-space:normal' }, [hotel.address1, hotel.address2].filter(Boolean).join(', ')),
          h('div', { class: 'sub' }, [hotel.district, hotel.state, hotel.phone || t('hfNoPhone')].join(' · ')),
          /^https?:\/\//i.test(hotel.aiSource || '') ? h('a', { href: hotel.aiSource, target: '_blank', class: 'sub', style: 'display:block' }, '🔗 ' + hotel.aiSource) : null,
          h('div', { class: 'row', style: 'margin-top:6px' },
            h('button', { onclick: () => saveHotel(hotel, false) }, t('save')),
            h('button', { class: 'primary', onclick: () => saveHotel(hotel, true) }, t('hfSaveUse'))))));
    } catch (e) {
      const known = AI_ERRORS;
      setKids(results, h('div', { class: 'note warn' }, known[e.message] ? t(known[e.message]) : '⚠ ' + e.message));
    }
  }

  // Free search: real hotels from the helper server. A hotel without a phone number can only be saved once the user
  // types its real number (the visa form needs one); "Find phone" opens Google Maps for that hotel.
  async function findFree(place) {
    setKids(results, h('div', { class: 'note' }, h('span', { class: 'spinner' }), t('hfFreeSearching')));
    let data;
    try {
      const res = await fetch(`${HOTELS_URL}?city=${encodeURIComponent(place)}`, { cache: 'no-store' });
      data = await res.json();
      if (!res.ok) throw new Error(data.error || res.status);
    } catch (e) {
      const msg = { daily_limit: 'hfFreeLimit', city_not_found: 'hfNone', off: 'hfFreeOff' }[e.message];
      return setKids(results, h('div', { class: 'note warn' }, msg ? t(msg) : t('aiOffline')));
    }
    const { toHotel } = await import('../lib/ai-hotels.js');
    const showAll = h('input', { type: 'checkbox' });
    const list = h('div');
    const credit = { checked: t('hfSrcChecked'), google: 'Google', osm: '© OpenStreetMap' };
    // Three hotels at a time, with ‹ › to see more.
    const PER = 3;
    let page = 0;
    const pager = h('div', { class: 'row', style: 'align-items:center;justify-content:center;gap:10px;margin:4px 0 0' });
    const render = () => {
      const shown = data.hotels.filter(x => showAll.checked || x.phone);
      const pages = Math.max(1, Math.ceil(shown.length / PER));
      page = Math.min(page, pages - 1);
      const go = d => { page += d; render(); list.scrollIntoView({ block: 'nearest' }); };
      setKids(pager, shown.length > PER ? [
        h('button', { style: 'flex:0 0 auto;padding:4px 12px', disabled: page === 0, title: t('hfPrev'), onclick: () => go(-1) }, '‹'),
        h('span', { class: 'sub', style: 'flex:0 0 auto' }, t('hfPage').replace('{a}', page * PER + 1).replace('{b}', Math.min(shown.length, (page + 1) * PER)).replace('{n}', shown.length)),
        h('button', { style: 'flex:0 0 auto;padding:4px 12px', disabled: page >= pages - 1, title: t('hfNext'), onclick: () => go(1) }, '›'),
      ] : []);
      setKids(list, ...shown.slice(page * PER, page * PER + PER).map(raw => {
      const hotel = { ...toHotel(raw, data.city, true), aiSource: raw.sourceUrl || raw.website || '' };
      const phone = h('input', { type: 'tel', placeholder: t('hfPhonePh'), value: hotel.phone, style: 'margin-top:6px', hidden: !!hotel.phone });
      const save = use => {
        const p = phone.value.replace(/[^\d+]/g, '');
        if (p.replace(/\D/g, '').length < 8) { phone.hidden = false; phone.focus(); return toast(t('hfNeedPhone'), 4000); } // landlines may lack the area code
        saveHotel({ ...hotel, phone: p }, use);
      };
      return h('div', { class: 'item', style: 'display:block;border:1px solid #dde3ef;border-radius:10px;padding:10px;margin-bottom:8px' },
        h('div', { class: 'ttl' }, hotel.name, ' ', h('span', { class: 'badge ' + (raw.source === 'checked' ? 'tour' : 'opt') }, credit[raw.source] || raw.source)),
        h('div', { class: 'sub', style: 'white-space:normal' }, [hotel.address1, hotel.address2].filter(Boolean).join(', ') || '—'),
        h('div', { class: 'sub' }, [hotel.district, hotel.state, hotel.phone || t('hfNoPhone')].join(' · ')),
        hotel.phone ? null : h('a', { href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.name + ', ' + data.city)}`, target: '_blank', class: 'sub', style: 'display:block' }, '🔎 ' + t('hfFindPhone')),
        phone,
        h('div', { class: 'row', style: 'margin-top:6px' },
          h('button', { onclick: () => save(false) }, t('save')),
          h('button', { class: 'primary', onclick: () => save(true) }, t('hfSaveUse'))));
      }));
    };
    showAll.onchange = () => { page = 0; render(); };
    render();
    setKids(results,
      data.hotels.length ? h('div', { class: 'note' }, t('hfFreeNote').replace('{n}', data.hotels.length).replace('{p}', data.withPhone)) : h('div', { class: 'note warn' }, t('hfNone')),
      data.hotels.length > data.withPhone ? h('label', { class: 'chk' }, showAll, t('hfShowNoPhone')) : null,
      list,
      pager,
      h('div', { class: 'sub', style: 'color:var(--muted);margin-top:6px' }, t('hfCredit')));
  }

  // Saves to the Hotels list (updating one with the same name); "Save & use" also picks it for the next application,
  // with the India reference set to "Same as hotel".
  async function saveHotel(hotel, use) {
    const same = (await IVH.store.list('hotels')).find(x => x.name === hotel.name);
    const saved = await IVH.store.upsert('hotels', { ...(same || {}), ...hotel, id: same?.id });
    if (use) {
      await saveDraft({ hotelId: saved.id, refIndia: 'hotel' });
    }
    toast(use ? t('hfUsed') : t('saved'));
    refreshList();
    refreshStart();
  }

  // Built on first display, and again after a language switch.
  return showList => { refreshList = showList; if (!box || builtLang !== IVH.lang()) build(); return [box]; };
})();

// Free hotel search on the helper server (server/hotels.mjs).
const HOTELS_URL = 'https://ivh.techistbd.com/api/hotels';

// Checked hotels and hospitals published on the helper server (admin → directory); the user picks what to save.
const DIRECTORY_URL = 'https://ivh.techistbd.com/api/directory.json';
const directoryButton = (key, showList) => h('button', { onclick: async () => {
  let dir;
  try { dir = await (await fetch(DIRECTORY_URL, { cache: 'no-cache' })).json(); } catch { return toast('⚠ ' + t('aiOffline'), 4000); }
  const items = (dir[key] || []).filter(x => x && x.name);
  const mine = await IVH.store.list(key);
  const list = h('div', { class: 'list' });
  const render = () => setKids(list, items.length ? items.map(x => {
    const saved = mine.some(m => (m.name || '').toUpperCase() === x.name.toUpperCase());
    return h('div', { class: 'item' },
      h('div', { class: 'txt' }, h('div', { class: 'ttl' }, x.name), h('div', { class: 'sub' }, [x.address1, x.district, x.state, x.phone].filter(Boolean).join(' · '))),
      saved ? h('span', { class: 'badge tour' }, '✓') : h('button', { onclick: async () => {
        const clean = Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'note').map(([k, v]) => [k, k === 'email' ? String(v).toLowerCase() : String(v).toUpperCase()]));
        mine.push(await IVH.store.upsert(key, key === 'hospitals' ? { country: 'IN', ...clean } : clean));
        render(); showList(); refreshStart();
      } }, t('add')));
  }) : h('div', { class: 'empty' }, t('dirEmpty')));
  render();
  const dlg = h('dialog', { style: 'border:0;border-radius:12px;padding:14px;width:min(420px,94vw);max-height:90vh;overflow:auto' },
    h('h3', { style: 'margin:0 0 6px;color:var(--navy)' }, '📚 ' + t('dirTitle')),
    h('div', { class: 'note' }, t('dirHelp')), list,
    h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { onclick: () => dlg.close() }, t('close'))));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
} }, '📚 ' + t('dirButton'));

const hotelsTab = collectionTab({ key: 'hotels', schema: IVH.HOTEL_SCHEMA, section: $('#tab-hotels'), extraToolbar: showList => [...hotelFinder(showList), directoryButton('hotels', showList)], describe: x => [x.aiSource ? '🔗' : x.aiVerified === false ? '⚠' : '', x.address1, x.district, x.phone].filter(Boolean).join(' · ') });
const hospitalsTab = collectionTab({ key: 'hospitals', schema: IVH.HOSPITAL_SCHEMA, section: $('#tab-hospitals'), extraToolbar: showList => [directoryButton('hospitals', showList)], describe: x => [x.district, x.doctor, x.phone].filter(Boolean).join(' · ') });
const contactsTab = collectionTab({ key: 'contacts', schema: IVH.CONTACT_SCHEMA, section: $('#tab-contacts'), describe: x => [x.country === 'IN' ? '🇮🇳' : '🇧🇩', x.address1, x.phone].filter(Boolean).join(' · '),
  extraBottom: back => [savedAddressesCard($('#tab-contacts'), back)] });

// Family addresses saved from the applicant editor ("💾 Save address"): review, edit/rename and delete them here.
const ADDRESS_SCHEMA = [{ en: 'Saved address', bn: 'সেভ করা ঠিকানা', fields: [
  { k: 'label', en: 'Name (for example the family name)', bn: 'নাম (যেমন পরিবারের নাম)', req: true },
  { k: 'presAdd1', en: 'House no./Street (max 35)', bn: 'বাড়ি/রাস্তা (সর্বোচ্চ ৩৫ অক্ষর)', max: 35, req: true },
  { k: 'presAdd2', en: 'Village/Town/City', bn: 'গ্রাম/শহর', max: 35 },
  { k: 'presDistrict', en: 'District', bn: 'জেলা', req: true },
  { k: 'presPostal', en: 'Postal code', bn: 'পোস্ট কোড' },
] }];
function savedAddressesCard(section, back) {
  const card = h('div', { class: 'card', style: 'margin-top:14px' }, h('h3', {}, '🏠 ' + t('addrSavedList')));
  const edit = a => {
    const form = renderForm(ADDRESS_SCHEMA, a);
    setKids(section, form.el, h('div', { class: 'sticky-actions' },
      h('button', { onclick: back }, t('cancel')),
      h('button', { class: 'primary', onclick: async () => {
        const miss = form.missing();
        if (miss.length) return toast('⚠ ' + miss.join(', '), 3500);
        await IVH.store.upsert('addresses', form.read());
        toast(t('saved'));
        back();
      } }, t('save'))));
  };
  IVH.store.list('addresses').then(list => {
    list.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    card.append(list.length
      ? h('div', { class: 'list' }, ...list.map(a => h('div', { class: 'item' },
        h('div', { class: 'txt' }, h('div', { class: 'ttl' }, a.label || '—'),
          h('div', { class: 'sub', style: 'white-space:normal' }, [a.presAdd1, a.presAdd2, a.presDistrict, a.presPostal].filter(Boolean).join(', '))),
        h('button', { onclick: () => edit(a) }, t('edit')),
        h('button', { class: 'danger', onclick: async () => { if (confirm(t('confirmDelete'))) { await IVH.store.remove('addresses', a.id); back(); } } }, '✕'))))
      : h('div', { class: 'note', style: 'margin:0' }, t('addrNone')));
  });
  return card;
}

function renderAll() {
  IVH.applyI18n(document);
  $('#version').textContent = 'v' + chrome.runtime.getManifest().version;
  $('#langToggle').textContent = IVH.lang() === 'bn' ? 'English' : 'বাংলা';
  refreshStart();
  showProfiles();
  hotelsTab.showList();
  hospitalsTab.showList();
  contactsTab.showList();
  showSettings();
}

function applyLang(lang) {
  IVH.setLang(lang);
  document.documentElement.lang = lang;
  renderAll();
}

document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.id === 'tab-' + b.dataset.tab));
  // Addresses saved from the applicant editor show up when References is opened (unless an edit is open there).
  if (b.dataset.tab === 'contacts' && !$('#tab-contacts .sticky-actions')) contactsTab.showList();
}));

$('#langToggle').addEventListener('click', async () => {
  const st = await IVH.settings();
  const lang = st.lang === 'bn' ? 'en' : 'bn';
  await IVH.store.set('settings', { ...st, lang });
  applyLang(lang);
});

// Keep the start screen in sync when the visa page records a Temporary ID or stops the session.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.tempIds || changes.applications || changes.session?.newValue?.active !== changes.session?.oldValue?.active)) {
    if ($('#tab-start').classList.contains('on')) refreshStart();
  }
});

// Saved Delhi places from older versions may say "CENTRAL DELHI" etc.; the visa site lists only DELHI / NEW DELHI.
(async () => {
  for (const key of ['hotels', 'hospitals', 'contacts']) {
    const list = await IVH.store.list(key);
    let changed = false;
    for (const x of list) {
      if (x.state !== 'DELHI' || !x.district || ['DELHI', 'NEW DELHI'].includes(x.district)) continue;
      x.district = /\bNEW DELHI\b/.test(x.district) ? 'NEW DELHI' : 'DELHI';
      changed = true;
    }
    if (changed) await IVH.store.set(key, list);
  }
})();

IVH.settings().then(st => applyLang(st.lang));

// Web Store updates (background.js): look for a new version each time the panel opens; a downloaded update is
// applied after the panel closes, so nothing being typed is lost.
const tellBackground = type => Promise.resolve().then(() => chrome.runtime.sendMessage({ type })).catch(() => {});
tellBackground('checkUpdate');
addEventListener('pagehide', () => tellBackground('panelClosed'));
