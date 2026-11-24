# Indian Visa Fill-up Helper — project notes

Last updated: 1 November 2026 · current version **1.0.23**

This file is the single place to pick the project up again. It records:

- what the extension does
- how each page of the visa site is handled
- what has been tested and how
- known limits
- what to build next

For install and daily use, see `README.md`. For testers, see `TESTER-GUIDE.md`. The version-by-version history is in `CHANGELOG.md`.

---

## 1. What it is

A Chrome extension (Manifest V3) that fills the Indian visa application on
https://indianvisa-bangladesh.nic.in for all Bangladesh missions: Dhaka, Chittagong, Rajshahi, Sylhet and Khulna.

- **Visa types:** Tourist (T1) and Medical (M1). Medical Attendant (M2) is planned.
- **Languages:** English and Bangla interface.
- **Storage:** all applicant data stays in the user's Chrome (`chrome.storage.local`).
- **Network use:** only the optional AI features call the internet. They go to Anthropic (Claude) or an OpenAI-compatible API, such as River AI.
- **Owner's AI service:** River AI, at `https://api.river.ai/v1`, with the vision model `nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-NVFP4`.

---

## 2. Status

| Area | Status | How it was checked |
|---|---|---|
| Tourist (T1): all pages, Registration → Final review | ✅ Working | Live site, real Chrome runs by the owner |
| Medical (M1): Registration → Visa details (letter lookup, hospital, email, Bangladesh doctor, illness) | ✅ Working | Live site; a real letter number filled the hospital correctly |
| Medical: documents, photo, hotel, final review | ✅ Built; same pages as Tourist except documents | Document page tested on a simulated 15-row copy of the real page |
| Medical: full end-to-end run | ⏳ Not done | Needs a passport and an invitation letter issued for that same passport |
| Medical Attendant (M2) | ⏳ Not started | Owner's decision: later |
| Offline passport scan (OCR) | ✅ Working; quality depends on the photo | 2 real Bangladesh passports, all fields correct |
| AI passport scan (River / OpenAI-compatible, Claude) | ✅ Working | Live River test: 2 real passports, all fields correct, under 30 s |
| AI hotel finder | ✅ Working | Simulated replies; River answers from memory, Claude uses web search |
| Pre-flight check before Start | ✅ Working | Panel preview with problem and clean profiles |
| Application history, final PDF (Print Registered Application), status check (Visa Status Enquiry) | ✅ Built; ⏳ live check | Simulated copies of both pages (field ids from the live site) and of a "submitted" page. Not yet run against a really submitted application: the page after "Verified and Continue" and the real reprint/status responses still need a live check |
| Visa Undertaking generator (official IVAC form) | ✅ Working | Panel preview: values placed in the official boxes; PDF ~310 KB, download and slot save |
| Tester package | ✅ `dist/indian-visa-helper-v1.0.43.zip` | Contains the extension and TESTER-GUIDE.md; no keys, no applicant data |
| Server passport scan (`/api/ocr`, RapidOCR container) | ✅ Live 2026-11-22 | Specimens + 3 real passport scans (identity fields 3/3; spaces sometimes missing in names/addresses) |
| Helper server (ivh.techistbd.com) | ✅ Live 2026-11-21 (Cloudflare A record `ivh`, DNS only; HTTPS certificate by Caddy) | Site check passed on all 4 public pages; admin over Tailscale tested; field-map download tested against a local copy of the server |
| Chrome Web Store | ✅ v1.0.55 published 2026-11-21 (Public; first version 1.0.28 on 2026-11-17). Next upload: the latest `dist/indian-visa-helper-store-v<version>.zip` (1.0.77 submitted for review 2026-11-24, with 5 new screenshots, a new promo tile and the updated description) (1.0.56+ adds Web Store auto-update, DD/MM/YYYY dates, family addresses, final-page fixes). Item ID `janilojppmedlpmlkheleblglanlmfpe`, https://chromewebstore.google.com/detail/janilojppmedlpmlkheleblglanlmfpe | `dist/indian-visa-helper-store-v1.0.28.zip`, listing text and answers in `store/LISTING.md`, privacy policy `store/privacy-policy.html` (must be hosted at a public URL), screenshots `store/screenshots/`, promo tile `store/promo-440x280.png`, store icon `store/store-icon-128.png`, promo video `store/promo-video.mp4` (store needs it as a YouTube link). |

