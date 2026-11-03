import { safeRedirect } from '../../fork/safe-redirect'

describe('safeRedirect', () => {
  it('keeps paths on this site', () => {
    expect(safeRedirect('/ain/speak')).toBe('/ain/speak')
    expect(safeRedirect('/profile/info?x=1')).toBe('/profile/info?x=1')
  })

  it('drops other hosts', () => {
    for (const redirect of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      '',
      undefined,
      ['/a'],
    ]) {
      expect(safeRedirect(redirect)).toBeNull()
    }
  })
})
