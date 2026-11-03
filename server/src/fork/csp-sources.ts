import { getForkConfig } from './config'

// Content-Security-Policy sources for private deployments: no analytics,
// donation widgets, web fonts or error reporting, only our own origin and the
// origin audio is served from.
export function getStrictCSPSources(): { [directive: string]: string[] } {
  const { STORAGE_ORIGIN } = getForkConfig()
  const storage = STORAGE_ORIGIN ? [STORAGE_ORIGIN] : []

  return {
    'default-src': ["'none'"],
    'child-src': ["'self'", 'blob:'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...storage],
    'media-src': ["'self'", 'data:', 'blob:', ...storage],
    'script-src': ["'self'"],
    'font-src': ["'self'"],
    'connect-src': ["'self'", 'blob:', ...storage],
    'frame-src': ["'none'"],
  }
}
