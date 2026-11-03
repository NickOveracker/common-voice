import { getMySQLInstance } from '../lib/model/db/mysql'
import { VARIANTS, Variant } from '../lib/model/db/language-data/variants'
import { ACCENTS } from '../lib/model/db/language-data/accents'
import { getForkConfig } from './config'

// Replaces importLocales() (which syncs the locale list from Pontoon) when
// CV_LOCALES is set. Only the locales listed there are available, and
// nothing is fetched from outside.

type LocaleDefinition = {
  name: string
  english_name: string
  native_name: string
  text_direction: 'LTR' | 'RTL'
}

// Native names are placeholders until the community decides how the site
// should present them.
const LOCALE_DEFINITIONS: LocaleDefinition[] = [
  {
    name: 'en',
    english_name: 'English',
    native_name: 'English',
    text_direction: 'LTR',
  },
  {
    name: 'ja',
    english_name: 'Japanese',
    native_name: '日本語',
    text_direction: 'LTR',
  },
  {
    name: 'ain',
    english_name: 'Ainu',
    native_name: 'アイヌ イタㇰ',
    text_direction: 'LTR',
  },
]

// Variants (e.g. dialects) that are not part of upstream's list. Speakers pick
// one of these on their profile.
const FORK_VARIANTS: Variant[] = []

const DEFAULT_TARGET_SENTENCE_COUNT = 2000

const db = getMySQLInstance()

export async function importStaticLocales() {
  const { LOCALES, CONTRIBUTABLE_LOCALES } = getForkConfig()
  console.log('[LANG] Importing static languages:', LOCALES.join(','))

  const unknown = LOCALES.filter(
    name => !LOCALE_DEFINITIONS.some(locale => locale.name === name)
  )
  if (unknown.length > 0) {
    throw new Error(
      `[LANG] No definition in server/src/fork/locales.ts for: ${unknown}`
    )
  }

  for (const locale of LOCALE_DEFINITIONS) {
    if (!LOCALES.includes(locale.name)) continue

    await db.query(
      `
      INSERT INTO locales (name, target_sentence_count, english_name, native_name, is_contributable, is_translated, text_direction)
      VALUES (?)
      ON DUPLICATE KEY UPDATE
        english_name = VALUES(english_name),
        native_name = VALUES(native_name),
        is_contributable = VALUES(is_contributable),
        is_translated = VALUES(is_translated),
        text_direction = VALUES(text_direction)
      `,
      [
        [
          locale.name,
          DEFAULT_TARGET_SENTENCE_COUNT,
          locale.english_name,
          locale.native_name,
          CONTRIBUTABLE_LOCALES.includes(locale.name) ? 1 : 0,
          1,
          locale.text_direction,
        ],
      ]
    )
  }

  // Rows for other locales may exist (e.g. created by upstream migrations).
  // They are kept for referential integrity but hidden everywhere.
  await db.query(
    `UPDATE locales SET is_contributable = 0, is_translated = 0 WHERE name NOT IN (?)`,
    [LOCALES]
  )

  const [rows] = await db.query(
    `SELECT id, name FROM locales WHERE name IN (?)`,
    [LOCALES]
  )
  const localeIds: { [name: string]: number } = {}
  for (const row of rows) localeIds[row.name] = row.id

  for (const id of Object.values(localeIds)) {
    await db.query(
      `INSERT IGNORE INTO accents (locale_id, accent_name, accent_token, user_submitted) VALUES (?, "", "unspecified", 0)`,
      [id]
    )
  }

  for (const accent of ACCENTS) {
    const id = localeIds[accent.locale_name]
    if (!id) continue
    await db.query(
      `INSERT IGNORE INTO accents (locale_id, accent_name, accent_token) VALUES (?, ?, ?)`,
      [id, accent.accent_name, accent.accent_token]
    )
  }

  for (const variant of [...VARIANTS, ...FORK_VARIANTS]) {
    const id = localeIds[variant.locale_name]
    if (!id) continue
    await db.query(
      `INSERT IGNORE INTO variants (locale_id, variant_token, variant_name) VALUES (?, ?, ?)`,
      [id, variant.variant_token, variant.variant_name]
    )
  }

  console.log('[LANG] Importing static languages completed')
}
