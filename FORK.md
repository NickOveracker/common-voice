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
| `server/src/server.ts` | Static locale import instead of Pontoon; configurable robots.txt |
| `server/src/lib/model.ts` | Skip Pontoon translation statistics with static locales |
| `server/src/lib/api.ts` | `requireLoginMiddleware` after `authMiddleware`; `/community` router; only default avatars with `CV_PRIVATE_STORAGE` |
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
| `web/src/components/layout/layout.tsx` | Sign-in gate around page content; private footer |
| `web/src/components/layout/content.tsx` | `privateInstanceRoutes()` first: own home page, hidden pages redirect home |
| `web/src/components/layout/nav/nav.tsx` | Menus filtered by `visibleMenuItems()` |
| `web/src/components/pages/profile/layout.tsx` | Avatar tab hidden on private instances |
| `web/src/components/pages/profile/delete/delete.tsx` | Deletion requests go to `CV_CONTACT_EMAIL` |

## Community roles

`admin`, `moderator` and `transcriber`, stored in `fork_user_roles`.
Emails in `CV_ADMIN_EMAILS` are always admins. API (signed-in users):

- `GET /api/v1/community/roles`: your own roles
- `GET /api/v1/community/admin/users`: users and their roles (admin)
- `PUT|DELETE /api/v1/community/admin/users/:clientId/roles/:role` (admin)

## Settings

See `.env-private.example`.
