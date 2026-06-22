#!/bin/bash

RSID="1275888"
PASS="Rsmf@2026$"
# ID_T_TT for VIP_TEST from earlier logs? Let's get one from the GET response.
# Let's grep the GET response for "ICU 01" which has id_t_tt "30694927"
ID_T_TT="30694927"

URL="https://sirs.kemkes.go.id/fo/index.php/Fasyankes/$ID_T_TT"
TIMESTAMP=$(date +%s)

echo "Testing POST to URL with id_t_tt..."
curl -v -X POST $URL \
  -H "X-rs-id: $RSID" \
  -H "X-pass: $PASS" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "Content-Type: application/json" \
  -d '{"id_tt":"38","ruang":"ICU 01","jumlah_ruang":"0","jumlah":"1","terpakai":"0","terpakai_suspek":"0","terpakai_konfirmasi":"0","prepare":"0","prepare_plan":"0","covid":"0","antrian":"0"}'

echo -e "\n\nTesting PUT to URL with id_t_tt..."
curl -v -X PUT $URL \
  -H "X-rs-id: $RSID" \
  -H "X-pass: $PASS" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "Content-Type: application/json" \
  -d '{"id_tt":"38","ruang":"ICU 01","jumlah_ruang":"0","jumlah":"1","terpakai":"0","terpakai_suspek":"0","terpakai_konfirmasi":"0","prepare":"0","prepare_plan":"0","covid":"0","antrian":"0"}'
