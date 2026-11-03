# About this fork

This is a fork of [Mozilla Common Voice](https://github.com/common-voice/common-voice)
for a private voice repository hosted and managed by the Ainu community.
Interface languages are Ainu (`ain`), Japanese (`ja`) and English (`en`).

## Keeping up with upstream

The fork is built so that upstream changes can be merged regularly:

- Fork-specific code lives in its own files: `server/src/fork/`,
  `web/src/fork/`, `server/src/test/fork/` and the `fork-*.ftl` files.
- Upstream files are changed as little as possible, and every change is
  listed below.
- Features are switched on with settings (see `.env-private.example`). With
  none of them set, the server behaves like upstream.
- Unused languages and pages stay in the repository and are hidden at
  runtime, so upstream translation updates never conflict.
- Database changes only add new migrations and tables.

To merge:

```sh
git fetch upstream
git merge upstream/main
```

Conflicts should only happen in the files listed below. For `yarn.lock`,
take upstream's version and run `yarn install`.

Leave `CV_VERSION` unset so all pending migrations run, including upstream
migrations that are older than ours. Fork migrations are named
`*-fork-*.ts` and only create `fork_*` tables.

## Changes to upstream files

| File | Change |
|---|---|
| `server/src/server.ts` | Static locale import instead of Pontoon; configurable robots.txt; recording processing queue |
| `server/src/lib/model.ts` | Skip Pontoon translation statistics with static locales |
| `server/src/lib/api.ts` | `requireLoginMiddleware` and `disabledRoutesMiddleware` (Mozilla newsletter off with `CV_PRIVATE_INSTANCE`) after `authMiddleware`; `/community` router; only default avatars with `CV_PRIVATE_STORAGE` |
| `server/src/auth-router.ts` | Ignore anonymous (Basic auth) clients when login is required; only allow same-site `?redirect=` after sign-in |
| `server/src/infrastructure/storage/storage.ts` | `makePublic` does nothing with `CV_PRIVATE_STORAGE` |
| `server/src/infrastructure/authentication/authentication.ts` | Production URL from `CV_PUBLIC_URL` |
| `server/src/csp-header-value.ts` | Strict policy when `CV_STRICT_CSP` is set |
| `server/src/fetch-legal-document.ts` | Local documents from `CV_LEGAL_DOCS_DIR` |
| `server/src/lib/email.ts` | SMTP transport from `CV_SMTP_URL` |
| `server/src/core/sentences/types/validators.ts`, `validation/validation.ts` | Register the `ain` validator, NFC normalization for `ain` |
| `web/webpack.config.js` | `CV_PRIVATE_INSTANCE` picks `index_template.private.html` |
| `web/src/services/localization.ts` | Ainu falls back to Japanese before English |
| `web/src/services/tracker-ga4.ts` | Don't call `gtag` when analytics isn't loaded |
| `web/src/components/layout/non-production-banner.tsx` | Hidden on private instances |
| `web/src/main.ts` | Import `fork/fonts.css` |
| `web/src/components/layout/layout.tsx` | Sign-in gate around page content; private footer; `LanguageSelect` imported from `fork/header-language-select`; `Logo` imported from `fork/logo` (site name as plain text, also the page title) |
| `web/src/components/languages-provider.tsx` | URL locale and interface language kept apart via `fork/interface-locale` |
| `web/src/components/localization-select/language-select.tsx` | No "request a language" link on private instances |
| `web/src/services/api.ts` | Privacy/terms fetched in the interface language |
| `web/src/components/layout/content.tsx` | `privateInstanceRoutes()` first: own home page, hidden pages redirect home |
| `web/src/components/layout/nav/nav.tsx` | Menus filtered by `visibleMenuItems()` |
| `web/src/components/pages/profile/layout.tsx` | Avatar tab hidden on private instances |
| `web/src/components/pages/profile/delete/delete.tsx` | Deletion requests go to `CV_CONTACT_EMAIL` |
| `web/src/components/pages/profile/info/info.tsx` | On private instances: no Mozilla newsletter checkbox or gender blog link (`hiddenOnPrivateInstance`), the community's privacy and terms wording, no separate terms dialog. Always (bug fixes): an empty gender choice; no `client_id` sent for an existing account, which upstream's server refused while the browser id was still being claimed |
| `web/src/components/pages/profile/info/languages/languages.tsx` | No "request a language" link on private instances |
| `web/src/components/pages/profile/settings/settings.tsx` | Email change requests go to `CV_CONTACT_EMAIL` |

## Interface language and contribution language

Upstream uses the locale in the URL both for the interface and for the
language people contribute in. On private instances
(`web/src/fork/interface-locale.ts`):

- The URL locale is the contribution language, one of
  `CV_CONTRIBUTABLE_LOCALES` (e.g. `/ain/speak`).
- The interface language is a separate preference chosen in the header
  menu. It defaults to Japanese (English if the browser asks for it); Ainu is
  only used when picked.

## Community roles

`admin`, `moderator` and `transcriber`, stored in `fork_user_roles`.
Emails in `CV_ADMIN_EMAILS` are always admins. API (signed-in users):

- `GET /api/v1/community/roles`: your own roles
- `GET /api/v1/community/admin/users`: users and their roles (admin)
- `PUT|DELETE /api/v1/community/admin/users/:clientId/roles/:role` (admin)

## Speakers and recordings

`server/src/fork/stories/`, API under `/api/v1/community` (signed-in users):

- Speakers are the people recorded, separate from site accounts, so
  facilitators can record elders. Real names are only shown to whoever
  created the speaker, the speaker themselves, and moderators.
- Consent is recorded per speaker (archive, community use, research, speech
  technology; how and when it was given). It is never edited: changes add a
  new record, and withdrawal is marked on it. Recording a speaker needs
  current consent to archive.
- Recordings are uploaded in chunks of up to 8 MiB (`PUT
  /recordings/:id/chunks/:index`), which also makes uploads resumable. On
  `POST /recordings/:id/complete` a background job joins the chunks, keeps
  the result as the original, and makes an MP3 for playback (needs `ffmpeg`
  and `ffprobe`). Recording date can be a year, month or day; location is
  optional.

## Segments, transcription and translation

`server/src/fork/stories/segments.ts` and `segmentation.ts`; page
`web/src/fork/stories/recording-page.tsx` at `/<locale>/stories/<id>`.

- A recording is divided into consecutive segments with no gaps. After
  processing, ffmpeg finds pauses (`silencedetect`, with the threshold set
  12 dB below the recording's mean loudness so hissy tapes still work) and
  `planSegments()` cuts at the first pause after 3 s, or the longest one
  before 30 s. With a single speaker, segments start out as theirs.
  `POST /recordings/:id/segments/detect` starts over (only before anything
  is transcribed, by whoever manages the recording).
- Anyone signed in can split a segment, merge it with the next, move the
  boundary between them, and set its speaker and languages
  (`PATCH|POST /segments/:id…`). Edits to one recording are serialised by
  locking its row.
- Each segment has a transcription (with its writing: Latin, katakana or
  mixed), a Japanese translation and an optional English one, in
  `fork_transcripts`. Every save adds a version (`GET
  /segments/:id/transcripts?kind=` lists them). A save names the version it
  started from; if someone else saved since, it gets 409 and the other text,
  and saving again replaces it knowingly.
- The page plays a segment and stops at its end (or loops it), skips 5 s,
  and slows down to 0.5×. Esc plays or pauses the segment being typed in,
  except while an input method is composing.

## Tests

Fork unit tests run with the normal test suites. The integration test
(`server/src/test/fork/stories.integration.test.ts`) needs MySQL, Redis,
fake-gcs-server and ffmpeg, and a compiled server (db-migrate only runs
compiled migrations):

```sh
docker network create cvfork-test
docker run -d --name cvfork-db --network cvfork-test \
  -e MYSQL_ROOT_PASSWORD=voicewebroot -e MYSQL_USER=voicecommons \
  -e MYSQL_PASSWORD=voicecommons mysql:8.0.31
docker run -d --name cvfork-redis --network cvfork-test redis:alpine
docker run -d --name cvfork-storage --network cvfork-test \
  fsouza/fake-gcs-server -scheme http -port 8080 -backend memory
docker exec cvfork-db mysql -uroot -pvoicewebroot \
  -e "GRANT ALL ON \`fork_test_%\`.* TO 'voicecommons'@'%'"

# Stop cvfork-web first if the browser test left it running: its queue
# worker shares Redis and would take the test's jobs.
# in a Node 18 container with ffmpeg, on the cvfork-test network:
cd server && yarn build && \
CV_FORK_INTEGRATION=true CV_ENVIRONMENT=local CV_PROD=false \
CV_ADMIN_EMAILS=facilitator@example.org \
CV_MYSQLHOST=cvfork-db CV_DB_ROOT_PASS=voicewebroot \
CV_MYSQLDBNAME=fork_test_$(date +%s) CV_REDIS_URL=cvfork-redis \
CV_STORAGE_LOCAL_DEVELOPMENT_ENDPOINT=http://cvfork-storage:8080 \
npx jest --forceExit src/test/fork
```

### Browser test

`scripts/fork-e2e/run.sh` starts MySQL, Redis, fake-gcs-server and Keycloak
in docker, builds the app with `CV_PRIVATE_INSTANCE=true`, runs it with
login required and the strict CSP, and drives headless Chromium with a fake
microphone through `scripts/fork-e2e/e2e.js`: sign-in gate, Keycloak login,
Japanese interface on `/ain/` URLs, adding a speaker and consent, recording
with pause/resume, processing, playback, switching the interface to
English, and checking that no outside hosts are contacted. Run it after
merging upstream. `scripts/fork-e2e/run.sh --clean` removes the containers.

## Settings

See `.env-private.example`.

To hide an upstream element on private instances without re-indenting the
upstream file, swap its tag for `hiddenOnPrivateInstance(Component)` from
`web/src/fork/hidden-on-private-instance.ts`. The site name shown in the
header is the `fork-site-name` string in `fork.ftl`.
