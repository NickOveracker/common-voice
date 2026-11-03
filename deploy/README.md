# Running a private instance

One server, everything in Docker: the app, MySQL, Redis, audio storage on the
server's own disk (fake-gcs-server with a filesystem backend) and Keycloak for
sign-in. Only the app and Keycloak have ports, on `127.0.0.1`; Tailscale Serve
puts them on HTTPS, which browsers require for recording.

The first instance runs on `nickserv` (ZimaOS) in `/DATA/AppData/ainu-voice`:

| What | Where |
|---|---|
| The app | `https://nickserv.tail9014da.ts.net:8443` (port 18900 on the server) |
| Sign-in (Keycloak) | `https://nickserv.tail9014da.ts.net:10000` (port 18901) |
| Code | `/DATA/AppData/ainu-voice/src` |
| Settings and secrets | `src/deploy/.env` (readable only by its owner) |
| Database, audio, jobs | `src/deploy/data/` (`mysql`, `storage`, `redis`) |
| Nightly database dumps | `src/deploy/backups/` (last 14) |

Only devices on the tailnet can reach it (Tailscale Serve, not Funnel): each
pilot user installs Tailscale and is invited to the tailnet.

## First setup

```sh
cd src/deploy
./setup.sh          # creates .env with new secrets
# set CV_ADMIN_EMAILS and CV_CONTACT_EMAIL in .env, check the two URLs
./setup.sh          # builds, starts, sets up sign-in, prints the admin's
                    # temporary password
```

Then, on the server, put both on HTTPS (this leaves other Serve entries alone):

```sh
docker exec tailscale tailscale serve --bg --https=8443 http://127.0.0.1:18900
docker exec tailscale tailscale serve --bg --https=10000 http://127.0.0.1:18901
docker exec tailscale tailscale serve status
```

## Accounts

Nobody can register themselves. Add an account, then give its owner the
temporary password (they choose their own at first sign-in):

```sh
./setup.sh admin someone@example.org
```

Roles (reviewer, moderator, admin) are given in the app, on its admin page.
Keycloak's own console is at the sign-in URL under `/admin` (user `admin`,
password `KEYCLOAK_ADMIN_PASSWORD` in `.env`), for resetting passwords and
disabling accounts. Email isn't set up, so password resets are done there.

## Updating

From a clone of the repository, copy the code over (this never touches
`.env`, `data/` or `backups/`), then rebuild and restart:

```sh
rsync -az --delete --exclude node_modules --exclude .git --exclude web/dist \
  --exclude server/js --exclude server/data --exclude '*.log' \
  --exclude deploy/.env --exclude deploy/.docker --exclude deploy/data \
  --exclude deploy/backups ./ nickserv:/DATA/AppData/ainu-voice/src/
ssh nickserv 'cd /DATA/AppData/ainu-voice/src/deploy && ./setup.sh'
```

Database changes are applied when the app starts.

## Backups

- The databases (the archive's and Keycloak's) are dumped every night into
  `backups/`.
- The audio is in `data/storage/`. It is only on this one disk: copy
  `data/storage/` and `backups/` to another disk or machine regularly.
  Without that, a failed disk loses the archive.

To restore a database dump:

```sh
gunzip -c backups/voiceweb-DATE.sql.gz | \
  docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" voiceweb'
```

## Checking a deployment

`scripts/fork-e2e/smoke.js` signs in with a throwaway account, records from a
fake microphone over the real HTTPS address, waits for processing and seeks
in the audio. Run it on the server (the address resolves to the server's own
tailnet IP there), then delete the account and what it made:

```sh
docker run --rm --network host \
  --add-host nickserv.tail9014da.ts.net:100.72.219.47 \
  -v "$PWD/../scripts/fork-e2e:/e2e" -w /e2e \
  -e BASE=https://nickserv.tail9014da.ts.net:8443 \
  -e SIGNIN_USER=… -e SIGNIN_PASSWORD=… \
  mcr.microsoft.com/playwright:v1.48.2-jammy \
  bash -c 'npm init -y >/dev/null && npm i --silent playwright@1.48.2 && node smoke.js'
```

## If database changes fail

Upstream records in Redis that its maintenance (database changes) ran even
when it failed, and then skips it on later starts. After fixing the cause:

```sh
docker compose exec redis redis-cli del maintenance-version
docker compose restart app
docker compose logs app | grep maintenance    # "Maintenance complete"
```

## Everyday commands

```sh
docker compose ps                 # what is running
docker compose logs -f app        # the app's log
docker compose restart app
docker compose down               # stop everything (data stays)
```

## Before a pilot with real recordings

- Replace the placeholder documents in `legal/` (terms and privacy notice, in
  Japanese and English) with the community's own.
- Have a native speaker review the Japanese, the consent wording above all.
- Agree what moderators do when a speaker withdraws consent.
- Set up the off-machine backup described above.
