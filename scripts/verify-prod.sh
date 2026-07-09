#!/usr/bin/env bash
# Verify that orders AND site-content edits survive across serverless instances
# on the LIVE deployment. See docs/PRODUCTION-DB.md.
#
#   SITE_URL=https://your-domain ADMIN_PASSWORD=... bash scripts/verify-prod.sh write
#   # ...force a fresh instance (redeploy or wait)...
#   SITE_URL=https://your-domain ADMIN_PASSWORD=... bash scripts/verify-prod.sh read
set -euo pipefail

MODE="${1:-}"
: "${SITE_URL:?set SITE_URL, e.g. https://jnballoons.co.uk}"
: "${ADMIN_PASSWORD:?set ADMIN_PASSWORD}"
JAR="$(mktemp)"; MARKERFILE=".verify-marker"

login() {
  curl -s -c "$JAR" -X POST "$SITE_URL/api/admin/login" \
    -H 'Content-Type: application/json' -H "Origin: $SITE_URL" \
    -d "{\"password\":\"$ADMIN_PASSWORD\"}" -o /dev/null -w '%{http_code}'
}

if [ "$MODE" = "write" ]; then
  [ "$(login)" = "200" ] || { echo "FAIL: admin login (check ADMIN_PASSWORD)"; exit 1; }
  MARKER="verify-$(date +%s)"
  echo "$MARKER" > "$MARKERFILE"

  # Edit content: rename gallery[0] to the marker.
  STORE="$(curl -s -b "$JAR" "$SITE_URL/api/admin/store")"
  echo "$STORE" | node -e "
    let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
      const s=JSON.parse(d).store; s.gallery[0].title='$MARKER';
      require('fs').writeFileSync('.verify-post.json', JSON.stringify({store:s}));
    });"
  curl -s -b "$JAR" -X POST "$SITE_URL/api/admin/store" \
    -H 'Content-Type: application/json' -H "Origin: $SITE_URL" \
    --data-binary @.verify-post.json -o /dev/null -w 'content save: %{http_code}\n'
  rm -f .verify-post.json

  # Create a test enquiry (no card charge; works even before BOOKINGS_LIVE).
  curl -s -X POST "$SITE_URL/api/booking" \
    -H 'Content-Type: application/json' -H "Origin: $SITE_URL" \
    -d "{\"kind\":\"custom\",\"custName\":\"$MARKER\",\"custContact\":\"verify@example.com\"}" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log('booking:',JSON.parse(d).message||JSON.parse(d).error))"

  echo "WROTE marker $MARKER. Now force a fresh instance (redeploy or wait), then run: read"
  exit 0
fi

if [ "$MODE" = "read" ]; then
  [ -f "$MARKERFILE" ] || { echo "no marker — run 'write' first"; exit 1; }
  MARKER="$(cat "$MARKERFILE")"
  [ "$(login)" = "200" ] || { echo "FAIL: admin login"; exit 1; }

  HTML="$(curl -s "$SITE_URL/?cachebust=$RANDOM")"
  echo "$HTML" | grep -q "$MARKER" && echo "PASS: content edit ($MARKER) survived on the live homepage" \
    || { echo "FAIL: content edit did NOT survive"; exit 1; }

  STORE="$(curl -s -b "$JAR" "$SITE_URL/api/admin/store")"
  echo "$STORE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
    const s=JSON.parse(d).store;
    const found=s.orders.some(o=>o.customer&&o.customer.includes('$MARKER'));
    console.log(found?'PASS: test order survived across the fresh instance':'FAIL: test order missing');
    process.exit(found?0:1);
  })"
  echo "Verification complete. Delete the test order + rename the gallery item back in /admin."
  exit 0
fi

echo "usage: SITE_URL=.. ADMIN_PASSWORD=.. bash scripts/verify-prod.sh write|read"; exit 2
