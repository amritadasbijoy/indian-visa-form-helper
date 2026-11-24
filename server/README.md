# Helper server (ivh.techistbd.com)

Plain Node.js (no npm packages), running on the owner's VPS as the `ivh` systemd service.

| Part | Address | What it does |
|---|---|---|
| Website | https://ivh.techistbd.com/ | Landing page (`public/index.html`) |
| Privacy policy | https://ivh.techistbd.com/privacy | Copied from `store/privacy-policy.html` on every deploy |
| Field map | https://ivh.techistbd.com/api/fieldmap.json | Field/page renames the extension applies (data only, validated on both sides) |
| Helper AI | https://ivh.techistbd.com/api/ai/ | Invite-only relay to River (`ai.mjs`): access codes (stored as hashes), monthly limit per person, monthly cost cap |
| Agency sync | https://ivh.techistbd.com/api/sync/<id> | Encrypted applicant lists (`sync.mjs`); needs a valid access code; the server cannot decrypt them |
| Directory | https://ivh.techistbd.com/api/directory.json | Checked hotels and hospitals edited in the admin (`directory.mjs`) |
| Passport scan | https://ivh.techistbd.com/api/ocr | Free server OCR for everyone (`ocr.mjs` → OCR container `server/ocr/` on 127.0.0.1:8101, RapidOCR). 40 scans per visitor per day, 2 at a time; images never stored |
| Hotel search | https://ivh.techistbd.com/api/hotels?city= | Free for everyone (`hotels.mjs`): the owner's checked hotels, Google Places (if `GOOGLE_PLACES_KEY` is set; live, not stored, daily cap), and OpenStreetMap hotels from the local India list (`india-hotels.json`, built by `osm/update-hotels.sh`) with phone numbers read from the hotels' own websites. 30 searches per visitor per day |
| Phone form | https://ivh.techistbd.com/family | Applicants fill their own details; the file is made on the phone, nothing is uploaded |
| Admin | http://<tailscale-ip>:8100/ | Tailscale only + password. Helper AI codes and limits, site-check results, baselines, field map, directory |

- **Site check:** every 12 hours the server reads the visa site's public pages (Registration, Resume, Status, Print) and compares their field ids with the ids the extension uses (`EXPECTED` in `sitecheck.mjs`) and with the last accepted copy. Inner form pages need a session and are covered by the extension's own alarm.
- **Field map format:** `{"ids": {"old": "new"}, "pageIds": {"BasicDetails": {"old": "new"}}, "pageAliases": {"NewPath": "BasicDetails"}}`. Extensions fetch it at most once an hour.
- **Settings:** `/opt/ivh/.env` (see `.env.example`). The admin password is kept by the owner, outside the repository. Optional Telegram alerts: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- **Data:** `/opt/ivh/data/`: `fieldmap.json`, `baseline.json`, `sitecheck.json`, `codes.json` (hashes), `settings.json`, `usage-YYYY-MM.json` (counters), `directory.json`, `sync/*.json` (encrypted). No images, no answers; no access log for this site in Caddy.
- **River key:** `RIVER_API_KEY` in `/opt/ivh/.env` (never in the repository). Caddy allows 12 MB requests on this site for scans.
- **Hotel list refresh:** run `/opt/ivh/osm/update-hotels.sh` on the VPS (about 15 minutes: downloads India from Geofabrik, keeps hotels only, deletes the big file; log in `/var/log/ivh-osm.log`). Runs monthly from `/etc/cron.d/ivh-osm` (03:30 on the 3rd).
- **Google Places key:** `GOOGLE_PLACES_KEY` in `/opt/ivh/.env`, restricted to the Places API (New) and the VPS address; daily cap in the admin dashboard.
- **Firewall:** ufw allows 22, 80, 443 and Tailscale only.
- **Deploy:** `sh server/deploy.sh` from the project folder (rsync to the `vps` SSH host, restart the service; the website's contact email comes from `~/.ivh-contact-email`, never from the repository). OCR container: `sh server/deploy-ocr.sh` (Docker image `ivh-ocr`, 2 GB memory and 3 CPUs at most).
- **Caddy:** block `ivh.techistbd.com` in `/etc/caddy/Caddyfile` (backup `Caddyfile.pre-ivh.<time>`). DNS: A record `ivh` → the VPS address at Cloudflare, DNS only (grey cloud) like the other subdomains.
- **Logs:** `ssh vps journalctl -u ivh -n 50`
