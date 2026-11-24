# Changelog

The version is in `extension/manifest.json` and shows in the side panel header and the floating panel on the visa site.
After reloading the extension in `chrome://extensions`, check that the number matches.

## 1.0.76 — 2026-11-22
- Confirmation page after submit: the PDF from the site's "Print Form" button is now caught on its way, downloaded as usual and kept in the applicant's history by itself — no second download, no "Add downloaded PDF" needed. If the site answers with anything other than a PDF, Print Form works exactly as before.
- The floating panel there is short: "✅ Application submitted and saved to the history: <ID>. Click Print Form… Ready for the next application." The "Save application PDF" button is gone from that page (it is still in the history for older applications).
- Dev: the Submitted simulator has a Print Form button returning a made-up PDF.

## 1.0.75 — 2026-11-22
- Editing after the final review: "↻ Fill this page" on the photo and document upload pages now finishes the upload (Upload Photo → Crop and Save → Save and Continue, or Upload Document) like normal filling, instead of only choosing the file. On form pages it still only fills and never clicks. Leaving the upload page ends this, so a later visit asks again.

## 1.0.74 — 2026-11-22
- Place of stay page refused "POLO FLOATEL - KOLKATA" ("Enter Alphabets or spaces Only"). The hotel name, the reference name in India and the reference name in Bangladesh are now filled with letters and spaces only (other marks become spaces: "POLO FLOATEL KOLKATA"), and the hotel search saves names that way too.

## 1.0.73 — 2026-11-22
- Reprint (PrintApplication) and Visa Status pages opened by hand are no longer filled with the last application. The floating panel asks "Which application?" with a list of saved applications (name · Application ID) and a Fill button; only the chosen one is filled. "Save PDF" / "Check status" in the side panel still fill the page straight away, but only once (a reload or a later visit shows the list again); the status result page after the captcha still works.

## 1.0.72 — 2026-11-22
- Keep the PDF the site downloads on submit with the applicant, without downloading it again: on each submitted application (applicant editor → Submitted applications, and the list on Start) the button is now "📎 Add downloaded PDF", and the file can also be dragged from Finder / File Explorer / Chrome's download bar straight onto the application. Once added: 👁 view, ⬇ download, "📎 Replace PDF". After submit, the floating panel says where to add it.

## 1.0.71 — 2026-11-22
- After submit the helper no longer jumps to the site's Reprint page: the site already downloads the application PDF by itself. The Application ID is still saved to the history, and "📄 Save application PDF" stays as a button for when that download did not happen. (Replaces the 1.0.69 countdown.)

## 1.0.70 — 2026-11-22
- "Modify" from the final review page no longer makes the helper fill the form again. Once Final review is reached, the application counts as complete: pages opened with Modify are left alone (nothing filled, ticked or clicked), with the note "✏️ You're editing after the final review…" and a "↻ Fill this page" button for when it is wanted (that fills the page but never ticks or moves on by itself). Back on Final review, the helper still saves the Application ID and the PDF after the user's own submit. A new Start always begins normally.

## 1.0.69 — 2026-11-21
- Final review page: the helper stops there. The small panel only says "✅ All pages are filled. Check everything, then click Verified and Continue yourself…" — no Fill again / Pause / Stop — and keeps watching in the background.
- After the user submits: the Application ID is saved as before, then (once per application) a 5-second countdown opens the site's print page with the details filled in; the user types that page's captcha and the PDF is saved to the history and downloaded. "✋ Stay here" cancels; "📄 Save application PDF" stays available.
- "Verified and Continue" and every captcha remain the user's own clicks.

## 1.0.68 — 2026-11-21
- Hotel search (free and AI) now saves the district as the visa site lists it: "CENTRAL DELHI" / "SOUTH WEST DELHI" → DELHI, "NEW DELHI" stays, and a trailing "DISTRICT" is dropped ("KOLKATA DISTRICT" → KOLKATA).
- Hotels, hospitals and references already saved with a Delhi area name are corrected once when the panel opens (→ DELHI or NEW DELHI).
- Note: after updating, reload any open visa-site tab (F5); an open page keeps the old code until it is reloaded.

## 1.0.67 — 2026-11-21
- Correction to 1.0.66: the visa site lists Delhi's districts only as DELHI, NEW DELHI and NOT KNOWN. A saved district such as "CENTRAL DELHI" or "SOUTH WEST DELHI" now picks DELHI (the last word, when it is exactly an option); NEW DELHI still picks NEW DELHI. The Delhi district suggestions in the editor are now DELHI and NEW DELHI.

## 1.0.66 — 2026-11-21
- Visa details page: "no option CENTRAL DELHI in #districtofsponsor_ind". The site lists Delhi's districts without "DELHI" (CENTRAL, SOUTH, SOUTH WEST, NEW DELHI …). District matching now also tries the name without a trailing "DELHI" or "DISTRICT", for the reference in India and the hotel's district on the place-of-stay page.

## 1.0.65 — 2026-11-21
- "💾 Save address" suggests the name from the applicant's first name: "RINA'S FAMILY" (Bangla: "RINA-এর পরিবার") instead of "DAS FAMILY". Titles such as MD, MOHAMMAD, MST and SK are skipped ("MD KARIM" → "KARIM'S FAMILY"). The name can still be changed before saving.

