import {
  ERR_NO_NUMBERS,
  ERR_NO_SYMBOLS,
  ERR_TOO_LONG,
  validateSentence,
  ValidatorRuleError,
} from '../../core/sentences'
import * as E from 'fp-ts/Either'

describe('Ainu sentence validation', () => {
  const validate = (sentence: string) =>
    E.getOrElse((err: ValidatorRuleError) => err.errorType.toString())(
      validateSentence('ain')(sentence)
    )

  it('accepts Katakana with small katakana and ㇷ゚', () => {
    const sentence = 'イランカラㇷ゚テ'
    expect(validate(sentence)).toBe(sentence)
  })

  it('accepts Latin script with person markers', () => {
    expect(validate('ku=kor kotan')).toBe('ku=kor kotan')
  })

  it('normalizes to NFC', () => {
    expect(validate('ガ')).toBe('ガ')
  })

  it('rejects ASCII and full-width digits', () => {
    expect(validate('ku=kor 2')).toBe(ERR_NO_NUMBERS)
    expect(validate('アイヌ２')).toBe(ERR_NO_NUMBERS)
  })

  it('rejects full-width symbols', () => {
    expect(validate('アイヌ（イタㇰ）')).toBe(ERR_NO_SYMBOLS)
  })

  it('counts characters, not words, for Katakana', () => {
    expect(validate('ア'.repeat(126))).toBe(ERR_TOO_LONG)
    expect(validate('ア'.repeat(125))).toBe('ア'.repeat(125))
  })
})
