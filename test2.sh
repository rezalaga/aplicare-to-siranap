#!/bin/bash

RSID="1275888"
PASS="Rsmf@2026$"
URL="https://sirs.kemkes.go.id/fo/poliklinik/get_tt_siranap/$RSID"
TIMESTAMP=$(date +%s)

curl -s -X GET $URL \
  -H "X-rs-id: $RSID" \
  -H "X-pass: $PASS" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "Content-Type: application/json"