## 1.0.64 — 2026-11-21
- Save with required fields still empty: every empty required field gets a red outline, and the page scrolls to the first one with the cursor in it. The red goes away as soon as the field is filled. Works in the applicant editor and in the Hotels, Hospitals, References and saved-address forms.

## 1.0.63 — 2026-11-21
- Saved addresses can be reviewed in the References tab: a "🏠 Saved addresses" card lists each one with its name and full address, with Edit (rename or fix the address) and ✕ (delete). The list refreshes whenever the tab is opened, so an address just saved in the applicant editor shows up straight away.

## 1.0.62 — 2026-11-21
- The religion card also has "✎ Change": it jumps to the Religion list and opens it. Choosing a religion confirms it and removes the card.

## 1.0.61 — 2026-11-21
- Says clearly that everything except the AI scan is free: a green note in Settings → AI ("Everything else is free for everyone: passport scan, form filling, hotel search, documents, letters and all other features. Only the AI scan is paid."), the "set up AI" message, and the store description ("Free to use." / "Every other feature is free for everyone.").
- Fixed an old line in Settings → AI that said the normal "Scan passport" keeps everything on this computer (the default is now the server scan; "This computer only" is the choice for that).

## 1.0.60 — 2026-11-21
- AI scan is clearly marked as not free: a red "Paid" tag on both "Scan with AI" buttons, the hover text and the "set up AI first" message say it uses your own AI service (charged per scan) or a Helper AI code, and that the normal "Scan passport" is free. The hotel "Search with AI" option says "paid" too. Store description updated the same way.

## 1.0.59 — 2026-11-21
- Faster updates from the Chrome Web Store: the extension asks Chrome for a new version every time the panel opens and when Chrome starts, and applies a downloaded update at once when nothing is in progress (no form being filled, side panel closed). If the panel is open the update waits until it is closed, so an applicant being typed is never lost. Saved data is kept. (Installs from a zip / "Load unpacked" are separate extensions and never update by themselves.)

## 1.0.58 — 2026-11-21
- Dates are shown and typed as DD/MM/YYYY (date of birth, passport dates, previous visa, arrival date on Start), as people in Bangladesh write them. Slashes are added while typing; a 📅 button still opens the calendar. A date that doesn't exist (31/02/2030) stays as typed and turns red. Stored dates are unchanged (YYYY-MM-DD), so saved applicants and the visa site filling work as before.
- Family addresses: in the applicant editor, "Address & contact" has a "📍 Fill address from…" menu (saved addresses and other applicants' addresses) and a "💾 Save address" button with a name such as "DAS FAMILY". The passport scan still fills its own address first; picking one replaces the four address boxes. Saved addresses are included in backups and agency sync.

## 1.0.57 — 2026-11-21
- New look for the "please confirm" items in the applicant editor (guessed religion, phone from the passport): each is a small white card with an icon and rounded buttons — green "✓ Correct" / "✓ Still in use", outlined "✎ Change". Other warnings stay in the yellow note.

## 1.0.56 — 2026-11-21
- Address missing after a scan on some computers: the address label is now found however the OCR spells it ("Permanent Address", "Pemanent Address", "PermanentAddress"), and the emergency contact's "Address," / "Address." line is used when the first label is unreadable. Tested on made-up text with 5 spellings and on the owner's 6 test passports (unchanged).

## 1.0.55 — 2026-11-21
- Married applicants whose passport has no "Spouse's Name" line: when the emergency contact's relationship is SPOUSE (or HUSBAND / WIFE), that name becomes the spouse and marital status MARRIED. A stray OCR row between "Name" and "Relationship" no longer hides it (also for the FATHER rule).
- Addresses: a place name wrapped onto the next line stays one part ("KALIR" / "BAZAR" → "KALIR BAZAR"); symbol noise in an address line ("=O") is dropped.
- Tested on the owner's 6 test passports: the server scan reads all 6 correctly (one more married applicant now gets her spouse).

## 1.0.54 — 2026-11-21
- Place of birth: when a scan (server, this computer or AI) can't read it, the district of the permanent address is used (e.g. COMILLA). A printed place of birth always wins.

## 1.0.53 — 2026-11-21
- Place of issue is always DHAKA for Bangladesh passports: every scan (server, this computer, AI) sets DHAKA instead of reading the issuing office, so a misread can no longer change it. A BGD file without it and an empty box on the visa site also get DHAKA.

## 1.0.52 — 2026-11-21
- Free hotel search shows 3 hotels at a time, each in its own box, with ‹ › arrows and "1–3 of 40" to see more.

## 1.0.51 — 2026-11-21
- Drag and drop: drop a passport photo or PDF from Finder / File Explorer onto the dashed box on the Applicants page (new applicant) or in the applicant editor (fills that applicant). Other file types get a short message; a file dropped elsewhere no longer replaces the side panel.
- Addresses over three lines are now read whole ("KARIM MIA BARI, EAST PARA, WARD-03, KALIR BAZAR, SADAR - 3500, COMILLA", example): line 1 and line 2 are packed to 35 characters, leaving out the ward number first when line 2 is too long. Spaces are repaired from the emergency contact's address ("MIABARI" → "MIA BARI"); "PARAWARD-03" and "BAZAR3500" are split.
- Issue date when the month is misread ("1200T2025"): taken from the expiry date (5 or 10 years less a day) when its day and year are printed.
- "This computer" scan: a NID split by a space is joined; the mother's name is no longer taken from the next line ("MOTHER" / "EAST PARA"); an empty "Permanent Address:" line is skipped; noise like "!" for I and short scraps after names ("HOSSAIN SM") are removed.
- Tested on the owner's 5 test passports (one a 1-year-old's): the server scan reads all 5 fully; the "This computer" scan matches it on 4 and on the fifth misses the NID and one address part and misreads one phone digit.

