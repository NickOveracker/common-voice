import * as fs from 'fs'
import * as path from 'path'
import * as commonmark from 'commonmark'
import { getForkConfig } from './config'

const FALLBACK_LOCALES = ['en']

// Reads <name>.<locale>.md from CV_LEGAL_DOCS_DIR, e.g. privacy_notice.ja.md,
// falling back to English. Returns null when local documents are not
// configured, so the caller fetches Mozilla's instead.
export function readLocalLegalDocument(
  name: string,
  locale: string
): string | null {
  const { LEGAL_DOCS_DIR } = getForkConfig()
  if (!LEGAL_DOCS_DIR) return null

  // locale comes from the URL
  const candidates = [locale, ...FALLBACK_LOCALES].filter(candidate =>
    /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]+)*$/.test(candidate)
  )

  for (const candidate of candidates) {
    const filePath = path.join(LEGAL_DOCS_DIR, `${name}.${candidate}.md`)
    if (fs.existsSync(filePath)) {
      return new commonmark.HtmlRenderer().render(
        new commonmark.Parser().parse(fs.readFileSync(filePath, 'utf-8'))
      )
    }
  }

  return ''
}
