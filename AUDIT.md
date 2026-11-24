# Code audit — v1.0.26 (2026-11-01)

A full read of the extension: content scripts, page plans, the bridge, the side panel, the shared code and the PDF tools.
Each fixed item was tested in the panel preview or on the simulated site pages in `tools/sim/`.

## Bugs fixed

| # | Where | Problem | Fix |
|---|---|---|---|
| 1 | Start screen | Choices typed on the Start screen (places, email, letter no., ports …) were only held on screen. They were lost when the panel re-drew, e.g. when the visa tab recorded a Temporary ID, or when the panel was closed. | The choices are saved as a draft (`startDraft`) on every change. |
| 2 | Start screen | Picking another applicant while an application was being filled changed the running session. The next page would then be filled with the other person's data on the first person's application. | The running `session` is only written by Start and Resume. Start-screen changes go to the draft. |
| 3 | `lib/image-tools.js` | When the size search did not land inside 100–500 KB, it returned its last try. That try could be over 500 KB, which the site refuses. | It never returns more than 500 KB: it keeps the largest try under the limit. |
| 4 | `content/pages.js` | A married applicant entered by hand had an empty spouse place of birth. Only scans and imports set the default. | It now falls back to the applicant's own place of birth (the owner's rule). |
| 5 | `content/bridge.js` | Values longer than a site box's `maxlength` were sent in full, because setting `.value` skips the limit. | The value is cut to the limit like typing would, and the floating panel says so. This also stops auto-advance so you can check it. |
| 6 | `content/pages.js` | A mobile number with spaces or dashes (`01712-345678`) was typed with them. | Only digits are used. |
| 7 | Side panel | Closing a file dialog without choosing a file left the action waiting forever. | The `cancel` event now finishes it. |
| 8 | CSV import | An empty CSV file crashed the import. The `email` column was ignored, although hotels and hospitals need an email. | An empty file shows a message, and `email` is imported in lowercase. |
| 9 | AI hotel finder | The "source" link from the AI answer was used as given. | Only `http(s)` links are shown. |
| 10 | Status Enquiry page | The submit listener could be added more than once. | It is added once. |
| 11 | i18n | The crop dialog help, the CSV help and the Copy/Download/Hide tooltips were English only. | They are now in English and Bangla. |

## Improvements made

- **Unsaved-changes warning:** Cancel in the applicant editor asks before throwing away changes. This includes an unsaved scan or import, which can hold a lot of work.
- **Resume from the Start screen:** "Recent Temporary IDs" shows the last page reached and a ↻ Resume button. There is no Resume for a submitted application, or when its applicant was deleted.
- **Pre-flight warning:** warns when a hotel address is longer than the site's 50 characters and will be shortened.
- **Site-change alarm (roadmap must-have 6):**
  - When three or more of a page's known fields are missing, the floating panel says the visa site may have changed the page.
  - Before, this showed only as a list of technical errors.
- **Code cleanup:** duplicated comments removed in `pages.js`.

## Checked, no change needed

- The Temporary ID guard: a page of another application is never filled.
- The auto-advance loop guard.
- The District re-check.
- The declaration, captcha and final submit are never automated.
- API keys are kept out of backups and the zip.
- No real personal data is in the source.
- The bridge only answers its own messages.

## Still open (recommended next)

1. **Live check of the history features from v1.0.25.** This covers the page after "Verified and Continue", and the real Reprint and Status Enquiry answers. It needs one real submitted application.
2. **Medical full run** with a passport and an invitation letter issued for that passport.
3. **Medical Attendant (M2).**
4. **Page titles in the floating panel** are English only (`pages.js` titles). They match the site's own English page names.
5. **Missing fields wait 3 s each.** On a changed page the fill can take over a minute before the site-change alarm shows. A shorter wait could be used once a page has several missing fields.
6. **Stored data is not encrypted.** Anyone using the Chrome profile can read applicant data. A passphrase lock would help agencies on shared computers.
7. **Deleting an applicant** keeps their Temporary IDs and application history. This is on purpose, but there is no "delete everything for this person" button yet.
