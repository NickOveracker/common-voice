import * as React from 'react'
import { Redirect, Route } from 'react-router'

import URLS from '../urls'
import lazyWithRetry from '../lazy-with-retry'
import { IS_PRIVATE_INSTANCE } from './config'

const PrivateHome = lazyWithRetry(() => import('./private-home'))

// Upstream pages that are hidden on private instances. They link to public
// datasets, donations, Mozilla's own content or language requests.
// See also visible-menu-items.ts.
const HIDDEN_PAGES = [
  URLS.ABOUT,
  URLS.FAQ,
  URLS.PARTNER,
  URLS.LANGUAGES,
  URLS.LANGUAGE_REQUEST,
  URLS.LANGUAGE_REQUEST_SUCCESS,
  URLS.DATA,
  '/datasets',
  URLS.OLDDATASETS,
  URLS.CHALLENGE_TERMS,
  '/landing/sodedif',
  URLS.SENTENCE_COLLECTOR_REDIRECT,
]

// Routes to put first in a <Switch>: our own home page, and redirects from
// hidden pages to it.
export function privateInstanceRoutes(
  toLocaleRoute: (path: string) => string
): React.ReactElement[] {
  if (!IS_PRIVATE_INSTANCE) return []

  return [
    <Route
      key="home"
      exact
      path={toLocaleRoute(URLS.ROOT)}
      component={PrivateHome}
    />,
    ...HIDDEN_PAGES.map(path => (
      <Route
        key={path}
        exact
        path={toLocaleRoute(path)}
        render={() => <Redirect to={toLocaleRoute(URLS.ROOT)} />}
      />
    )),
  ]
}
