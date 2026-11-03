#!/usr/bin/env bash
# Full-stack browser test of a private instance (see FORK.md):
# MySQL, Redis, fake-gcs-server, Keycloak, the app built with
# CV_PRIVATE_INSTANCE=true, and headless Chromium with a fake microphone.
#
#   scripts/fork-e2e/run.sh          set up (if needed), build, test
#   scripts/fork-e2e/run.sh --clean  remove the containers and network
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
NET=cvfork-test
NODE_IMAGE=cvfork-node
PLAYWRIGHT_IMAGE=mcr.microsoft.com/playwright:v1.48.2-jammy
USER_ARGS=(-u "$(id -u):$(id -g)" -e HOME=/tmp)

if [[ "${1:-}" == "--clean" ]]; then
  docker rm -f cvfork-web cvfork-keycloak cvfork-storage cvfork-redis cvfork-db 2>/dev/null || true
  docker network rm "$NET" 2>/dev/null || true
  exit 0
fi

running() { docker ps --format '{{.Names}}' | grep -qx "$1"; }

docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null

if ! docker image inspect "$NODE_IMAGE" >/dev/null 2>&1; then
  printf 'FROM node:18-bookworm\nRUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*\n' |
    docker build -q -t "$NODE_IMAGE" -
fi

running cvfork-db || docker run -d --name cvfork-db --network "$NET" \
  -e MYSQL_ROOT_PASSWORD=voicewebroot -e MYSQL_USER=voicecommons \
  -e MYSQL_PASSWORD=voicecommons -e MYSQL_DATABASE=voiceweb mysql:8.0.31 \
  --sql_mode="STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION" >/dev/null
running cvfork-redis || docker run -d --name cvfork-redis --network "$NET" redis:alpine >/dev/null
running cvfork-storage || docker run -d --name cvfork-storage --network "$NET" \
  fsouza/fake-gcs-server -scheme http -port 8080 \
  -external-url http://cvfork-storage:8080 -backend memory >/dev/null

if ! running cvfork-keycloak; then
  docker run -d --name cvfork-keycloak --network "$NET" \
    -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
    quay.io/keycloak/keycloak:26.0 start-dev --http-port 8080 >/dev/null
  K=(docker exec cvfork-keycloak /opt/keycloak/bin/kcadm.sh)
  until "${K[@]}" config credentials --server http://localhost:8080 --realm master \
    --user admin --password admin >/dev/null 2>&1; do sleep 2; done
  "${K[@]}" create realms -s realm=voice -s enabled=true
  "${K[@]}" create clients -r voice -s clientId=cv -s enabled=true -s publicClient=false \
    -s secret=cvsecret -s 'redirectUris=["http://localhost:9000/callback"]' -s standardFlowEnabled=true
  "${K[@]}" create users -r voice -s username=facilitator -s email=facilitator@example.org \
    -s emailVerified=true -s enabled=true -s firstName=Test -s lastName=Facilitator
  "${K[@]}" set-password -r voice --username facilitator --new-password test1234
fi

until docker exec cvfork-db mysqladmin ping -uroot -pvoicewebroot --silent 2>/dev/null; do sleep 2; done
docker exec cvfork-db mysql -uroot -pvoicewebroot \
  -e "GRANT ALL ON \`fork_test_%\`.* TO 'voicecommons'@'%'" 2>/dev/null
docker run --rm --network "$NET" curlimages/curl -s -X POST \
  -H 'Content-Type: application/json' -d '{"name":"common-voice-clips"}' \
  http://cvfork-storage:8080/storage/v1/b >/dev/null || true

echo "Building the app in private mode..."
docker run --rm "${USER_ARGS[@]}" -e CV_PRIVATE_INSTANCE=true \
  -e CV_CONTACT_EMAIL=voice@example.org -v "$REPO":/code -w /code "$NODE_IMAGE" \
  bash -c "yarn --frozen-lockfile --ignore-scripts >/dev/null && yarn build >/dev/null"

docker rm -f cvfork-web >/dev/null 2>&1 || true
docker run -d --name cvfork-web --network "$NET" "${USER_ARGS[@]}" -v "$REPO":/code -w /code \
  -e CV_ENVIRONMENT=local -e CV_PROD=false -e CV_IMPORT_SENTENCES=false \
  -e CV_MYSQLHOST=cvfork-db -e CV_DB_ROOT_PASS=voicewebroot -e CV_MYSQLDBNAME=voiceweb \
  -e CV_REDIS_URL=cvfork-redis \
  -e CV_STORAGE_LOCAL_DEVELOPMENT_ENDPOINT=http://cvfork-storage:8080 \
  -e CV_STORAGE_ORIGIN=http://cvfork-storage:8080 \
  -e CV_FXA_DOMAIN=http://cvfork-keycloak:8080/realms/voice \
  -e CV_FXA_CLIENT_ID=cv -e CV_FXA_CLIENT_SECRET=cvsecret \
  -e CV_SECRET="e2e-$(openssl rand -hex 16)" -e CV_JWT_KEY="e2e-$(openssl rand -hex 16)" \
  -e CV_LOCALES=en,ja,ain -e CV_CONTRIBUTABLE_LOCALES=ain \
  -e CV_REQUIRE_LOGIN=true -e CV_ROBOTS_DISALLOW_ALL=true \
  -e CV_STRICT_CSP=true -e CV_PRIVATE_STORAGE=true -e CV_PRIVATE_INSTANCE=true \
  -e CV_ADMIN_EMAILS=facilitator@example.org \
  "$NODE_IMAGE" node server/js/main.js >/dev/null
until docker logs cvfork-web 2>&1 | grep -q "Maintenance complete"; do
  if docker logs cvfork-web 2>&1 | grep -q "Maintenance error"; then
    docker logs cvfork-web | tail -30; exit 1
  fi
  sleep 2
done

WORK="$(mktemp -d)"
cp "$REPO/scripts/fork-e2e/e2e.js" "$WORK/"
mkdir -p "$WORK/shots"
docker run --rm --network container:cvfork-web "${USER_ARGS[@]}" -v "$WORK":/e2e -w /e2e \
  "$PLAYWRIGHT_IMAGE" bash -c \
  "npm init -y >/dev/null && npm install --silent playwright@1.48.2 >/dev/null && node e2e.js /e2e/shots"
echo "Screenshots: $WORK/shots"
