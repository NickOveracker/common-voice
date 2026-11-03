#!/usr/bin/env bash
# First-time setup and updates of a private instance (see README.md).
#
#   ./setup.sh             build and start everything; on the first run,
#                          generate secrets and set up sign-in
#   ./setup.sh admin EMAIL add a sign-in account (prints a temporary password)
#
# Run from this folder. Needs Docker with Compose.
set -euo pipefail
cd "$(dirname "$0")"

# ZimaOS keeps the home folder's Docker config unreadable; use our own
export DOCKER_CONFIG="${DOCKER_CONFIG:-$PWD/.docker}"
mkdir -p "$DOCKER_CONFIG"

compose() { docker compose "$@"; }
secret() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40; }
setting() { grep -E "^$1=" .env | cut -d= -f2-; }

kcadm() {
  compose exec -T keycloak /opt/keycloak/bin/kcadm.sh "$@"
}

keycloak_login() {
  kcadm config credentials --server http://localhost:8080 --realm master \
    --user admin --password "$(setting KEYCLOAK_ADMIN_PASSWORD)" >/dev/null
}

add_account() {
  local email="$1"
  local password
  password="$(secret | head -c 16)"
  keycloak_login
  kcadm create users -r voice -s "username=$email" -s "email=$email" \
    -s emailVerified=true -s enabled=true >/dev/null
  kcadm set-password -r voice --username "$email" --new-password "$password" \
    --temporary
  echo "Account $email: temporary password $password (changed at first sign-in)"
}

if [[ "${1:-}" == "admin" ]]; then
  add_account "${2:?usage: ./setup.sh admin EMAIL}"
  exit 0
fi

first_run=false
if [[ ! -f .env ]]; then
  first_run=true
  cp env.example .env
  chmod 600 .env
  for key in CV_DB_ROOT_PASS CV_MYSQLPASS KEYCLOAK_DB_PASSWORD \
    KEYCLOAK_ADMIN_PASSWORD CV_SECRET CV_JWT_KEY CV_FXA_CLIENT_SECRET; do
    sed -i "s|^$key=$|$key=$(secret)|" .env
  done
  echo "Created .env with new secrets. Set CV_ADMIN_EMAILS and CV_CONTACT_EMAIL"
  echo "in it, then run ./setup.sh again."
  exit 0
fi

for key in CV_ADMIN_EMAILS CV_CONTACT_EMAIL CV_PUBLIC_URL KEYCLOAK_PUBLIC_URL; do
  if [[ -z "$(setting $key)" ]]; then
    echo "Set $key in .env first." >&2
    exit 1
  fi
done

# Storage buckets are folders for fake-gcs-server's filesystem backend
mkdir -p data/mysql data/redis backups \
  data/storage/common-voice-clips data/storage/common-voice-datasets

compose build app
compose up -d db redis storage keycloak

echo "Waiting for Keycloak..."
until [[ "$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q keycloak)")" == healthy ]]; do
  sleep 5
done
keycloak_login

if ! kcadm get realms/voice >/dev/null 2>&1; then
  echo "Setting up sign-in (realm 'voice')..."
  # Accounts are made by admins; the login pages are in Japanese first
  kcadm create realms -s realm=voice -s enabled=true \
    -s registrationAllowed=false -s resetPasswordAllowed=false \
    -s loginWithEmailAllowed=true -s duplicateEmailsAllowed=false \
    -s internationalizationEnabled=true \
    -s 'supportedLocales=["ja","en"]' -s defaultLocale=ja \
    -s 'displayName=アイヌ語音声アーカイブ'
  # Don't stop every new account to ask for a first and family name: the
  # app has its own profile
  kcadm update authentication/required-actions/VERIFY_PROFILE -r voice \
    -s enabled=false
  kcadm create clients -r voice \
    -s "clientId=$(setting CV_FXA_CLIENT_ID)" -s enabled=true \
    -s publicClient=false -s "secret=$(setting CV_FXA_CLIENT_SECRET)" \
    -s standardFlowEnabled=true -s directAccessGrantsEnabled=false \
    -s "redirectUris=[\"$(setting CV_PUBLIC_URL)/callback\"]" \
    -s "webOrigins=[\"$(setting CV_PUBLIC_URL)\"]" \
    -s "attributes.\"post.logout.redirect.uris\"=$(setting CV_PUBLIC_URL)/*" >/dev/null
  IFS=, read -ra admins <<<"$(setting CV_ADMIN_EMAILS)"
  for email in "${admins[@]}"; do
    # Trimmed with tr: ZimaOS has no xargs
    add_account "$(echo "$email" | tr -d '[:space:]')"
  done
fi

compose up -d
echo "Started. Logs: docker compose logs -f app"
