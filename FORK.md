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
| `server/src/infrastructure/storage/storage.ts` | `makePublic` does nothing with `CV_PRIVATE_STORAGE`; `CV_STORAGE_ENDPOINT` selects a GCS-compatible service instead of Google Cloud |
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

`admin`, `moderator` and `reviewer`, stored in `fork_user_roles` (admins can do everything, moderators can also review).
Emails in `CV_ADMIN_EMAILS` are always admins. API (signed-in users):

- `GET /api/v1/community/roles`: your own roles
- `GET /api/v1/community/admin/users`: users and their roles (admin)
- `PUT|DELETE /api/v1/community/admin/users/:clientId/roles/:role` (admin)

Admins give and remove roles on `/<locale>/admin`
(`web/src/fork/admin/admin-page.tsx`), linked from the home page. Members
only appear there once they have saved their profile.

On private instances the home page is the fork's own
(`web/src/fork/private-home.tsx`): the site name, a short introduction and
links to the community's pages. Upstream's home page promotes Mozilla's
datasets with photos of other communities.

## Speakers and recordings

`server/src/fork/stories/`, API under `/api/v1/community` (signed-in users):

- Speakers are the people recorded, separate from site accounts, so
  facilitators can record elders. Real names are only shown to whoever
  created the speaker, the speaker themselves, and moderators.
- Consent is recorded per speaker (archive, community use, research, speech
  technology; how and when it was given). It is never edited: changes add a
  new record, and withdrawal is marked on it. The latest record applies; if
  it was withdrawn, there is no consent (an older record does not come
  back). Recording a speaker needs current consent to archive.
- Dialects (`server/src/fork/stories/dialects.ts`, `fork_dialects`):
  speakers say what they speak, so anyone signed in adds a dialect without
  approval. A name that matches an existing entry, ignoring case, width and
  spacing, or a name merged into one, finds that entry instead. Admins
  rename entries and merge duplicates (`POST /dialects/:id/merge`): the
  speakers and recordings move, and the merged name stays as an alias.
  Speakers and recordings have dialects (`fork_speaker_dialects`,
  `fork_recording_dialects`); a new recording starts with its speakers'.
  The speaker's free-text field is now region only.
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
- Ainu segments have two transcriptions, one in Latin letters and one in
  katakana (Japanese passages within them written in Japanese), and a
  Japanese translation; Japanese-only segments have a Japanese
  transcription instead. Any segment can have an English translation. All
  are in `fork_transcripts`, by `kind`. Every save adds a version (`GET
  /segments/:id/transcripts?kind=` lists them). A save names the version it
  started from; if someone else saved since, it gets 409 and the other text,
  and saving again replaces it knowingly.
- Story prompts (`/<locale>/prompts`, `server/src/fork/stories/prompts.ts`,
  `fork_prompts`): topics and questions to tell stories about, in Japanese
  and optionally Ainu. Anyone signed in suggests them; moderators approve or
  reject them, and their own are approved at once. A recording can name the
  approved prompt it answers (`prompt_id`).
- Reports (`server/src/fork/stories/reports.ts`, `fork_reports`): anyone
  signed in can report a problem with a recording or one of its segments
  (consent, sensitive content, wrong details, audio, other). Moderators see
  open reports on `/<locale>/reports` and resolve them with a note; what to
  do about the recording is up to them.
- Reviewers (and moderators and admins) mark the current version of a
  text as checked or needing work, with an optional comment
  (`POST /transcripts/:id/reviews`, `fork_transcript_reviews`). Nobody
  reviews their own version, only the current version can be reviewed, and
  a new version starts unreviewed. The page shows each text's status and
  earlier versions (any of which can be restored and saved again), and can
  show only segments with text that isn't checked yet.
- The page plays a segment and stops at its end (or loops it), skips 5 s,
  and slows down to 0.5×. Esc plays or pauses the segment being typed in,
  except while an input method is composing.

## Storage

Audio and exports can be kept in Google Cloud Storage (`CV_STORAGE_ENDPOINT`
empty: browsers get short-lived signed links) or in a GCS-compatible service
on the server itself, such as fake-gcs-server with a filesystem backend
(`CV_STORAGE_ENDPOINT=http://storage:4443`). In the second case the app
streams files itself after its permission checks, with byte ranges for
seeking (`streamObject` in `server/src/fork/stories/storage.ts`), and the
storage service must not be reachable from outside.

On private instances upstream's scripted speech (reading sentences aloud,
checking clips, writing sentences, the dashboard) is hidden: this archive
doesn't use it, and its audio links assume Google Cloud.

## Deployment

`deploy/`: a Compose project for one server (app, MySQL, Redis, audio on the
server's disk, Keycloak, nightly database dumps), `setup.sh` for setup,
accounts and updates, and `README.md` for running it. The first instance runs
on `nickserv` behind Tailscale Serve. `scripts/fork-e2e/smoke.js` checks a
deployment over its real address.

## Exports

`server/src/fork/stories/export-builder.ts` and `exports.ts`; page
`/<locale>/exports` (admins only, linked from the home page).

- An export is for one purpose: archive, community use, research or speech
  technology. It includes a recording only if every one of its speakers
  currently consents to that purpose, so withdrawn consent leaves it out
  of later exports. Export again after consent changes: existing files are
  not updated.
- The zip holds `README.txt` (Japanese and English), `recordings.csv`,
  `speakers.csv` and `segments.csv` (UTF-8 with a byte order mark, for
  Excel), and optionally the original recordings (`audio/`) or a 16 kHz
  mono WAV clip per segment (`clips/`). Speakers are `S00001`, recordings
  `R00001`. Real names and notes are never included; display names only for
  the archive and community use. "Only checked" leaves out transcriptions
  and translations no reviewer has approved.
- Exports are built by the processing queue (`build-export`) into a
  temporary folder (originals are streamed to disk, see `downloadToFile`)
  and stored as `fork-exports/<id>.zip`. Every export stays on record in
  `fork_exports`; deleting one removes the file only.

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