---

## 3. Features (what a user sees)

### Side panel tabs

**Start**
- Pick the applicant. The visa type (T1/M1) follows the applicant's profile.
- Pick the mission and the expected arrival date. The date is chosen by the user; nothing is filled automatically.
- Set the visa period, entries, ports and places to visit.
- Pick the hotel, plus an optional second place of stay.
- Pick the reference in India (default "Same as hotel").
- The reference in Bangladesh is chosen automatically: the spouse if married, otherwise the father, or the mother if there is no father's name. It can be changed per applicant.
- **Medical only:** invitation letter no. (required), nature of illness, India hospital, and the applicant's doctor/hospital in Bangladesh.
- **Pre-flight check** ("Check now", and automatically on **Start filling**): problems block Start, each with a **Fix** button; warnings can be accepted with **Start anyway** (rules in `shared/preflight.js`).
- **Start filling** opens the visa home page and follows "Online Visa Application".
- Recent Temporary IDs are listed.

**Applicants**
- **+ Tourist applicant** / **+ Medical applicant**.
- **📄 Import old BGD PDF:** reads a printed application, including the hotel and the Bangladesh reference.
- **🛂 Scan passport:** offline OCR.
- **✨ Scan with AI:** uses the AI service set in Settings.
- **⧉:** copies an applicant into the other visa type.
- Each applicant has:
  - the full form data
  - a 350×350 photo cropper
  - a document checklist (Required / Optional) that follows the visa type
  - **✍ Make Visa Undertaking:** fills the official IVAC undertaking form from the profile (editable), to download, print and sign
  - their Temporary IDs, with Copy and Resume
  - **Submitted applications:** Application Id, mission, type, date, last status; 🔎 Check status, 📄 Save PDF, 👁/⬇ the saved PDF, 📎 Attach PDF, ✕; add an older Application Id by hand
  - a passport-expiry warning when there is less than 6 months left

**Hotels**
- Add a hotel by hand, or use **✨ Find hotels by city (AI)**, then **Save** or **Save & use**.

