# Indian Visa Fill-up Helper — tester guide

Thank you for testing. The extension fills the Indian visa application on
https://indianvisa-bangladesh.nic.in for all Bangladesh missions (Tourist and Medical).

## 1. Install (5 minutes)

1. Unzip `indian-visa-helper-v<version>.zip`. You get a folder named `indian-visa-helper`.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped `indian-visa-helper` folder.
   Choose the folder that contains `manifest.json`.
5. Pin the extension (puzzle icon → pin) and click it to open the side panel.
   The version number shows next to the title.

## 2. Turn on AI scanning (optional)

If you were sent a file named `visa-helper-ai-setup….json`:

1. In the side panel, open **Settings → Import backup** and choose that file.
2. The first time you use **✨ Scan with AI** or **Find hotels**, Chrome asks to allow the AI server.
   Click **Allow**.

Without the file, the normal **🛂 Scan passport** button still works fully offline.

## 3. Try it

**Fastest way:** Settings → **🧪 Try it with example data** → **+ Add example applicant**. This adds a made-up Tourist
applicant (RINA DAS) with a photo, a SPECIMEN passport copy, an example hotel and Start screen choices, so you can go
straight to step 3 below. The same card has a **Sample BGD PDF** (try Applicants → Import old BGD PDF) and a
**Sample passport image** (try 🛂 Scan passport). **Remove example data** clears it all. Never submit an example application.

Or with your own test data:

1. **Applicants** → **+ Tourist applicant** or **+ Medical applicant**, or **✨ Scan with AI** / **🛂 Scan passport**
   with a passport image or PDF. Check every field, set **This applicant applies for** (Tourist or Medical),
   add the photo with **Choose photo** and the documents marked **Required**, then click **Save**.
   To apply for the other visa type too, use **⧉** in the list to copy the applicant.
2. **Hotels** → type a city (e.g. `Kolkata`) → **Find hotels** → **Save & use**.
   You can also add a hotel by hand with **+ Add**.
3. **Start** → pick the applicant, mission, visa type and hotel → **Start filling**.
4. On the visa site:
   - **Page 1:** type the captcha and click Continue.
   - **Most pages:** filled and continued automatically.
   - **Additional questions and document checks:** you tick the declarations.
   - **Final review page:** the extension stops there. Do not click "Verified and Continue" for test data.

## 4. Reporting a problem

Send a screenshot of the page with the floating **Indian Visa Helper** panel (bottom right) visible.
Include the version number and the Temporary Application ID it shows.

## Privacy

- Applicant data stays in your Chrome only.
- **Scan with AI** and **Find hotels** send the passport image or city name to the AI service.
- Do not share the AI setup file. The AI key in it will be revoked after testing.
