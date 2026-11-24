# Feature plan (after the Chrome Web Store release, v1.0.28)

Built from:
- the competitor comparison (`competitor/COMPARISON.md`, Indian Visa Autofill Pro 10.1.3)
- the open roadmap items in `PROJECT-NOTES.md` §10
- the owner's VPS plan (techistbd.com, invite-only AI)

Rules that stay: the extension is free; the captcha, declarations and final submit stay with the user; passports are never stored on a server; we write our own code and never copy the competitor's.

Size: S = a day or less · M = a few days · L = a week or more.

---

## A. Missing features (the competitor has them, we don't)

| # | Feature | Our version (better how) | Size | Server? |
|---|---|---|---|---|
| A1 | ✅ v1.0.31 — AI scan without the user's own key | **Invite-only "Helper AI"**: access codes from the admin dashboard, monthly limit per person, images not stored | L | Yes |
| A2 | ✅ v1.0.32 — Cover letter generator | Templates for tourist and medical, in English. Filled from the profile and the trip, edited before printing, made on the computer | M | No |
| A3 | ✅ v1.0.32 — NOC letter generator | For employed applicants: employer name, designation and leave dates from the profile | M | No |
| A4 | ✅ v1.0.32 — Consent paper (minor travelling) | Filled for both parents from the family details | S | No |
| A5 | ✅ v1.0.32 — Photo cropped from an imported BGD PDF | Automatic, then shown in the crop tool to adjust | M | No |
| A6 | ✅ v1.0.29 — Portal shortcuts | One panel: E-Arrival, Air Suvidha, travel tax, port tax, status check. Links only, so no new permissions | S | No |
| A7 | ✅ v1.0.29 — Hide applicants | "Archive" old clients instead of deleting them; archived ones are left out of search and lists | S | No |
| A8 | ✅ already built (after Start, every visa page fills when it opens; auto-advance setting) — Fill as soon as a page opens | Setting "Start filling automatically on visa pages" (off by default) | S | No |
| A9 | ✅ v1.0.32 (checked: the side panel needs Chrome 114+, so Chrome 109 / Windows 7 cannot run it; minimum set to 116) — Older Chrome support | Test on Chrome 109 (Windows 7 shops) and fix what breaks | S–M | No |

## B. Open items from our own roadmap

| # | Feature | Size | Server? |
|---|---|---|---|
| B1 | Live check of history, PDF save and status with a real submitted application | S | No |
| B2 | Medical full end-to-end run | S | No |
| B3 | Medical Attendant (M2) | M | No |
| B4 | ✅ v1.0.32 — Batch / family queue: line up several applicants; the next starts after each final review | M | No |
| B5 | ✅ v1.0.32 (PIN lock + password-locked backups; data inside Chrome itself is not encrypted) — Password lock and encrypted data on shared computers | M | No |
| B6 | ✅ v1.0.29 — Data checks while editing (NID length, phone, minors, spouse) | S | No |
| B7 | Medical document helpers (reusable family files, expected rows per mission) | M | No |

## C. New features beyond the competitor

| # | Feature | Why users care | Size | Server? |
|---|---|---|---|---|
| C1 | ✅ v1.0.30 — **Self-fixing field map**: page field ids served as a data file from the VPS, plus a daily check of the visa site's public pages that alerts the owner | Site changes are fixed in minutes, not after a store review | M | Yes |
| C2 | ✅ v1.0.32 — **Encrypted agency sync**: several computers share one applicant list; encrypted with the agency's passphrase before upload | Agencies with several desks; the server can't read the data | L | Yes |
| C3 | ✅ v1.0.30 (site check + field map; codes come with A1) — **Admin dashboard** (only reachable over Tailscale): access codes, limits, usage, monthly cost cap, site-change alerts | Owner control over AI cost and who uses it | M | Yes |
| C4 | ✅ v1.0.32 — **Passport expiry and visa reminders**: list of applicants whose passport expires within a year, and applications waiting for a result | Agencies bring clients back at the right time | S | No |
| C5 | ✅ v1.0.32 — **Document checklist PDF** per applicant: what to bring to IVAC, with ticks for what is already saved | Fewer wasted IVAC trips | S | No |
| C6 | ✅ v1.0.32 (directory is empty until the owner adds checked places in the admin) — **Verified hotel and hospital directory** for common cities (Kolkata, Chennai, Vellore, Delhi), served from the VPS | Correct state/district names; no invented hotels | M | Yes |
| C7 | **Bangla video help** inside the panel (short how-to videos on the website) | Families learn without calling the agency | S | Yes (website) |
| C8 | ✅ v1.0.30 (live) — **Own website** `ivh.techistbd.com`: privacy policy, FAQ, tutorials, support form | Trust; replaces the Google Doc policy link | S | Yes |
| C9 | ✅ v1.0.32 — **Agency dashboard**: applications per week, pending results, expiring passports | Agency overview | M | No |
| C10 | **Indian e-Arrival Card autofill** from the same profile (fields only; submit stays with the user) | One profile for visa and trip | M | No |
| C11 | **IVAC appointment page autofill** (applicant details only; no slot grabbing, payment stays manual) | Common agency step | M | No |
| C12 | ✅ v1.0.32 (ivh.techistbd.com/family: file sent by the family, nothing uploaded) — **Applicant QR / share link for families**: a family member fills their own details on a phone form and sends an encrypted file to the agency | Agency gets clean data without typing | L | Optional |

## Not doing (and why)
- **Automatic captcha solving:** against the captcha's purpose; risks the store listing and the visa site's rules.
- **Storing passports on our server.**
- **Forced sign-in** for basic features.
- **Analytics trackers.**

---

## Suggested order

| Step | Items | Result |
|---|---|---|
| 1 | B1, B2, B6, A7, A6 | Quick wins and checks. B6, A7, A6 done in v1.0.29; B1 and B2 need a real application by the owner. Air Suvidha was left out: its site refused connections and the e-Arrival Card is the current arrival form |
| 2 | C8, C1, C3 (website, field map, admin) | VPS foundation |
| 3 | A1 (Helper AI, invite codes) | Biggest gap vs the competitor closed, still free |
| 4 | A2, A3, A4, C5 | All the documents an agency prints |
| 5 | A5, C4, B4, B3 | Faster work for families and agencies |
| 6 | B5, C2, C9, C6 | Agency features |
| 7 | C10, C11, C12, A8, A9, C7 | Extras |

## Still open (needs the owner or the live site)
- **B1, B2:** live check of history/PDF/status after a real submission, and a full Medical run.
- **B3 Medical Attendant (M2):** its visa-details page must be mapped on the live site with a dummy application (the owner types the captcha).
- **C7 Bangla videos:** need recording.
- **C10 e-Arrival Card autofill:** the form at indianvisaonline.gov.in/earrival must be mapped live first.
- **C11 IVAC appointment autofill:** the IVAC site blocks automated access (Cloudflare); map it in the owner's own browser first.
- **Encryption of data inside Chrome:** today the PIN hides the panel; the data in Chrome's storage is not encrypted.
