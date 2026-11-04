import * as React from 'react'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { negotiateLanguages } = require('@fluent/langneg')

import * as Languages from '../stores/languages'
import { DEFAULT_LOCALE } from '../services/localization'
import { IS_PRIVATE_INSTANCE } from './config'

// Upstream uses the locale in the URL both as the interface language and as
// the language people contribute in. On private instances the two are
// separate:
//
// - The URL locale (and the redux `locale`) is the contribution language,
//   always one of the contributable locales. Upstream contribution code keeps
//   working unchanged.
// - The interface language is a separate preference, kept in localStorage.
//   It defaults to Japanese, which all community members read.

const DEFAULT_INTERFACE_LOCALE = 'ja'
// Only offered automatically to browsers that ask for it.
const NEGOTIABLE_INTERFACE_LOCALES = ['ja', 'en']
// Not offered as interface languages, and ignored if stored: Ainu stays
// hidden until enough of the interface is translated into it. Its strings
// and fallbacks (Ainu, then Japanese, then English) are already in place, so
// removing it here is all it takes to offer it.
export const HIDDEN_INTERFACE_LOCALES = ['ain']
const STORAGE_KEY = 'interface-locale'

let current: string | null = null
const listeners = new Set<(locale: string) => void>()

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch (e) {
    return null
  }
}

// Interface languages people can choose from.
export function selectableInterfaceLocales(
  available: ReadonlyArray<string>
): string[] {
  return available.filter(locale => !HIDDEN_INTERFACE_LOCALES.includes(locale))
}

function resolveInterfaceLocale(allAvailable: ReadonlyArray<string>): string {
  const available = selectableInterfaceLocales(allAvailable)
  const stored = readStored()
  if (stored && available.includes(stored)) return stored

  const [negotiated] = negotiateLanguages(
    navigator.languages,
    NEGOTIABLE_INTERFACE_LOCALES.filter(locale => available.includes(locale)),
    { defaultLocale: DEFAULT_INTERFACE_LOCALE, strategy: 'lookup' }
  )
  return negotiated
}

export function setInterfaceLocale(locale: string) {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch (e) {
    // noop
  }
  current = locale
  listeners.forEach(listener => listener(locale))
}

// The interface language last used to render the page, on private instances.
export function currentInterfaceLocale(): string | null {
  return IS_PRIVATE_INSTANCE ? current : null
}

export function useInterfaceLocale(
  available: ReadonlyArray<string>
): [string, (locale: string) => void] {
  const [locale, setLocale] = React.useState(() =>
    resolveInterfaceLocale(available)
  )

  React.useEffect(() => {
    listeners.add(setLocale)
    return () => {
      listeners.delete(setLocale)
    }
  }, [])

  // The available locales are often still loading on the first render, so
  // the stored choice can only be applied once they arrive.
  React.useEffect(() => {
    setLocale(resolveInterfaceLocale(available))
  }, [available.join(',')])

  current = locale
  return [locale, setInterfaceLocale]
}

// Locales allowed as the first part of the URL.
export function routeLocales(languages: Languages.State): string[] {
  return IS_PRIVATE_INSTANCE
    ? languages.contributableLocales
    : languages.translatedLocales
}

export function defaultRouteLocale(languages: Languages.State): string {
  return IS_PRIVATE_INSTANCE
    ? languages.contributableLocales[0] ?? DEFAULT_LOCALE
    : DEFAULT_LOCALE
}

// Locales to render the interface in, most preferred first.
export function interfaceLocales(
  routeUserLocales: string[],
  interfaceLocale: string
): string[] {
  return IS_PRIVATE_INSTANCE ? [interfaceLocale] : routeUserLocales
}
