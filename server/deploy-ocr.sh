#!/bin/sh
# Builds and (re)starts the passport OCR container on the VPS (ssh host "vps"). Run from the project folder:
#   sh server/deploy-ocr.sh
# It listens only on 127.0.0.1:8101; the helper server (server.mjs) is the public door (/api/ocr).
set -e
cd "$(dirname "$0")"
rsync -a --delete ocr/ vps:/opt/ivh-ocr/
ssh vps 'cd /opt/ivh-ocr && docker build -q -t ivh-ocr:latest . >/dev/null \
  && (docker rm -f ivh-ocr >/dev/null 2>&1 || true) \
  && docker run -d --name ivh-ocr --restart unless-stopped -p 127.0.0.1:8101:8101 --memory 2g --cpus 3 ivh-ocr:latest >/dev/null \
  && sleep 5 && curl -s 127.0.0.1:8101/health && echo'
