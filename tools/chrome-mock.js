// Dev-only stand-in for the chrome.* APIs so the side panel can be previewed over plain HTTP.
(() => {
  const listeners = [];
  const read = () => JSON.parse(localStorage.getItem('ivh-mock') || '{}');
  const write = d => localStorage.setItem('ivh-mock', JSON.stringify(d));
  window.chrome = {
    storage: {
      local: {
        async get(key) { const d = read(); return typeof key === 'string' ? { [key]: d[key] } : d; },
        async set(obj) {
          const d = read(), changes = {};
          for (const [k, v] of Object.entries(obj)) { changes[k] = { oldValue: d[k], newValue: v }; d[k] = v; }
          write(d);
          listeners.forEach(fn => fn(changes, 'local'));
        },
      },
      onChanged: { addListener: fn => listeners.push(fn) },
    },
    runtime: { getURL: p => '/extension/' + p, getManifest: () => { const x = new XMLHttpRequest(); x.open('GET', '/extension/manifest.json', false); x.send(); return JSON.parse(x.responseText); }, sendMessage() {}, onMessage: { addListener() {} } },
    permissions: { async request(o) { console.log('permissions.request', o); window.__perm = o; return true; }, async contains() { return !!window.__permGranted; } },
    tabs: { async query() { return []; }, async create(o) { console.log('tabs.create', o); }, async update(id, o) { console.log('tabs.update', o); } },
  };
})();
