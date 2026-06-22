#!/bin/bash

RSID="1275888"
PASS="Rsmf@2026$"
URL="https://sirs.kemkes.go.id/fo/index.php/Fasyankes"
TIMESTAMP=$(date +%s)

echo "Testing PUT to /Fasyankes with id_t_tt in payload..."
curl -v -X PUT $URL \
  -H "X-rs-id: $RSID" \
  -H "X-pass: $PASS" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "Content-Type: application/json" \
  -d '{"id_t_tt":"30694927","id_tt":"38","ruang":"ICU 01","jumlah_ruang":"0","jumlah":"2","terpakai":"1","terpakai_suspek":"0","terpakai_konfirmasi":"0","prepare":"0","prepare_plan":"0","covid":"0","antrian":"0"}'
