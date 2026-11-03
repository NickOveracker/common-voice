import {
  ERR_NO_ABBREVIATIONS,
  ERR_NO_NUMBERS,
  ERR_NO_SYMBOLS,
  ERR_TOO_LONG,
  ValidatorRule,
} from '../../types'

// Ainu is written in both Latin script and Katakana (including the small
// katakana U+31F0–U+31FF, and ㇷ゚ written as U+31F7 U+309A). Katakana text has
// no spaces, so length is counted in characters rather than words.

const TRANSLATION_KEY_PREFIX = 'TRANSLATION_KEY:'

// Minimum of characters that qualify as a sentence.
const MIN_LENGTH = 1

// Maximum of characters allowed per sentence to keep recordings in a manageable duration.
const MAX_LENGTH = 125

const INVALIDATIONS: ValidatorRule[] = [
  {
    type: 'fn',
    fn: (sentence: string) => {
      // Count code points, not UTF-16 units
      const length = Array.from(sentence.trim()).length
      return length < MIN_LENGTH || length > MAX_LENGTH
    },
    error: `文字数は ${MIN_LENGTH}〜${MAX_LENGTH} 文字にしてください (${MIN_LENGTH}–${MAX_LENGTH} characters)`,
    errorType: ERR_TOO_LONG,
  },
  {
    // ASCII and full-width digits
    type: 'regex',
    regex: /[0-9０-９]+/,
    error: `${TRANSLATION_KEY_PREFIX}sc-validation-no-numbers`,
    errorType: ERR_NO_NUMBERS,
  },
  {
    // Same as the default rule plus full-width forms. "=" is allowed, as it
    // marks person affixes in Latin script (e.g. ku=, a=).
    type: 'regex',
    regex: /[<>+*#@%^[\]()/＜＞＋＊＃＠％＾［］（）／]/,
    error: `${TRANSLATION_KEY_PREFIX}sc-validation-no-symbols`,
    errorType: ERR_NO_SYMBOLS,
  },
  {
    type: 'regex',
    regex: /[A-Z]{2,}|[A-Z]+\.*[A-Z]+/,
    error: `${TRANSLATION_KEY_PREFIX}sc-validation-no-abbreviations`,
    errorType: ERR_NO_ABBREVIATIONS,
  },
]

export default INVALIDATIONS
