// Settings for self-hosted, private deployments.
//
// Everything specific to this fork is configured here instead of in
// config-helper.ts, so that merging upstream changes stays painless.
// With none of these variables set, the server behaves like upstream.

// Loads the dotenv file before process.env is read below.
import '../config-helper'

const castBoolean = (value: string): boolean => value === 'true'
const castList = (value: string): string[] =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

const castString = (value: string): string => value
const configEntry = <T>(
  key: string,
  defaultValue: T,
  cast: (value: string) => T
): T => (process.env[key] ? cast(process.env[key]) : defaultValue)

export type ForkConfig = {
  // Locales the site knows about. When set, the locale table is managed from
  // server/src/fork/locales.ts instead of being imported from Pontoon.
  LOCALES: string[]
  // Subset of LOCALES that people can contribute recordings in.
  CONTRIBUTABLE_LOCALES: string[]
  // Reject anonymous clients: every protected route needs a logged in user.
  REQUIRE_LOGIN: boolean
  // Ask search engines not to index anything.
  ROBOTS_DISALLOW_ALL: boolean
  // Serve privacy/terms documents from this directory instead of fetching
  // Mozilla's from GitHub. Files are named <document>.<locale>.md
  LEGAL_DOCS_DIR: string
  // Use a minimal Content-Security-Policy that only allows our own origin
  // and the audio storage origin.
  STRICT_CSP: boolean
  // Origin audio files are served from, e.g. https://storage.example.org
  STORAGE_ORIGIN: string
  // Never make stored files publicly readable. Profile pictures are limited
  // to the default avatars, and bulk submission emails link to files that
  // need storage credentials to open.
  PRIVATE_STORAGE: boolean
  // Public URL of this site, e.g. https://voice.example.org
  PUBLIC_URL: string
  // Send email through this SMTP server instead of AWS SES (or, outside
  // production, the ethereal.email test service), e.g.
  // smtps://user:password@mail.example.org:465
  SMTP_URL: string
  // Largest recording that can be uploaded, in bytes.
  RECORDING_MAX_BYTES: number
  // Turn off upstream features that send people's data to Mozilla's
  // services, such as the newsletter sign-up. The web build reads the same
  // variable.
  PRIVATE_INSTANCE: boolean
}

let forkConfig: ForkConfig

export function getForkConfig(): ForkConfig {
  if (!forkConfig) {
    const locales = configEntry<string[]>('CV_LOCALES', [], castList)
    forkConfig = {
      LOCALES: locales,
      CONTRIBUTABLE_LOCALES: configEntry(
        'CV_CONTRIBUTABLE_LOCALES',
        locales,
        castList
      ),
      REQUIRE_LOGIN: configEntry('CV_REQUIRE_LOGIN', false, castBoolean),
      ROBOTS_DISALLOW_ALL: configEntry(
        'CV_ROBOTS_DISALLOW_ALL',
        false,
        castBoolean
      ),
      LEGAL_DOCS_DIR: configEntry('CV_LEGAL_DOCS_DIR', '', castString),
      STRICT_CSP: configEntry('CV_STRICT_CSP', false, castBoolean),
      STORAGE_ORIGIN: configEntry('CV_STORAGE_ORIGIN', '', castString),
      PRIVATE_STORAGE: configEntry('CV_PRIVATE_STORAGE', false, castBoolean),
      PUBLIC_URL: configEntry('CV_PUBLIC_URL', '', castString),
      SMTP_URL: configEntry('CV_SMTP_URL', '', castString),
      PRIVATE_INSTANCE: configEntry('CV_PRIVATE_INSTANCE', false, castBoolean),
      RECORDING_MAX_BYTES: configEntry(
        'CV_RECORDING_MAX_BYTES',
        4 * 1024 ** 3,
        Number
      ),
    }
  }
  return forkConfig
}

export function usesStaticLocales(): boolean {
  return getForkConfig().LOCALES.length > 0
}