## 1.0.50 — 2026-11-21
- Smart scan removed. Passport scan is now two clear choices: **Server scan** (recommended, free) or **This computer only** (offline, nothing sent). If the server can't be reached, the scan still falls back to this computer. Anyone who had chosen Smart scan gets the server scan.
- Server OCR now uses the English recognition model: it keeps the spaces between words ("RINA RANI", "MD KARIM UDDIN", "EAST PARA, WARD 03", "GITA RANI DAS"), which the old model dropped, and it is a little faster. Model pinned to a fixed version and checked at build.
- Shared reading rules: dates with the letter O for zero ("O5JUL2026"); a full stop read for a comma in addresses ("NO-01.SADAR"); the same place twice without its comma ("SADAR SADAR"); misread labels ("Pemanent Address", "Place of Brth").
- Tested on the owner's 4 test passports: the server scan alone gives exactly what Smart scan gave, and the "This computer" scan now gives the same too.
- Privacy policy: the "Smart scan" mention removed.

## 1.0.49 — 2026-11-21
- Phone warning gets a "✎ Change" button next to "✓ Still in use": it scrolls to the Mobile box and selects the old number, ready to type the new one (Phone follows automatically). The two buttons stay together and drop below the text on a narrow side panel.

## 1.0.48 — 2026-11-21
- Shorter warnings in the applicant editor: "Religion ISLAM is a guess from the names." [✓ Correct] and "Phone 01712345678 is from the passport (2023)." [✓ Still in use], each with its button on the same line. The religion line is no longer repeated in the note shown after a scan. Same short text in the pre-flight check.

## 1.0.47 — 2026-11-21
- Applicant editor: Phone and Mobile fill each other. Typing 01712345678 in Phone fills Mobile with 1712345678 (no leading 0, as the site wants), and typing in Mobile fills Phone with the 0 added; +880 numbers work too. Only while the two boxes hold the same number (or one is empty): a landline or two different numbers are left alone.

## 1.0.46 — 2026-11-21
- Phone numbers read from the passport can be years old. A scanned phone/mobile number is now marked "from the passport": the applicant editor and the pre-flight check show "The phone number … was taken from the passport (issued …). Is it still in use?" with a "Number is current" button; typing a new number clears it.
- Saving an applicant whose number is still marked asks once: OK keeps it, Cancel jumps to the mobile box to change it.
- Scanning a passport into an existing applicant no longer replaces the phone number already saved there.
- Numbers typed by hand or imported from a BGD file are not marked.

## 1.0.45 — 2026-11-21
- Grey / black-and-white passport copies: the "This computer" scan could not read the photo page through the security pattern, so the place of birth (and more) was missing. When "Place of Birth" is not found, the photo page is read once more with only the darkest ink kept (black text on white). About 2 s extra, only for such copies.
- NID: it was sometimes taken from MRZ line 2, where the expiry date runs into the number (17 wrong digits). Now only printed lines are used.
- Name labels read badly ("Sutame", "Givens Name") are still recognised; stray marks around the printed name ('" SAHA', "MD KARIM.", "DAS SN") are dropped. This fixes surnames like "RANA KKMD" taken from a misread MRZ.
- Address: when the district is alone on the next line ("SADAR - 3500," then "COMILLA"), the district is now COMILLA, not SADAR.
- Tested: the owner's 4 test passports (one a low-resolution black-and-white copy), all fields correct with Smart scan; the other 3 unchanged.

## 1.0.44 — 2026-11-21
- Religion is now suggested by every passport scan (Smart, Server, This computer), not only the AI scan. It is read from the names of the applicant, father, mother and spouse (for example MD / UDDIN / BEGUM → Islam, CHANDRA / RANI / DAS → Hindu, BARUA / CHAKMA → Buddhism, GOMES / ROZARIO → Christian). Surnames used by several communities (SARKAR, BISWAS, MONDAL, CHOWDHURY, ROY …) don't count, and it stays empty when the names don't point clearly to one religion.
- A guessed religion is never final: the applicant editor and the pre-flight check show "Religion … was guessed from the names" until the applicant presses "Religion is correct" or chooses the religion again. A scan never replaces a religion the applicant already has.
- Tested on made-up names (13/13) and the owner's 3 test passports.

## Server — 2026-11-21 (no extension change)
- Google Places is on for the free hotel search: Places API (New) in the owner's Google Cloud project "My First Project" (the new "Visa Helper" project could not get billing: the account's limit of 3 billed projects is used). The key works only from the VPS IPs and only for Places API (New); it lives in `/opt/ivh/.env` as `GOOGLE_PLACES_KEY`.
- Tested: Kolkata 40 hotels (20 Google), Vellore 33 (20 Google), Siliguri 40 (15 Google).
- Fix: "with phone" now counts only the hotels actually returned (it could say 48 of 40).

