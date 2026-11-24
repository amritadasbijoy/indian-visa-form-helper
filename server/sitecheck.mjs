// Daily check of the visa site's public pages. Reads each page the way a browser would (home page first for the
// session cookie, then the page with the home page as referrer), lists its form field ids, and compares them with
// the ids the extension fills and with the last accepted copy (baseline).
// Inner form pages (applicant details, documents …) need an application session, so they are not checked here;
// the extension's own "site may have changed" alarm covers them.
const SITE = 'https://indianvisa-bangladesh.nic.in/visa/';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

// Field ids the extension uses on each public page (from extension/content/pages.js and the history jobs).
export const EXPECTED = {
  Registration: ['countryname_id', 'missioncode_id', 'nationality_id', 'dob_id', 'email_id', 'email_re_id', 'jouryney_id', 'visaPurposeDropdown', 'captcha'],
  CompletePartially: ['tempFileNo', 'captcha'],
  StatusEnquiry: ['application_id', 'passport_no', 'captcha'],
  PrintApplication: ['missioncode_id_reprint', 'application_id', 'dob_id', 'passport_no', 'captcha'],
};

// ids of form controls; the site mixes single and double quotes.
export function formIds(html) {
  const ids = new Set();
  for (const tag of html.matchAll(/<(input|select|textarea|button)\b[^>]*>/gi)) {
    const m = tag[0].match(/\bid\s*=\s*["']([^"']+)["']/i);
    if (m) ids.add(m[1]);
  }
  return [...ids].sort();
}

async function get(url, cookie, referer) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, ...(cookie ? { Cookie: cookie } : {}), ...(referer ? { Referer: referer } : {}) },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });
  return { res, html: await res.text() };
}

// Returns { at, ok, pages: { name: { status, ids, missing, added, removed, error } } }.
export async function runSiteCheck(baseline = {}) {
  const run = { at: new Date().toISOString(), ok: true, pages: {} };
  let cookie = '';
  try {
    const { res } = await get(SITE + 'index.html');
    cookie = res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  } catch (e) {
    run.ok = false;
    run.error = 'Home page: ' + e.message;
    return run;
  }
  for (const [name, expected] of Object.entries(EXPECTED)) {
    const page = { status: 'ok' };
    try {
      const { res, html } = await get(SITE + name, cookie, SITE + 'index.html');
      page.http = res.status;
      page.finalUrl = res.url;
      page.ids = formIds(html);
      page.missing = expected.filter(id => !page.ids.includes(id));
      const base = baseline[name];
      page.added = base ? page.ids.filter(id => !base.includes(id)) : [];
      page.removed = base ? base.filter(id => !page.ids.includes(id)) : [];
      if (!res.ok || !res.url.includes(name)) page.status = 'error', page.error = `Opened ${res.url} (HTTP ${res.status}) instead of the page`;
      else if (page.missing.length) page.status = 'broken';
      else if (page.added.length || page.removed.length) page.status = 'changed';
    } catch (e) {
      page.status = 'error';
      page.error = e.message;
    }
    if (page.status !== 'ok') run.ok = false;
    run.pages[name] = page;
  }
  return run;
}
