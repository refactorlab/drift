#!/usr/bin/env bash
# Exchange a Chrome Web Store OAuth authorization CODE for a refresh token, then
# write it back to drift-chrome-extension/.env as CWS_REFRESH_TOKEN. Reads
# CWS_CLIENT_ID / CWS_CLIENT_SECRET from that same .env (env vars win if set).
#
# Why this exists: the OAuth Playground's built-in "Exchange" step is flaky with
# user credentials (invalid_client) and Google killed the old oob copy-paste
# flow — so we do the token exchange directly with curl, which is deterministic.
#
# Usage (from repo root):
#   make extension-cws-exchange CODE='4/0A...'
#   # If you minted the CODE via the http://localhost loopback flow instead of
#   # the OAuth Playground, pass the matching redirect (it MUST equal the one
#   # used to OBTAIN the code, or Google returns invalid_grant):
#   make extension-cws-exchange CODE='4/0A...' CWS_REDIRECT_URI='http://localhost'
#
# Auth codes are single-use and expire in ~1 minute — run this IMMEDIATELY after
# minting the code. .env is gitignored, so writing the token there is safe.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # drift-chrome-extension/
ENV_FILE="${DIR}/.env"
# Default to the Playground redirect (where most codes are minted here);
# override with CWS_REDIRECT_URI for the loopback (curl) flow.
REDIRECT_URI="${CWS_REDIRECT_URI:-https://developers.google.com/oauthplayground}"

if [ -z "${CODE:-}" ]; then
  echo "✗ CODE is required.  Usage: make extension-cws-exchange CODE='4/0A...'" >&2
  exit 2
fi

# Load creds from .env without clobbering anything already in the environment.
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi
: "${CWS_CLIENT_ID:?CWS_CLIENT_ID missing — add it to drift-chrome-extension/.env}"
: "${CWS_CLIENT_SECRET:?CWS_CLIENT_SECRET missing — add it to drift-chrome-extension/.env}"

# Guard the classic ID/secret swap (the #1 cause of invalid_client here):
#   a Client ID always ends in .apps.googleusercontent.com; a secret starts GOCSPX-.
case "$CWS_CLIENT_ID" in
  GOCSPX-*) echo "✗ CWS_CLIENT_ID looks like a SECRET (starts GOCSPX-) — ID and secret are SWAPPED in .env." >&2; exit 1 ;;
esac
case "$CWS_CLIENT_SECRET" in
  *.apps.googleusercontent.com) echo "✗ CWS_CLIENT_SECRET looks like an ID (ends .apps.googleusercontent.com) — ID and secret are SWAPPED in .env." >&2; exit 1 ;;
esac

echo "▶ exchanging authorization code (redirect_uri=${REDIRECT_URI}) ..."
resp="$(curl -sS https://oauth2.googleapis.com/token \
  -d client_id="$CWS_CLIENT_ID" \
  -d client_secret="$CWS_CLIENT_SECRET" \
  -d code="$CODE" \
  -d grant_type=authorization_code \
  -d redirect_uri="$REDIRECT_URI")"

# Parse with node (always present in this repo) — no jq dependency.
refresh="$(printf '%s' "$resp" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).refresh_token||"")}catch(_){}})' 2>/dev/null || true)"

if [ -z "$refresh" ]; then
  echo "✗ No refresh_token in Google's response:" >&2
  printf '%s\n' "$resp" >&2
  cat >&2 <<'EOF'

Likely causes:
  • invalid_grant  → the code expired (single-use, ~1 min) or was already used.
                     Mint a FRESH code and re-run immediately.
  • invalid_grant  → redirect_uri mismatch. It MUST equal the one used to mint
                     the code:  Playground → https://developers.google.com/oauthplayground
                     (default), loopback → re-run with CWS_REDIRECT_URI=http://localhost
  • invalid_client → CWS_CLIENT_ID/SECRET wrong or swapped in .env.
  • access_denied at consent → publish the OAuth consent screen to production,
                     or add your Google account under Test users.
EOF
  exit 1
fi

echo "✅ refresh_token obtained."

# Persist to .env (gitignored). Replace an existing CWS_REFRESH_TOKEN line in
# place, else append. awk passes the token via -v so its '/' chars are literal.
if [ -f "$ENV_FILE" ] && grep -q '^CWS_REFRESH_TOKEN=' "$ENV_FILE"; then
  tmp="$(mktemp)"
  awk -v t="$refresh" '/^CWS_REFRESH_TOKEN=/{print "CWS_REFRESH_TOKEN=" t; next} {print}' "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
  echo "   updated CWS_REFRESH_TOKEN in ${ENV_FILE}"
elif [ -f "$ENV_FILE" ]; then
  printf 'CWS_REFRESH_TOKEN=%s\n' "$refresh" >> "$ENV_FILE"
  echo "   appended CWS_REFRESH_TOKEN to ${ENV_FILE}"
fi

cat <<EOF

Now paste this into the GitHub repo secret CWS_REFRESH_TOKEN
(Settings → Secrets and variables → Actions → CWS_REFRESH_TOKEN):

${refresh}
EOF
