#!/bin/bash

RSID="1275888"
PASS="Rsmf@2026$"
URL="https://sirs.kemkes.go.id/fo/index.php/Fasyankes"
TIMESTAMP=$(date +%s)

curl -s -X GET $URL \
  -H "X-rs-id: $RSID" \
  -H "X-pass: $PASS" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "Content-Type: application/json"