## 1.0.43 — 2026-11-22
- Free hotel search for everyone (Hotels → Find hotels): real hotels from the helper server, no AI and no key. Sources: the owner's checked hotels first, Google Places (once the key is set; fetched live, not stored), and OpenStreetMap hotels from a local India list on the VPS, with phone numbers read from the hotels' own websites. Each result shows its source; credits shown under the list.
- Hotels with a phone number are shown by default; "Also show hotels without a phone number" adds the rest, each with a Google Maps link to look the number up. A hotel can only be saved once a real phone number (8+ digits) is filled in — numbers are never made up.
- AI hotel search stays available as "Search with AI instead" for people with an AI service or a Helper AI code.
- Server: `/api/hotels` (`server/hotels.mjs`), 30 searches per visitor per day, OpenStreetMap results kept 30 days per city, website addresses checked to be public before they are opened; local India hotel list built by `server/osm/update-hotels.sh`; admin section with counts, switches and the Google daily cap. Privacy policy: hotel search sends only the city name.

## 1.0.42 — 2026-11-22
- Names on the emergency page: common middle names are split off when OCR joined them ("GITARANI" → "GITA RANI", "RINARANIDAS" → "RINA RANI DAS", "GITABALADAS" → "GITA BALA DAS"); names that only look similar stay whole.
- No more false "does not look like a Bangladesh number" warning for the mobile box, which holds the number without its leading 0 as the visa site wants.
- Owner's 3 real passports (Smart scan): every field correct, including parents, spouse and addresses with their spaces.

## 1.0.41 — 2026-11-22
- Smart passport scan (recommended, first choice when asked): the server scan and the in-browser scan run at the same time and are merged field by field. Identity fields (passport no., dates, sex, NID) come from the scan whose MRZ check digits passed, and a "check the …" note appears when the two disagree; names and addresses keep the version with its spaces and commas; a field only one scan found is added. If one scan fails, the other's result is used. About 5 s.
- Specimens: Smart 9/9 on clean, tilted + blurred + glare and heavily blurred photos (browser scan alone found nothing on the hard ones).
- Settings → Passport scan: Smart / Server / This computer only. Privacy policy mentions Smart scan.

