#!/usr/bin/env bash
#
# Grant organizer (admin) access to the attendee dashboard.
#
#   ./scripts/add-organizer.sh someone@example.com [password]
#
# Creates the Firebase Auth account if it does not exist, then writes the
# admins/<UID> document that firestore.rules checks.
#
# IMPORTANT: writing to `admins` from a client is only permitted while the
# project is still on open/test rules. Once firestore.rules is deployed,
# `admins` becomes write-protected on purpose — add later organizers through
# the Firebase console instead (Firestore -> admins -> Add document, with the
# UID as the document ID).

set -euo pipefail
cd "$(dirname "$0")/.."

EMAIL="${1:-}"
if [[ -z "$EMAIL" ]]; then
  echo "usage: $0 <email> [password]" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "error: .env not found. Copy .env.example and fill it in first." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; source .env; set +a
KEY="${VITE_FIREBASE_API_KEY:?VITE_FIREBASE_API_KEY missing from .env}"
PROJECT="${VITE_FIREBASE_PROJECT_ID:?VITE_FIREBASE_PROJECT_ID missing from .env}"

PASSWORD="${2:-}"
GENERATED=0
if [[ -z "$PASSWORD" ]]; then
  PASSWORD="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)"
  GENERATED=1
fi

api() {
  curl -sS -X POST "https://identitytoolkit.googleapis.com/v1/accounts:$1?key=$KEY" \
    -H 'Content-Type: application/json' -d "$2"
}

json() { python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('$1',''))"; }
err()  { python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error',{}).get('message',''))"; }

PAYLOAD=$(printf '{"email":"%s","password":"%s","returnSecureToken":true}' "$EMAIL" "$PASSWORD")

echo "==> Creating account for $EMAIL"
RESP=$(api signUp "$PAYLOAD")

if [[ "$(echo "$RESP" | err)" == "EMAIL_EXISTS" ]]; then
  echo "    Account already exists — signing in to read its UID."
  if [[ $GENERATED -eq 1 ]]; then
    echo "error: that account exists, so pass its existing password:" >&2
    echo "       $0 $EMAIL <existing-password>" >&2
    exit 1
  fi
  RESP=$(api signInWithPassword "$PAYLOAD")
fi

MESSAGE=$(echo "$RESP" | err)
if [[ -n "$MESSAGE" ]]; then
  echo "error: $MESSAGE" >&2
  exit 1
fi

UID_VALUE=$(echo "$RESP" | json localId)
TOKEN=$(echo "$RESP" | json idToken)
echo "    UID: $UID_VALUE"

echo "==> Writing admins/$UID_VALUE"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DOC=$(printf '{"fields":{"email":{"stringValue":"%s"},"addedAt":{"timestampValue":"%s"}}}' "$EMAIL" "$NOW")
WRITE=$(curl -sS -X PATCH \
  "https://firestore.googleapis.com/v1/projects/$PROJECT/databases/(default)/documents/admins/$UID_VALUE" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$DOC")

WRITE_ERROR=$(echo "$WRITE" | err)
if [[ -n "$WRITE_ERROR" ]]; then
  echo "error: could not write admins/$UID_VALUE — $WRITE_ERROR" >&2
  echo "       If firestore.rules is already deployed this is expected." >&2
  echo "       Add the document manually: Firestore -> admins -> document ID $UID_VALUE" >&2
  exit 1
fi

echo
echo "Done. $EMAIL can now sign in at /admin."
if [[ $GENERATED -eq 1 ]]; then
  echo "Temporary password: $PASSWORD"
  echo "Change it at Firebase console -> Authentication -> Users, or use 'Forgot password'."
fi
