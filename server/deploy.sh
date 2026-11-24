#!/bin/sh
# Copies the server to the VPS (ssh host "vps") and restarts it. Run from the project folder: sh server/deploy.sh
set -e
cd "$(dirname "$0")"
cp ../store/privacy-policy.html public/privacy.html
# The contact email is not kept in the repository: it is read from ~/.ivh-contact-email and put into the pages on the VPS.
EMAIL=$(cat ~/.ivh-contact-email 2>/dev/null || true)
[ -n "$EMAIL" ] || { echo "Missing ~/.ivh-contact-email (one line: the contact email for the website)"; exit 1; }
rsync -a --delete --exclude data --exclude .env --exclude deploy.sh --exclude '.env.example' ./ vps:/opt/ivh/
ssh vps "sed -i 's/__CONTACT_EMAIL__/$EMAIL/g' /opt/ivh/public/*.html"
ssh vps 'chown -R root:root /opt/ivh && mkdir -p /opt/ivh/data && chown ivh:ivh /opt/ivh/data && cp /opt/ivh/ivh.service /etc/systemd/system/ivh.service && systemctl daemon-reload && systemctl restart ivh && sleep 2 && systemctl is-active ivh'