## 1.0.40 — 2026-11-22
Passport scan fixes from 3 real passport scans (owner's test; copies deleted afterwards). Both scans now read name, passport no., gender, dates of birth/issue/expiry, NID and place of birth correctly on all three.
- MRZ line 2 cut off at the left edge (first letter missing) was rejected, and MRZ line 1 was then taken as line 2, which garbled every field. Line 2 now needs 12+ digits, a missing first letter is allowed, and the letter is taken from the printed passport number.
- Names: the MRZ name is kept when the printed one is the same letters without the space ("RINARANI"); labels with slashes or typos ("/Suname", "/GivenName") are found.
- Emergency page: misread labels ("Fafher's Namo", "Father'sName:", "PermanenrAddress"), the mother's name on a line of its own, the spouse ("Spouse's Name" → spouse and Married), missing spaces before common surnames ("SUBHASHDAS" → "SUBHASH DAS"), address clean-up ("WARDNO-O1" → "WARD NO-01", doubled words, no commas), and the emergency contact's address when the permanent one cannot be read.
- `tools/test-passport-rows.mjs`: dev check that turns server OCR rows into fields.

## 1.0.39 — 2026-11-22
- Server passport scan, free for everyone: the OCR on the helper VPS (RapidOCR: PaddleOCR models on ONNX Runtime) reads the passport in 2–5 s, straightens tilted photos and turns sideways or upside-down ones. On made-up specimens it read all 9 fields of tilted, blurred and glare photos where the in-browser scan found nothing.
- The first scan asks where to scan (server, or this computer only); Settings → "Passport scan" changes it. If the server is unreachable, busy or the day's limit is used (40 per connection), the scan runs on this computer instead.
- Both scans share the field rules (`passportFromText` in `lib/passport-ocr.js`), which now also: take the full printed Surname / Given Name when MRZ line 1 confirms them, accept "Place ofBirth" without a space, and find the place of birth on the date-of-birth line when the labels are unreadable.
- Server: `server/ocr/` (Docker container on 127.0.0.1:8101, `sh server/deploy-ocr.sh`), `/api/ocr` with a per-visitor daily limit and a queue (`server/ocr.mjs`); admin shows scans per month and can switch it off or change the limit. Privacy policy updated.

## 1.0.38 — 2026-11-21
- Document upload is now fully automatic too (owner's decision): when every needed document shows Uploaded, a countdown of at least 3 seconds runs, then "I have verified that all the documents are uploaded…" is ticked and Confirm clicked. Pause stops it; the same setting (now "Tick declarations automatically (Additional questions, Document upload)") turns both off and shows the "I confirm" button instead.
- Simulated Document upload page now has the verification box and Confirm button, as on the live page.

## 1.0.37 — 2026-11-21
- Additional questions is now fully automatic (owner's decision): after the answers are filled, a countdown of at least 3 seconds runs, then the declaration is ticked and Save and Continue clicked. Pause stops it. Setting: Settings → "Tick the Additional questions declaration automatically" (on by default); when it is off, paused or something needs checking, the "I confirm — tick and continue" button is shown instead.
- The captcha and the final "Verified and Continue" stay manual. Store listing and privacy policy texts updated.

## 1.0.36 — 2026-11-21
- Additional questions page: after reading the answers, one click on "✓ I confirm — tick and continue" in the floating panel ticks the declaration and clicks Save and Continue. The declaration is still never ticked on its own (owner's decision); the captcha and the final "Verified and Continue" stay manual.
- The declaration box and the button are found by their text ("hereby declare", "Save and Continue"). New simulated page `tools/sim/AdditionalQuestions/` from the owner's screenshot.
- Store listing text and privacy policy updated to say declarations are ticked only after "I confirm".

## 1.0.35 — 2026-11-21
- Example data to try the extension right after installing (Settings → "Try it with example data", and a hint on the Start screen when there are no applicants): a made-up Tourist applicant RINA DAS with a drawn photo and a SPECIMEN passport copy, an example hotel, and Start choices that pass the pre-flight check.
- Sample files: a printed-style BGD application PDF (2 pages, text the import can read, with photo) and a passport image with a valid MRZ for the offline scan. "Remove example data" clears everything, including what an import of the sample created.
- `lib/example-data.js`. Example applicants show an "Example" badge.

## 1.0.34 — 2026-11-21
- Clean up Temporary IDs: ✕ removes one (Start screen and the applicant editor); "Clear finished & old" removes submitted ones and those older than 30 days; "Clear all" asks first. Only the saved list changes: applications on the visa site and the Application history are not touched. Submitted IDs no longer show Resume in the applicant editor.

## 1.0.33 — 2026-11-21
- Faster AI scan with River's Nemotron model: it no longer "thinks" before answering (reasoning off). A passport scan now takes about 2 seconds instead of 25–50, with the same fields read. Helper AI on the server got the same change.

## Server fix — 2026-11-21 (no extension change)
- Admin dashboard: every button (create access code, pause, limits, check now, field map, directory) failed, because the pages told Chrome to hide their origin and the server's safety check then crashed on "null". Admin pages now send their own origin; posts from anywhere else get a clear "Forbidden" message instead of a crash.

## 1.0.32 — 2026-11-21
Feature plan steps 4–7 (see FEATURE-PLAN.md).
- Letters & IVAC checklist (applicant editor): cover letter to the Visa Officer, employer NOC, parents' consent for a child, and a document checklist that ticks what is already saved. Edit the text, then save a PDF (`lib/letters.js`).
- Importing a printed BGD PDF also takes the applicant photo from it (when the applicant has none).
- Start screen: family / client queue (load the next person with the same trip details) and reminders (passports expiring within a year, applications waiting for a result).
- Applicants tab: overview (applicants, applications, granted, refused, passports running out, applications per week).
- Settings: backups can be locked with a password; "Lock with a PIN" for shared computers (locks after 5–60 minutes without use); agency sync — one encrypted applicant list shared by an agency's computers (needs a Helper AI access code; documents and PDFs stay on each computer).
- Hotels and Hospitals: "Directory" of checked places published by the owner from the admin dashboard.
- Phone form at ivh.techistbd.com/family: relatives or clients fill their own details on their phone and send the file; open it with Import backup. Nothing is uploaded.
- Needs Chrome 116 or newer (`minimum_chrome_version`): the side panel does not exist in older Chrome, such as Chrome 109 on Windows 7.
- Server: sync storage (encrypted blobs only), directory editor, phone form page.

## 1.0.31 — 2026-11-21
Feature plan step 3: Helper AI (invite only, free for the people you choose).
- Settings → AI service → "Helper AI (invited, access code)": paste a personal access code; "Save and check code" shows the name and the scans used this month. Passport scan and the hotel finder then work without an API key.
- Server (`server/ai.mjs`): relays the request to River with the owner's key (kept only on the VPS), checks the code, the person's monthly limit and the overall monthly cost cap. Codes are stored only as hashes; images and answers are never stored. Admin dashboard: create, pause, limit and remove codes; usage and estimated cost per person; cap and prices.
- Clear messages for a wrong or paused code, a used-up month and Helper AI switched off. The personal code is never put in backups or in "Share AI setup".
- VPS: firewall (ufw) turned on: only SSH, web and Tailscale are open.

## 1.0.30 — 2026-11-21
Feature plan step 2: helper server on the owner's VPS (`server/`, see `server/README.md`).
- Self-fixing field map: the extension downloads a small list of field and page renames from ivh.techistbd.com (at most once an hour, nothing sent) and applies it to every fill step. A renamed field on the visa site can now be fixed from the admin dashboard without a store update. No new permission.
- Server: website and privacy policy at ivh.techistbd.com; visa site check every 12 hours (public pages compared with the fields the extension uses); admin dashboard reachable only over Tailscale.
- Privacy policy: new paragraph about the form-update download.

## 1.0.29 — 2026-11-21
Feature plan step 1 (see FEATURE-PLAN.md).
- Checks while editing an applicant: NID length, phone and mobile format, email format, date of birth in the future, passport issue date in the future or after expiry, under-18 education ("NA BEING MINOR"), married without a spouse name. They show at the top of the editor as you type, and as warnings in the pre-flight check.
- Archive applicants: 📦 hides an applicant from the Applicants list and the Start screen while keeping their details, Temporary IDs and history. "Archived (n)" shows them; ↩ restores.
- Useful links on the Start screen: visa status check, print submitted application, India e-Arrival Card, Bangladesh travel tax (a-Challan), land port passenger fee (BLPA). Links only, no new permissions.

## 1.0.28 — 2026-11-16
- New icon: a filled form with a green tick on a blue tile (replaces the flag circle). Also used in the side panel header. Source `tools/icon.svg`; `node tools/make-icons.mjs` renders the PNGs and the store icon.
- Store: 25-second promo video (`store/promo-video.mp4`) and a store icon with the required transparent border (`store/store-icon-128.png`).

## 1.0.27 — 2026-11-16
Chrome Web Store preparation (listing text, privacy policy and images in `store/`).
- Extension name and description now say "Unofficial" and that it is not linked to the Government of India, as the store requires.
- AI servers are limited to River AI, OpenAI, OpenRouter, Google Gemini and a local Ollama (plus Anthropic). Before, the extension could ask for access to any website. Another server now shows "not on the extension's allowed list".
- `npm run zip` also builds `dist/indian-visa-helper-store-v<version>.zip` (manifest at the zip's root) for uploading to the store.

## 1.0.26 — 2026-11-01
Code audit (details in AUDIT.md).
- Start screen choices are saved as you change them, so they survive the panel re-drawing or closing. Changing the applicant on the Start screen while an application is being filled no longer switches whose data is filled.
- Document PDFs are never over the site's 500 KB limit, even for many or very detailed pages.
- Spouse's place of birth defaults to the applicant's when the profile has none.
- A value longer than a site box allows is cut to fit and shown in the floating panel (auto-advance waits for you). Mobile numbers are typed as digits only.
- New: warning before leaving the applicant editor with unsaved changes; Resume and last page in the Start screen's Temporary ID list; pre-flight warning for hotel addresses over 50 characters; "the visa site may have changed this page" alarm when several known fields are missing.
- Fixes: closing a file dialog without a file; empty CSV files; CSV email column; AI hotel links limited to http(s); remaining English-only texts translated to Bangla.

## 1.0.25 — 2026-11-01
- Application history: after you click "Verified and Continue", the page that shows the 12-character Application Id is recognised and the application is saved with the applicant (Application Id, Temporary ID, mission, visa type, date). The floating panel then offers "Save application PDF".
- Final application PDF: "Save PDF" opens the site's Print Registered Application page with mission, Application Id, date of birth and passport filled in. You type the captcha and click Reprint; the PDF the site returns is kept in the applicant's history and downloaded as `NAME_PASSPORT_TEMPID.pdf`. A wrong captcha shows the site's message and a fresh captcha. If the site shows a page instead of a PDF, save it with Print → Save as PDF and use "Attach PDF".
- Status check: "Check status" opens Visa Status Enquiry with the Application Id and passport number filled in. After you type the captcha and submit, the result (e.g. "Process Initiated") is saved with the date; the last 20 checks are kept.
- History is shown in each applicant's editor ("Submitted applications": add an older Application Id by hand, view/download the PDF, check status, remove), in the Applicants list (latest Application Id and status) and on the Start screen ("Application history").
- Importing an old BGD PDF also stores its Application Id and the PDF itself in the history once the applicant is saved.
- Backups now include the Temporary IDs and the application history.

## 1.0.24 — 2026-11-01
- Medical Visa Undertaking generator: in an applicant's documents, "✍ Make Visa Undertaking" (or ✍ on the Medical Visa Undertaking row) fills IVAC Bangladesh's official "Visa Undertaking Form" (ivacbd.com → Other Forms) with name, passport number, nationality, date of birth, address, purpose (MEDICAL TREATMENT + hospital, or TOURISM), return country and place/date.
- Every value can be edited before saving. "Download PDF" saves `VISA_UNDERTAKING_<NAME>_<PASSPORT>.pdf` to print and sign; "Download + put in this row" also stores it in the undertaking slot. The signature line is left empty: print, sign (both parents for a minor), scan and replace the file with the signed copy before uploading.

## 1.0.23 — 2026-11-01
- Pre-flight check on the Start screen ("Check now", and automatically on Start filling). Problems block Start, each with a Fix button that opens the right editor:
  passport expired or valid < 6 months after arrival; no photo; missing required documents or files outside 10–500 KB; empty required fields; address lines over 35 characters; married without spouse name; no/past arrival date; no email; no port; hotel missing or without name/address/state/district/phone; India reference incomplete; Bangladesh reference without a name; Medical without letter number, illness or a complete Bangladesh doctor/hospital (name, address, doctor, phone, email).
- Warnings (passport valid < 12 months, NID not 10/13/17 digits, unusual phone, visa type different from the profile) can be accepted with "Start anyway".

## 1.0.22 — 2026-11-01
- Medical: the hospital Email ID is now filled automatically from the invitation letter's official record (the site's lookup returns it but its own code never fills the box) and saved with the hospital. You only add an email by hand if the record has none.
- Medical: when the site refuses the page with "Please fill the medical invitation letter no issued on the same passport", the floating panel now says the letter was not issued for this applicant's passport (letter no. ≠ passport no.) instead of the generic message.

## 1.0.21 — 2026-11-01
- Medical: the invitation-letter lookup now runs exactly once, so the hospital name, address, doctor and phone appear once on the page (they were shown three times; the submitted values were already single).

## 1.0.20 — 2026-11-01
- Applicant profiles are Tourist (T1) or Medical (M1): "+ Tourist applicant" / "+ Medical applicant" buttons, a "This applicant applies for" field, and a Tourist/Medical badge in the Applicants list and the Start screen's applicant list.
- Tourist profiles ask only for the photo and the passport photo page; Medical profiles show the full Medical document checklist. Switching the type keeps files already saved.
- ⧉ in the Applicants list copies an applicant into the other type with all details, photo and files.
- Start screen: choosing an applicant sets Tourist (T1) or Medical (M1) from the profile.
- Old BGD PDF import sets the type from the PDF's visa type; imports and scans update the profile with the same passport and type. Profiles saved before count as Tourist.

## 1.0.19 — 2026-11-01
- Expected date of arrival is no longer set automatically: pick it on the Start screen (Tourist and Medical); it stays as you set it.
- Applicant documents are now a checklist of the site's upload rows, each marked Required / Required (Medical) / Optional: passport copy (all visas) and, for Medical, hospital letter (India) and Medical Visa Undertaking (required) plus 11 optional rows (address proof, tickets, NID copy, Indian-origin papers, nationality certificate, other passport, utility bill/bank statement, funds, attendant letter, patient treatment papers, previous medical records). Each file goes into its own slot (images/PDFs → one 100–500 KB PDF).
- Document Upload page: each site row gets only the file from its own slot — no more guessing by words (which could put the passport into "other nationality passport" or similar rows). Optional rows without a file are left empty; a missing required file stops the page and is named in the floating panel.
- An old file labelled "PASSPORT COPY" counts as the passport slot.

## 1.0.18 — 2026-11-01
- Medical: a successful invitation-letter lookup saves that hospital to the Hospitals list as an India hospital (name, address, doctor, phone from the official record; state/district guessed from the city in the address, e.g. Kolkata → West Bengal / Kolkata) and selects it for the application. A hospital saved before is updated, keeping its email, state and district.
- The hospital Email box always matches the letter's hospital. If that hospital has no email saved yet, the box is left empty and the floating panel asks you to add it in Hospitals and press "Fill again".
- Dev: tools/sim/VisaDetails/ simulates the Medical page and its lookup for testing the content scripts.

## 1.0.17 — 2026-11-01
- Medical visa (M1), mapped on the live site:
  - Start screen asks for the **medical invitation letter no.**, **nature of illness**, the Indian hospital and the applicant's **doctor/hospital in Bangladesh**; Start won't begin without the letter number.
  - On the visa details page the extension types the letter number and waits for the site's own lookup, which fills the Indian hospital (name, address, doctor, phone). If the site rejects the number, its popup is caught and shown in the floating panel and auto-advance stops.
  - Fills the hospital email (the site never does), the five "Residence …" fields from the Bangladesh hospital, and nature of illness. Values from the lookup are never overwritten.
- Hospitals tab: each hospital is "India (treatment)" or "Bangladesh (applicant's doctor)", with email and doctor. Hospitals saved before count as India.
- Section-header inputs on the visa details page are skipped instead of being reported as "no data".

## 1.0.16 — 2026-10-31
- Settings → AI passport scan: "Share AI setup (file)" saves the AI service settings for a tester or another computer; the API key is only included when you tick the box. The tester loads it with Settings → Import backup. Applicant data is never included.
- The first AI scan or hotel search asks Chrome for permission to reach the AI server when it is missing (e.g. after importing a shared setup).
- `npm run zip` builds dist/indian-visa-helper-v<version>.zip with the extension and TESTER-GUIDE.md.

## 1.0.15 — 2026-10-31
- Hotel page / India reference: fixed District being wiped ("#pos_dist_id1 was reset"). After choosing a State the extension now waits until the District list has stopped changing, re-sets a district that a later refill wiped (up to twice), and checks again right before auto-advance clicks Continue. It still stops with a warning if the value really won't stay.

## 1.0.14 — 2026-10-31
- Reference in Bangladesh is chosen per applicant: the spouse if married (with a spouse name), otherwise the father (the mother if no father's name). It uses the applicant's address and phone. A reference picked by hand on the Start screen is kept for that applicant.
- Removed the "Default Bangladesh reference" setting (and no longer reuses the reference from an imported BGD PDF automatically).

## 1.0.13 — 2026-10-31
- Hotels tab: new "✨ Find hotels by city (AI)". Type a city (e.g. Kolkata) and get 4 real hotels with name, address split for the form, state, district, PIN and phone.
  - Claude searches the web live and shows each hotel's source link; OpenAI-compatible services (e.g. River) answer from model memory and are flagged "check before use"; unknown phone numbers are left empty, never invented.
  - "Save" adds the hotel to the Hotels list; "Save & use" also selects it for the next application with the India reference set to "Same as hotel".
- AI requests moved to a shared module (lib/ai-client.js) used by the passport scan and the hotel finder.

## 1.0.12 — 2026-10-31
- Spouse's place of birth defaults to the applicant's place of birth (only when empty), like the parents'.
- Start screen: expected date of arrival is always today + 30 days. A date changed by hand is kept for that day; the next day it resets to today + 30.

## 1.0.11 — 2026-10-31
- After any passport scan (offline or AI) or BGD PDF import, empty fields get Bangladesh defaults: father's and mother's place of birth = the applicant's; their nationality, previous nationality and country of birth = Bangladesh; applicant born in Bangladesh, nationality by birth; spouse Bangladeshi and marital status MARRIED when a spouse is found; passport address used as both present and permanent address. Typed or imported values are never overwritten.
- AI scan suggests the religion from the names (it is not printed on Bangladesh passports) and always flags it for confirmation.
- AI scan instructions now ask for form-ready values: address split into the form's 35-character lines without repeats or dashes, spouse taken from an emergency contact marked SPOUSE/HUSBAND/WIFE.

## 1.0.10 — 2026-10-31
- AI scan: repeated parts and trailing dashes removed from address lines ("SADAR, SADAR -" → "SADAR").
- Tested live with River AI (`https://api.river.ai/v1`, model `nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-NVFP4`): both sample passports read correctly in under 30 s.
- `tools/test-ai-scan.mjs`: runs the extension's AI scan against an OpenAI-compatible server from Node (key read from ~/.visa-helper-ai-key).

## 1.0.9 — 2026-10-31
- AI scan settings (OpenAI-compatible): new "List models from this server" button reads the server's /models list so you pick a model name that exists there (fixes "Model 'gpt-4o-mini' not found" on River AI). OpenAI-only example names removed from the suggestions; the API key field now comes before the model.

## 1.0.8 — 2026-10-31
- AI scan (OpenAI-compatible): reply budget raised to 16,000 tokens so reasoning models (River AI and others) don't run out before the JSON answer.
- River AI added to the setup examples (https://api.river.ai/v1) and its vision model to the model suggestions.

## 1.0.7 — 2026-10-31
- AI passport scan can now use any OpenAI-compatible API (OpenAI, OpenRouter, Gemini's OpenAI endpoint, Groq, local Ollama / LM Studio …): Settings → AI passport scan → AI service → OpenAI-compatible API, then base URL, model name and key, and "Save & allow this server" (Chrome asks once for permission to reach that server).
  - Tries a strict JSON schema first, then JSON mode, then plain text, so servers with partial support still work; JSON inside ``` fences or sentences is accepted.
  - Loose dates ("21 NOV 1988", "05/07/2026") and "FEMALE"/"MALE" are normalised; missing fields are tolerated.
  - The same MRZ check-digit cross-check and review notes as the Claude option.
- Both AI keys stay in this browser and are left out of backups.

## 1.0.6 — 2026-10-31
- New optional "✨ Scan with AI" (Applicants list and applicant editor): reads the passport with Claude using your own Anthropic API key (Settings → AI passport scan). Claude Opus 5.5 by default (most accurate), Claude Haiku 5.5 as the cheaper option.
  - Returns every field the offline scan does, plus spouse; passport number and dates are cross-checked against the machine-readable line's check digits and corrected if the printed reading disagrees.
  - Unclear or hidden fields are listed in the review note instead of guessed.
  - The API key is stored only in this browser and is left out of backup files. The normal "Scan passport" stays fully offline.
- Official Anthropic SDK bundled into extension/lib/anthropic (built by `npm run vendor`).

## 1.0.5 — 2026-10-31
- Passport scan, tested on a second real passport (photo with a thumb over the code line):
  - Printed text is read per page half as well as whole, which recovers the issue date and place of birth on busy backgrounds.
  - Passport number: when the first letter is hidden, the check digit and the printed number pick it, with a "check the passport number" warning.
  - Place of birth matched against Bangladesh's 64 districts; stray scraps trimmed from the address.

## 1.0.4 — 2026-10-31
- Passport scan rewritten after testing on a real Bangladesh passport scan:
  - MRZ lines are found by layout and read one line at a time; line 2 is chosen by its check digits (passport no., birth date, sex, expiry exact).
  - Names: misread '<' fillers (C, L, K, S) are removed using the names printed elsewhere on the passport; one-letter misreads are corrected (JFNY → RINA).
  - Printed text is read from the unprocessed image (better NID, issue date, place of birth, father/mother, address, phone).
  - Issuing office matched against known passport offices ("DIP/IDHAKA" → DHAKA); stray characters trimmed from place of birth, parents' names and address.

## 1.0.3 — 2026-10-31
- Temporary Application IDs are saved per applicant, with date and the last page reached. The Applicants list shows each person's latest ID; the applicant's profile lists all of them with Copy and Resume.
- Resume opens "Complete Partially Filled Form" through the home page with the ID filled in; you type the captcha.
- Safety: the helper won't fill a page that shows a different Temporary ID from the one it is working on, and Start always begins from the home page instead of reusing an open form page.
- Applicant editor: fields that depend on an answer (previous name, spouse, other passport, …) are hidden again until needed.

## 1.0.2 — 2026-10-31
- Hotel page and India reference: wait for the site to reload the District list after choosing a State, then pick the district (before, KOLKATA was picked from the all-India list and then wiped by the reload).
- Safety check: after filling a page, every dropdown is re-checked; if the site reset one, the page stops with a warning instead of moving on.

## 1.0.1 — 2026-10-31
- Start now opens the visa home page and follows "Online Visa Application" (the site redirects a direct Registration URL to the home page).
- Document upload: the passport row falls back to the applicant's document when no document name matches; new documents default to the name "PASSPORT COPY".
- Passport scan: full 17-digit NID from the printed Personal No. (the MRZ keeps only 14 digits); cleaner place of birth; reads father, mother, address and phone from the emergency-contact page.
- Automated Photo Upload (choose → crop → save), Document Upload, Hotel / place of stay page (up to 2 places), resume page, and final Verification page (stops for the applicant).
- Version number shown in the side panel and floating panel.

## 1.0.0 — 2026-10-31
- First version: applicants, hotels, hospitals and references; BGD PDF import; offline passport scan; photo cropper; PDF compression; English/Bangla; pages 1–5 filled with auto-advance.
