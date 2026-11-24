# Instructions for working on this project

Chrome extension (MV3) that fills the Indian visa application at https://indianvisa-bangladesh.nic.in
(Bangladesh missions). Read `PROJECT-NOTES.md` first: it covers the current status, how each site page is handled, site quirks, the code map and the roadmap.

## Every change

- Bump `"version"` in both `extension/manifest.json` and `package.json`. Use the patch level, e.g. 1.0.22 → 1.0.23.
- Add a dated entry to `CHANGELOG.md`.
- Tell the owner the new version and to click ↻ on the extension in `chrome://extensions`.
- Rebuild the tester package with `npm run zip`, which writes `dist/indian-visa-helper-v<version>.zip`.
- Keep `PROJECT-NOTES.md` current: status table, completed work, roadmap.
- Run `node --check` on every changed `.js` file.
- Match the existing code style: plain JS, no bundler for extension code, `globalThis.IVH` for shared scripts, ES modules in `lib/`.
- Every UI string lives in `shared/i18n.js`, in English and Bangla.

## Testing

- **Side panel:** run `python3 -m http.server 8765` in the project folder, then open `http://localhost:8765/tools/panel-harness.html?v=N`. `tools/chrome-mock.js` fakes `chrome.*` using localStorage.
- **Regenerating the harness:** after changing `sidepanel.html`, regenerate it:

  ```bash
  sed -e 's#<head>#<head>\n  <base href="/extension/sidepanel/">\n  <script src="/tools/chrome-mock.js"></script>#' extension/sidepanel/sidepanel.html > tools/panel-harness.html
  ```
- **Content scripts:** use `tools/sim/VisaDetails/` and `tools/sim/DocumentUpload/`. Extend these when mapping new pages.
- **Live site:**
  - Use dummy applicant data and a fake email such as visahelper.test@example.com. The owner types the captcha.
  - Never tick declarations and never click "Verified and Continue".
  - The live site blocks scripts loaded from localhost. To test bridge code there, paste a minified copy (`npx esbuild file --minify`).
- **AI scan against River:**
  - The owner saves the key with `pbpaste > ~/.visa-helper-ai-key`.
  - Run `node tools/test-ai-scan.mjs https://api.river.ai/v1 <model> <image.jpg>`.
  - Never print the key, and delete the key file after testing.
- **Clean up afterwards:** temporary copies of real passports, keys or test data (in `tools/` or localStorage) must be deleted after testing.

## Rules

- **Never automated:** the captcha and the final submit ("Verified and Continue"). These stay with the applicant.
- **Declarations:** the Additional questions declaration (→ Save and Continue) and the Document upload verification box (→ Confirm) are ticked automatically after a countdown (owner's decision, 2026-11-21), controlled by Settings → "Tick declarations automatically" (on by default). Pause, the setting off, or any issue shows the "I confirm" button instead. The final "Verified and Continue" stays manual.
- **API keys:** never in code, comments, backups or the tester zip. They are shared only through Settings → "Share AI setup".
- **No real personal data in source files.** Use made-up examples (RINA DAS, A12345679, COMILLA …).
- **AI hotels:** never invent hotels or phone numbers. Results from a model without web search are flagged for checking.
- **Unknown pages:** for a site page that isn't mapped yet, map it on the live site with a dummy test application before writing a fill plan. Field ids and option values must come from the live site.

## Owner's setup

- **AI service:** River AI, OpenAI-compatible, `https://api.river.ai/v1`, vision model `nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-NVFP4`.
- **Visa types in scope:** Tourist (T1, purpose 544) and Medical (M1, purpose 545). Medical Attendant (M2) comes later.
- **Expected arrival date:** chosen by the owner. No automatic date.
- **Helper server:** `server/` runs on the owner's VPS (`ssh vps`) as the `ivh` service behind Caddy at ivh.techistbd.com. Deploy with `sh server/deploy.sh`; the passport OCR container with `sh server/deploy-ocr.sh`. The admin dashboard is reachable only over Tailscale. Never put API keys or passwords in `server/`; they live in `/opt/ivh/.env`.
- **Reference in Bangladesh:** the spouse if married, otherwise the father. The India reference defaults to the hotel.