**Hospitals**
- Each hospital is either **India (treatment)** or **Bangladesh (applicant's doctor)**.
- A hospital from a medical invitation letter is saved automatically, including its email.

**References**
- Reference people in India or in Bangladesh.

**Settings**
- Language and auto-advance delay.
- The AI service: Anthropic, or OpenAI-compatible with base URL, model list and key.
- **Share AI setup** (a file, with the key only if ticked).
- Backup export/import (API keys are never included) and CSV import of hotels and hospitals.

### On the visa site

- A floating panel shows the version, the applicant, the Temporary ID and the page.
- It also shows the status, anything that needs attention, and **Fill again / Pause / Stop**.
- Auto-advance moves to the next page after a short countdown. It stops on any problem.

Safety rules:
- The applicant always does these steps:
  - types the captcha
  - ticks the declaration checkboxes
  - submits the final page ("Verified and Continue")
- It never fills a page whose Temporary ID differs from the session's.
- A choice that the site resets (District) is repaired, or reported, before Continue.

### Data defaults applied after a scan or import (empty fields only)
- Applicant born in Bangladesh, nationality by birth.
- Father, mother and spouse are Bangladeshi, born in the applicant's place of birth.
- A spouse found on the passport → marital status MARRIED.
- The passport address is used as both the present and the permanent address.
- Religion is suggested from the names by every scan (`lib/religion.js` word lists for the free scans, the model for the AI scan). Names shared by several communities count for nothing, and it stays blank when unsure. A guess is marked `religionGuessed` and warned about in the editor and the pre-flight check until the applicant confirms it ("Religion is correct" or choosing it again). A guess never replaces a religion the profile already has; the BGD file's religion is used as it is.
- Identification marks: "NO".

---

## 4. How each site page is handled

The code lives in `extension/content/pages.js`. The field ids were mapped from the live site in Oct–Nov 2026.

| # | Page (URL) | Extension does | User does |
|---|---|---|---|
| 0 | `index.html` | Follows "Online Visa Application" (`verify()`) or "Complete Partially Filled Form" when starting or resuming | — |
| 1 | `Registration` | Country, mission, nationality, DOB, email, arrival date, purpose (T1 544 / M1 545) | Captcha → Continue |
| – | `CompletePartially` | Fills the Temporary ID | Captcha → Continue |
| 2 | `BasicDetails` | Names, gender, birth, NID, religion, education, passport | — |
| 3 | `FamilyDetails` | Address, phones, parents, spouse, grandparent question, occupation (Father/Mother/Spouse for students and housewives), military | — |
| 4 | `VisaDetails` | Tourist: places. Medical: letter lookup, email from the record, Bangladesh hospital, illness. Duration, entries, ports, previous visits, SAARC, both references (State → District) | — |
| 5 | `AdditionalQuestions` | Answers the 6 questions (default No), then after the countdown ticks the declaration and clicks Save and Continue (setting `autoDeclare`, on by default) | Nothing; Pause or the setting off → one click on "I confirm — tick and continue" |
| 6 | `PhotoUpload` | Upload → Crop and Save → Save and Continue | — |
| 7 | `DocumentUpload` | Uploads each row's file from its slot. Tourist: 1 row; Medical: 15 rows (3 required) | Checks with View, ticks "verified", clicks Confirm |
| 8 | `BangladeshDetails` | Hotel(s): name, address (50 characters), state, district, email, phone | — |
| 9 | `Verification` | Stops | Reviews, then submits |
| 10 | page after submit (not mapped) | Any page showing a 12-character Application Id (`BGD` + mission letter + 8) is recorded in the history; offers "Save application PDF" | — |
| – | `PrintApplication` (Print Registered Application) | Regular visa, mission (`#missioncode_id_reprint`), `#application_id`, `#dob_id` DD/MM/YYYY, `#passport_no`; sends the form itself and keeps the PDF | Captcha → Reprint |
| – | `StatusEnquiry` (Visa Status Enquiry) | `#application_id`, `#passport_no`; saves the result rows and status line | Captcha → Submit |

Site quirks are worth knowing before changing anything:
- **Opening pages directly:** Registration and CompletePartially redirect to `index.html` when opened by URL.
- **Session ids in URLs:** URLs sometimes end in `;jsessionid=…`.
- **Resuming an application** resets the grandparent radio to YES and clears the Additional Questions answers.
- **Medical invitation lookup:** `json/fetchHospitalDetails` returns name, address, doctor, phone and email, but no passport number.
  - The site's own code fills name, address, doctor and phone, then hides them as bold text.
  - It never fills the email.
  - The server rejects a letter that was not issued for the application's passport.
- **District list:** `json/fetchDistrictList` refills it after a State is chosen.
- **Document table:** row ids are broken (`mFile_%{document_id}`), so rows are found by their serial number.
- **Application Id:** 12 letters/digits starting with the mission code (BGDD, BGDC, BGDR, BGDS, BGDK). The Temporary ID has 15 characters. Both PrintApplication and StatusEnquiry open fine by URL.
- **Upload sizes:** photo JPEG, 10 KB–1 MB, at least 350×350. Documents: PDF, 10–500 KB (the extension makes 100–500 KB).

---

## 5. Code map

```
extension/
  manifest.json            version shown in the panel; host permission for the visa site and api.anthropic.com;
                           optional host permissions for user-chosen AI servers
  background.js            opens the side panel
  content/bridge.js        runs in the page (MAIN world): sets values with the site's jQuery, waits for
                           dependent lists, re-checks/repairs dropdowns, uploads files, medical letter lookup
  content/pages.js         one fill plan per site page (see section 4)
  content/content.js       floating panel, session and context, auto-advance, Temporary IDs, hospital saving
  sidepanel/               the side panel UI (sidepanel.js holds all tabs)
  shared/constants.js      site option values, visa types, document slots (IVH.DOC_SLOTS)
  shared/schema.js         applicant / hotel / hospital / reference form definitions (English + Bangla)
  shared/i18n.js           all UI strings in English and Bangla
  shared/util.js           storage helpers, dates, Bangladesh passport defaults, Bangladesh reference rule
  shared/util.js           (also) application history helpers: IVH.saveApplication, applicationsOf, appPdfName
  shared/preflight.js      pre-flight check rules (errors / warnings + where to fix)
  lib/bgd-parser.js        reads printed BGD application PDFs
  lib/mrz.js               passport machine-readable-zone parsing and check digits
  lib/passport-ocr.js      offline passport scan (Tesseract)
  lib/ai-client.js         one JSON request to Anthropic (official SDK) or any OpenAI-compatible API
  lib/ai-scan.js           AI passport scan (schema, prompt, MRZ cross-check)
  lib/ai-hotels.js         AI hotel finder
  lib/image-tools.js       photo crop, PDF building and size targeting
  lib/undertaking.js       fills the official IVAC Visa Undertaking Form (assets/ivac-visa-undertaking.pdf)
  assets/                  bundled official forms
  lib/{pdfjs,tesseract,anthropic}/   vendored libraries (npm run vendor)
tools/
  vendor.mjs               copies pdf.js and Tesseract and bundles the Anthropic SDK into extension/lib
  package.mjs              builds dist/indian-visa-helper-v<version>.zip (npm run zip)
  panel-harness.html + chrome-mock.js   preview the side panel at http://localhost:8765/tools/panel-harness.html
  sim/VisaDetails/, sim/DocumentUpload/, sim/PrintApplication/, sim/StatusEnquiry/, sim/Submitted/
                           simulated site pages for testing the content scripts
  test-parser.mjs          check the BGD PDF parser:  node tools/test-parser.mjs file.pdf
  test-ai-scan.mjs         run the AI scan against an OpenAI-compatible server (key in ~/.visa-helper-ai-key)
  make-icons.mjs, dump-pdf.mjs
```

---

## 6. How to make an update

1. Change the code in `extension/`.
2. Bump `"version"` in **both** `extension/manifest.json` and `package.json`, and add an entry to `CHANGELOG.md`. Do this for every change.
3. Test, using these where they fit:
   - **Side panel:** run `python3 -m http.server 8765` in the project folder, then open `http://localhost:8765/tools/panel-harness.html`. Add `?v=N` to bypass the browser cache.
   - **Content scripts:** the simulated pages in `tools/sim/`.
   - **Real site:** reload the extension in `chrome://extensions` and use a test application with dummy data. Never submit the final page.
4. Build the tester package with `npm run zip`. The result is in `dist/`: the tester zip and the store zip (`indian-visa-helper-store-v<version>.zip`, upload this one to the Chrome Web Store).
   Store images: with the local server running, `store/shots/shot.html?n=1…5` and `store/shots/promo.html` render the screenshots with made-up data (`store/shots/seed.js`); capture them at 1280×800 and 440×280 with headless Chrome.
5. Testers: unzip, then **Load unpacked** the `indian-visa-helper` folder.

Fresh checkout: run `npm install` and then `npm run vendor` before loading the extension.

---

## 7. Decisions and rules

- **The user does the captcha and the final submit.** These are never automated: the final submit is the legal application, and the captcha is the site's anti-bot check.
- **Additional questions declaration and Document upload verification are automatic** (v1.0.37/1.0.38, owner's decision): ticked after a countdown, with Pause and a setting to turn it off. The final submit stays with the user.
- **API keys:**
  - Never built into the extension or included in backups.
  - Shared only through "Share AI setup" files that the owner sends privately.
  - Each tester gets a separate key, revoked after testing.
- **Hotels:** the AI suggests real hotels only, never invented details. River's results are marked "check before use".
- **No real personal data in code or comments.** The test passports, NIDs and addresses were removed from comments; use made-up examples.
- **Test applications** use dummy data. Never submit them. Leave them as drafts, which expire.

---

## 8. Known limits

- **Medical full run:** not yet done end to end. It needs a matching passport and invitation letter.
- **Offline OCR:** can misread blurry, tilted or covered passport photos. Use AI scan for those. All scan results must be reviewed.
- **River and hotels:** River models can't search the web, so hotel suggestions can be outdated.
- **Site changes:** the extension depends on the site's field ids and page names. If the government changes the site, the page plans in `pages.js` need updating.
- **Unencrypted data:** applicant data in `chrome.storage.local` is not encrypted. Anyone using that Chrome profile can read it.
- **Store updates need review:** the extension is on the Chrome Web Store (item `janilojppmedlpmlkheleblglanlmfpe`). Each new version is uploaded as `dist/indian-visa-helper-store-v<version>.zip` (Package → Upload new package) and reviewed again before users get it.
- **AI servers:** only the servers listed under `optional_host_permissions` in the manifest can be used (River, OpenAI, OpenRouter, Gemini, localhost; Anthropic via `host_permissions`). Adding another provider needs a manifest change and a new store review.

---

## 9. Completed work (chronological)

1. Mapped all 10 site pages on the live site with test applications; built the MV3 extension, side panel and floating panel.
2. Profiles, hotels, hospitals and references; English/Bangla interface; backup; CSV import.
3. Old BGD PDF import (sample PDF parses fully); offline passport OCR, rewritten twice after testing on real passports.
4. Photo cropper, PDF size targeting, photo upload (3 steps), document upload.
5. Hotel page (up to 2 places), final-review stop, resume via Temporary ID, wrong-application guard.
6. Start flow through the home page; District reset repair; dropdown re-check before Continue.
7. Temporary IDs per applicant with Resume; version shown everywhere; changelog.
8. AI passport scan: Claude, then OpenAI-compatible (River). Server picker, model list, live River test.
9. Defaults: Bangladeshi parents and spouse born in the applicant's place of birth; religion suggestion; Bangladesh reference = spouse or father.
10. AI hotel finder; Share AI setup; tester package and guide.
11. Medical M1: Start fields, invitation-letter lookup, automatic hospital save and email, Bangladesh doctor, wrong-passport message.
12. Document slots with Required/Optional; Tourist vs Medical applicant profiles; copy between types.
13. Pre-flight check before Start (roadmap item 1) — v1.0.23.
14. Medical Visa Undertaking generator from IVAC's official form (roadmap item 2) — v1.0.24. Source: http://ivacbd.com/uploads/banner/Visa%20Underataking%20Form.pdf (ivacbd.com → Other Forms). No separate medical-only official format was found; this one form is used for all visa types.
15. Application history, final PDF and status check (roadmap items 3 and 4) — v1.0.25. Storage key `applications` (one record per Application Id: profileId, tempId, mission, visaType, pdf, status, checks); `siteJob` carries a status/PDF request to the site tab.
16. Code audit — v1.0.26: 11 bugs fixed and 5 improvements made, listed in `AUDIT.md`. The Start screen draft is now `startDraft`; `session` is written only by Start and Resume.
17. Chrome Web Store preparation — v1.0.27: "Unofficial" name and description, AI hosts limited to a fixed list, store zip, `store/` folder with listing, privacy policy, screenshots and promo tile.
18. New icon (form with green tick) — v1.0.28. Source `tools/icon.svg`, rendered by `node tools/make-icons.mjs` with headless Chrome. Promo video built with ffmpeg from the store screenshots and `store/shots/card.html`.
19. Feature plan step 1 — v1.0.29: checks while editing (`IVH.profileChecks` in `shared/preflight.js`, also used by the pre-flight check), archive applicants (`archived` flag on the profile), useful links on the Start screen (`IVH.USEFUL_LINKS` in `shared/constants.js`).
20. Feature plan step 2 — v1.0.30: helper server `server/` on the VPS (ivh.techistbd.com): website, privacy policy, field map (`background.js` fetches it hourly; `content.js` applies renames and page aliases), visa site check every 12 h, admin dashboard over Tailscale. Details in `server/README.md`.
21. Feature plan step 3 — v1.0.31: Helper AI (invite-only AI relay on the VPS, `server/ai.mjs`; extension provider `helper` in `lib/ai-client.js`). VPS firewall (ufw) on: 22, 80, 443, Tailscale.
22. Feature plan steps 4–7 — v1.0.32: letters and IVAC checklist (`lib/letters.js`), BGD photo (`firstPagePhoto` in `lib/pdf-loader.js`), family queue and reminders (Start), overview (Applicants), locked backups, PIN lock and encrypted agency sync (`lib/crypto.js`, `server/sync.mjs`), directory (`server/directory.mjs`), phone form (`server/public/family.html`), minimum Chrome 116. Open items are listed at the end of `FEATURE-PLAN.md`.
23. Speed and fixes — v1.0.33: River's Nemotron is called with `reasoning_effort: 'none'` (server relay and own-key path): scans take ~2.5 s instead of 25–50 s (sometimes no answer). Admin dashboard buttons fixed (origin check crashed on "null").
24. Temporary ID clean-up — v1.0.34: remove one, clear finished/old (30+ days), clear all (`removeTempIds`, `tempIdDone` in `sidepanel.js`).
25. Example data — v1.0.35: example applicant, hotel and Start choices; sample BGD text PDF (parsed by `bgd-parser.js`: all fields, hotel, both references, photo) and sample passport JPEG (offline OCR reads every field). `lib/example-data.js`.
26. Declaration confirm button — v1.0.36: Additional questions → "I confirm — tick and continue" (`declarationBox`, `saveContinueButton` in `content.js`); sim page `tools/sim/AdditionalQuestions/`. Not yet tried on the live site.
27. Automatic Additional questions declaration — v1.0.37: countdown → tick → Save and Continue; setting `autoDeclare` (default on); Pause / setting off / issues → confirm button. Tested on the sim page (auto, off, paused) and confirmed working on the live site by the owner (2026-11-21).
28. Automatic Document upload verification — v1.0.38: same countdown → tick → Confirm (`verifyDocsBox`, `confirmButton`; shared `tick` table in `content.js`). Tested on the sim page (auto, setting off) and confirmed working on the live site by the owner (2026-11-21).
29. Server passport scan — v1.0.39: RapidOCR container on the VPS (`server/ocr/`, PaddleOCR itself was too slow without oneDNN and crashed with it), `/api/ocr` free for everyone with 40/day per visitor, deskew + rotation retry, shared field rules. Specimen tests: server 9/9 on tilted/blurred/glare/upside-down, browser scan failed on those. Needs a test with real passport photos.
30. Passport scan fixes from 3 real passports — v1.0.40: both scans 3/3 on the identity fields; server scan sometimes drops spaces in names/addresses (RapidOCR), the browser scan keeps them. On flat PDF scans the browser scan is as good; the server scan wins on phone photos (tilt, blur, glare, rotation).
31. Smart passport scan — v1.0.41: `smartScanPassport` / `mergeScans` in `lib/passport-ocr.js` (both engines in parallel, merged per field). Recommended default in the first-scan question. **Removed in v1.0.50** (server scan alone matches it now).
32. Name spacing and mobile check — v1.0.42. Test passports: the owner's real passport PDFs are kept in `tools/tmp-real/` for testing at the owner's request (2026-11-22). That folder is never zipped (`npm run zip` takes only `extension/`). **Delete it before any public release.** The server-scan daily limit is temporarily 200 for testing (normally 40).
33. Free hotel search — v1.0.43: `server/hotels.mjs` (+ `server/osm/`), panel `findFree` in the hotel finder; AI search optional. Google Places is on (2026-11-21): key in `/opt/ivh/.env`, from the owner's Google Cloud project, restricted to the VPS IPs and Places API (New); daily cap in admin. Monthly refresh of the India hotel list: `/etc/cron.d/ivh-osm` on the VPS, 03:30 on the 3rd of each month (server time), log in `/var/log/ivh-osm.log`.
34. Religion guess for all scans — v1.0.44: `extension/lib/religion.js`, test `tools/test-religion.mjs` (made-up names, 13/13).
35. Grey/B&W copies — v1.0.45: local scan re-reads the photo page as ink-only (`inkOnly` in `lib/passport-ocr.js`) when "Place of Birth" is missing; NID only from printed lines; looser name labels; district from its own line. Test passports: `tools/tmp-real/{a,b,c,d}.pdf` (d = low-res B&W).
36. Passport phone check — v1.0.46: scans set `mobileFromPassport`; warning + "Number is current" in the editor (`IVH.profileChecks`), question on Save, pre-flight warning; a scan never replaces a saved number.
37. Phone ↔ Mobile linked in the applicant editor — v1.0.47 (`editProfile` in `sidepanel.js`; linked state decided on focus).
38. Smart scan removed, server OCR on the English model — v1.0.50: `server/ocr/Dockerfile` downloads `en_PP-OCRv3_rec_infer.onnx` (pinned commit + sha256), `app.py` uses it; it keeps word spaces. Settings: Server (recommended) / This computer; old `scanEngine: 'smart'` → server.
39. Passport drag-and-drop + 3-line addresses — v1.0.51: `scanDropZone` in `sidepanel.js` (Applicants list and editor); `block()` / `tidyAddr` / packing in `emergencyPage`; issue date from expiry. Test passports now `tools/tmp-real/{a..f}.pdf`.
40. DD/MM/YYYY dates (`dateBox`, `isoToDmy` / `dmyToIso` in `sidepanel.js`; records stay ISO) and family addresses (`addresses` collection, address bar in `editProfile`; in backup + sync) — v1.0.58. Feedback list: `FEEDBACK.md`.

---

## 10. Recommended next features

**The current full plan is in `FEATURE-PLAN.md`** (missing features vs. the competitor, open roadmap items, new features using the VPS, and the order to build them). The list below is the earlier roadmap.

Based on the live testing, the owner's workflow (family and agency use), and features of similar extensions: "Indian Visa Autofill Pro", whose feature list the owner shared, and "Auto Fill for IVAC" on the Chrome Web Store.

### Must-have (high value, low risk)

1. ✅ **Done in v1.0.23 — Pre-flight check before Start.** One list of anything that would stop the run:
   - passport valid for less than 6 months
   - no photo, or a missing required document
   - empty required fields, names or addresses over the site's length limits
   - Medical without a letter number or Bangladesh doctor
   - no hotel or arrival date

   It saves a wasted captcha and a half-filled application.
2. ✅ **Done in v1.0.24 — Medical Visa Undertaking generator.** The undertaking is **mandatory** for every Medical application. Generate a filled PDF from the profile (name, passport, hospital, illness), ready to print, sign, scan and drop into its document slot. Cover letters and NOC letters could use the same generator.
3. ✅ **Done in v1.0.25 (needs a live check) — Save the final application PDF.** On the Verification page and after submission, save or print the application PDF, named `NAME_PASSPORT_TEMPID.pdf`, and store it in the applicant's history.
4. ✅ **Done in v1.0.25 (needs a live check) — Application history and status.** For each applicant, record submitted applications (date, mission, visa type, application ID), with a one-click status check on the site's Visa Status Enquiry page. The applicant types the captcha.
5. **Medical Attendant (M2).** Map its visa-details fields (patient name, passport, application ID, relation) with a real patient/attendant pair, and use the attendant document rows (13–15), which are already defined as slots.
6. ✅ **Done in v1.0.26 — Site-change alarm.** When a page's expected fields are missing, show "the visa site changed this page — please report" instead of generic errors, so breakages are spotted on day one.

### Should-have

7. **Batch / family queue.** Line up several applicants, and the extension starts the next one after each final review. The captcha is still typed per person.
8. **Encrypted backup and an optional password lock.** Protects clients' passport data on shared computers.
9. **Medical document helpers:**
   - mark which optional rows the hospital or mission usually expects
   - remember files that can be reused across a family, such as a bank statement
10. **Data checks while editing:** NID length (10/13/17), phone format, ages (e.g. "NA BEING MINOR" for children), and spouse required when MARRIED.

### Nice-to-have

11. **IVAC appointment and payment page autofill** (the "Auto Fill for IVAC" niche). Fill only the applicant's details; payment, captcha and slot choice stay manual. Avoid any slot-grabbing automation.
12. **Indian e-Arrival Card autofill** from the same profile, for the trip itself.
13. ✅ **Done in v1.0.28 — Chrome Web Store release.** Published 2026-11-17.
14. **Usage dashboard for agencies:** applications per week, pending results, passport expiries coming up.

Sources for the competitor research:
- the "Indian Visa Autofill Pro" description (provided by the owner)
- [Auto Fill for IVAC — Chrome Web Store](https://chromewebstore.google.com/detail/gfmekljmdjiceplddbfilgfjcmenpdgp)
- [Auto Fill for IVAC — Extension Auditor](https://extensionauditor.com/scan/auto-fill-for-ivac-gfmekljmdjiceplddbfilgfjcmenpdgp)
