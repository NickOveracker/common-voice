import * as React from 'react'
import { useEffect, useState, useRef } from 'react'
import { LocalizationProvider } from '@fluent/react'
import { useHistory, Switch, Route, Redirect } from 'react-router'
import { useDispatch } from 'react-redux'
import * as Sentry from '@sentry/react'

import URLS from '../urls'
import { createLocalization, negotiateLocales } from '../services/localization'
import { useTypedSelector } from '../stores/tree'
import { replacePathLocale } from '../utility'
import { useAPI } from '../hooks/store-hooks'
import { Spinner } from './ui/ui'
import { Locale } from '../stores/locale'
import * as Languages from '../stores/languages'
import { useLocale } from './locale-helpers'
import {
  defaultRouteLocale,
  interfaceLocales,
  routeLocales,
  useInterfaceLocale,
} from '../fork/interface-locale'

const SentryRoute = Sentry.withSentryRouting(Route)

const STORED_LOCALE_KEY = 'current-locale'

// Safe localStorage helper functions
function getStoredLocale() {
  try {
    return localStorage.getItem(STORED_LOCALE_KEY)
  } catch (e) {
    return null
  }
}

function setStoredLocale(locale: string) {
  try {
    localStorage.setItem(STORED_LOCALE_KEY, locale)
  } catch (e) {
    // noop
  }
}

interface LanguageRoutesProps {
  userLocales: string[]
  setUserLocales: (newUserLocales: string[]) => void
  children: React.ReactNode
}

const LanguageRoutes = ({
  userLocales,
  setUserLocales,
  children,
}: LanguageRoutesProps) => {
  const languages = useTypedSelector(({ languages }) => languages)

  const [primaryUserLocale] = userLocales
  const [, toLocaleRoute] = useLocale()

  // Track previous locale to avoid unnecessary updates
  const prevLocaleRef = useRef(primaryUserLocale)

  // Handle locale changes in useEffect
  useEffect(() => {
    if (primaryUserLocale !== prevLocaleRef.current) {
      prevLocaleRef.current = primaryUserLocale
      setStoredLocale(primaryUserLocale) // <== Save to localStorage when locale changes
    }
  }, [primaryUserLocale])

  return (
    <Switch>
      {/* if there is no locale, redirect to url with locale */}
      {Object.values(URLS).map(url => (
        <SentryRoute
          key={url}
          exact
          path={url || '/'}
          render={() => (
            <Redirect to={`/${primaryUserLocale}${url}${location.search}`} />
          )}
        />
      ))}
      <SentryRoute
        path="/:locale"
        render={something => {
          const localeParam = something?.match?.params?.locale

          const hasTranslatedLocale =
            routeLocales(languages).includes(localeParam)

          if (hasTranslatedLocale) {
            // We'll handle the locale change via useEffect
            if (primaryUserLocale !== localeParam) {
              // Schedule the update for after render
              setTimeout(() => {
                setUserLocales([localeParam, ...userLocales])
              }, 0)
            }
            return children
          }

          // redirect pt-BR to pt
          if (localeParam === 'pt-BR') {
            return (
              <Redirect push to={location.pathname.replace('pt-BR', 'pt')} />
            )
          }

          // redirect en-UK, en-US etc to en
          if (localeParam.startsWith('en-')) {
            return (
              <Redirect
                push
                to={location.pathname.replace(localeParam, 'en')}
              />
            )
          }

          // TODO: Find the right place to do this redirect
          if (localeParam === 'sentence-collector') {
            return (
              <Redirect
                push
                to={toLocaleRoute(URLS.SENTENCE_COLLECTOR_REDIRECT)}
              />
            )
          }

          // 404 for non-translated locales
          return (
            <Redirect
              push
              to={{
                pathname: `/${primaryUserLocale}/404`,
                state: { prevPath: location.pathname },
              }}
            />
          )
        }}
      />
    </Switch>
  )
}

interface LanguagesProviderProps {
  children: React.ReactNode
}

const LanguagesProvider = ({ children }: LanguagesProviderProps) => {
  const api = useAPI()
  const history = useHistory()
  const languages = useTypedSelector(({ languages }) => languages)
  const flags = useTypedSelector(({ flags }) => flags)
  const dispatch = useDispatch()

  const [userLocales, setUserLocales] = useState([])
  const [localization, setLocalization] = useState(null)
  const [interfaceLocale] = useInterfaceLocale(languages.translatedLocales ?? [])

  const loadLanguages = () => {
    dispatch(Languages.actions.loadLocalesData())
  }

  const setLocale = (newLocale: string) => {
    dispatch(Locale.actions.set(newLocale))
  }

  async function updateLocalization() {
    const localizationUserLocales = [...userLocales]
    const pathname = history.location.pathname

    if (!routeLocales(languages).includes(userLocales[0])) {
      localizationUserLocales[0] = defaultRouteLocale(languages)
      setUserLocales(localizationUserLocales)
      setLocale(localizationUserLocales[0])
      history.replace(replacePathLocale(pathname, localizationUserLocales[0]))
    } else {
      setLocale(localizationUserLocales[0])
    }

    const uiLocales = interfaceLocales(localizationUserLocales, interfaceLocale)
    const { documentElement } = document
    documentElement.setAttribute('lang', uiLocales[0])
    documentElement.setAttribute(
      'dir',
      languages.rtlLocales.includes(uiLocales[0]) ? 'rtl' : 'ltr'
    )

    const newLocalization = await createLocalization(
      api,
      uiLocales,
      flags.messageOverwrites,
      languages.translatedLocales
    )

    setLocalization(newLocalization)
  }

  useEffect(() => {
    loadLanguages()
  }, [])

  useEffect(() => {
    if (userLocales.length === 0 && !languages?.isLoading) {
      let newUserLocales = negotiateLocales(
        navigator.languages,
        routeLocales(languages)
      )
      // <== Check for stored locale first
      const storedLocale = getStoredLocale()
      if (storedLocale && routeLocales(languages).includes(storedLocale)) {
        newUserLocales = [storedLocale, ...newUserLocales]
      }
      setUserLocales(newUserLocales)
    }
  }, [userLocales, languages])

  useEffect(() => {
    if (userLocales.length > 0) {
      updateLocalization()
    }
  }, [userLocales, interfaceLocale])

  if (languages?.isLoading || !localization) {
    return <Spinner />
  }

  return (
    <LocalizationProvider l10n={localization}>
      <LanguageRoutes userLocales={userLocales} setUserLocales={setUserLocales}>
        {children}
      </LanguageRoutes>
    </LocalizationProvider>
  )
}

export default LanguagesProvider
