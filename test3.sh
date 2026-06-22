#!/bin/bash

RSID="1275888"
PASS="Rsmf@2026$"
URL="https://sirs.kemkes.go.id/fo/index.php/Fasyankes"
TIMESTAMP=$(date +%s)

echo "Testing PUT NEW ROOM JSON..."
curl -s -X PUT $URL \
  -H "X-rs-id: $RSID" \
  -H "X-pass: $PASS" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "Content-Type: application/json" \
  -d '{"id_tt":"5","ruang":"VIP_NEW_TEST_2","jumlah_ruang":"0","jumlah":"15","terpakai":"10","terpakai_suspek":"0","terpakai_konfirmasi":"0","prepare":"0","prepare_plan":"0","covid":"0","antrian":"0"}'
