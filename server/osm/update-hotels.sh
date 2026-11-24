#!/bin/sh
# Monthly: refreshes the local list of hotels in India for the free hotel search (server/hotels.mjs).
# Downloads India from OpenStreetMap (Geofabrik, ~1.7 GB), keeps only hotels / guest houses / motels, writes
# /opt/ivh/data/india-hotels.json (a few MB) and deletes the big file. Runs on the VPS (cron, root).
set -e
D=/opt/ivh-osm
mkdir -p "$D" && cd "$D"
curl -sSL --retry 3 -o india.osm.pbf.tmp https://download.geofabrik.de/asia/india-latest.osm.pbf
mv india.osm.pbf.tmp india.osm.pbf
osmium tags-filter india.osm.pbf nwr/tourism=hotel,guest_house,motel -o hotels.osm.pbf --overwrite
osmium export hotels.osm.pbf -f geojsonseq -x print_record_separator=false --add-unique-id=type_id -o hotels.geojsonseq --overwrite
node /opt/ivh/osm/compact.mjs hotels.geojsonseq /opt/ivh/data/india-hotels.json.tmp
chown ivh:ivh /opt/ivh/data/india-hotels.json.tmp
mv /opt/ivh/data/india-hotels.json.tmp /opt/ivh/data/india-hotels.json
rm -f india.osm.pbf hotels.osm.pbf hotels.geojsonseq
echo "india-hotels.json updated $(date -u +%F)"
