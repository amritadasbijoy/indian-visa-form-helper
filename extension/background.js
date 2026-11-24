// Opens the side panel from the toolbar button and relays "open panel" requests from the visa site.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'openPanel' && sender.tab) chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
  if (msg?.type === 'fieldMap') refreshFieldMap();
  if (msg?.type === 'checkUpdate') checkForUpdate();
  // The panel is closing: a waiting update can be applied once it is gone.
  if (msg?.type === 'panelClosed') setTimeout(applyUpdateIfIdle, 1500);
});

// Web Store updates. Chrome installs a new version by itself, but only when the extension is idle or Chrome
// restarts, which can take hours or days. So: ask for an update whenever the panel opens or Chrome starts, and
// apply a downloaded update at once when nothing is in progress (no form being filled, side panel closed),
// so an applicant being typed is never lost. Saved data is kept. Unpacked (zip) installs never get this.
async function checkForUpdate() {
  try { await chrome.runtime.requestUpdateCheck(); } catch { /* throttled by Chrome or offline: try next time */ }
  applyUpdateIfIdle();
}
async function busy() {
  const { session } = await chrome.storage.local.get('session');
  if (session?.active) return true;
  try { return (await chrome.runtime.getContexts({ contextTypes: ['SIDE_PANEL'] })).length > 0; } catch { return false; }
}
async function applyUpdateIfIdle() {
  const { updatePending } = await chrome.storage.local.get('updatePending');
  if (updatePending && updatePending !== chrome.runtime.getManifest().version && !(await busy())) chrome.runtime.reload();
}
chrome.runtime.onUpdateAvailable.addListener(async details => {
  await chrome.storage.local.set({ updatePending: details.version });
  applyUpdateIfIdle();
});
chrome.runtime.onInstalled.addListener(() => chrome.storage.local.remove('updatePending'));
chrome.runtime.onStartup.addListener(checkForUpdate);
// A filling session just ended: apply a waiting update if the panel is closed too.
chrome.storage.onChanged.addListener(changes => {
  if (changes.session && changes.session.oldValue?.active && !changes.session.newValue?.active) applyUpdateIfIdle();
});

// Field renames published on the helper server (data only: field and page names), so a renamed field on the
// visa site can be fixed without waiting for a store update. Fetched at most once an hour; nothing is sent.
const FIELD_MAP_URL = 'https://ivh.techistbd.com/api/fieldmap.json';
const NAME = /^[A-Za-z0-9_.:-]{1,80}$/;
const validPairs = o => !!o && typeof o === 'object' && !Array.isArray(o) && Object.entries(o).every(([k, v]) => NAME.test(k) && typeof v === 'string' && NAME.test(v));
async function refreshFieldMap() {
  const { fieldMap } = await chrome.storage.local.get('fieldMap');
  if (fieldMap?.fetchedAt && Date.now() - fieldMap.fetchedAt < 3600e3) return;
  try {
    const res = await fetch(FIELD_MAP_URL, { cache: 'no-cache', credentials: 'omit', signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const m = await res.json();
    const ok = Number.isInteger(m.version) && validPairs(m.ids ?? {}) && validPairs(m.pageAliases ?? {}) &&
      validPairs(Object.fromEntries(Object.keys(m.pageIds ?? {}).map(k => [k, k]))) && Object.values(m.pageIds ?? {}).every(validPairs);
    if (!ok) throw new Error('invalid field map');
    await chrome.storage.local.set({ fieldMap: { map: { version: m.version, ids: m.ids || {}, pageIds: m.pageIds || {}, pageAliases: m.pageAliases || {} }, fetchedAt: Date.now() } });
  } catch {
    // Offline or server down: keep the last good map and try again in an hour.
    await chrome.storage.local.set({ fieldMap: { ...(fieldMap || {}), fetchedAt: Date.now() } });
  }
}
