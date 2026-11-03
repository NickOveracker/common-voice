// Locales whose missing messages should be taken from another locale before
// falling back to English. The Ainu interface is only partly translated, and
// its readers are more likely to read Japanese than English.
const FALLBACKS: { [locale: string]: string[] } = {
  ain: ['ja'],
}

export function withLocaleFallbacks(
  locales: ReadonlyArray<string>,
  availableLocales: ReadonlyArray<string>
): string[] {
  const result: string[] = []
  for (const locale of locales) {
    for (const candidate of [locale, ...(FALLBACKS[locale] ?? [])]) {
      if (availableLocales.includes(candidate) && !result.includes(candidate)) {
        result.push(candidate)
      }
    }
  }
  return result
}
