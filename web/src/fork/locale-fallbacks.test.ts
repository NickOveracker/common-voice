import { withLocaleFallbacks } from './locale-fallbacks'

describe('withLocaleFallbacks', () => {
  it('falls back from Ainu to Japanese before English', () => {
    expect(withLocaleFallbacks(['ain', 'en'], ['en', 'ja', 'ain'])).toEqual([
      'ain',
      'ja',
      'en',
    ])
  })

  it('does not repeat locales', () => {
    expect(
      withLocaleFallbacks(['ain', 'ja', 'en'], ['en', 'ja', 'ain'])
    ).toEqual(['ain', 'ja', 'en'])
  })

  it('leaves other locales alone', () => {
    expect(withLocaleFallbacks(['ja', 'en'], ['en', 'ja', 'ain'])).toEqual([
      'ja',
      'en',
    ])
  })
})
