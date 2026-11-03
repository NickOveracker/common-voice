import * as React from 'react'
import { Redirect, Route } from 'react-router'

import URLS from '../urls'
import FORK_URLS from './urls'
import lazyWithRetry from '../lazy-with-retry'
import { IS_PRIVATE_INSTANCE } from './config'

const PrivateHome = lazyWithRetry(() => import('./private-home'))
const StoriesPage = lazyWithRetry(() => import('./stories/stories-page'))
const NewRecordingPage = lazyWithRetry(
  () => import('./stories/new-recording-page')
)
const SpeakersPage = lazyWithRetry(() => import('./stories/speakers-page'))

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

// Routes to put first in a <Switch>: our own pages, and redirects from
// hidden pages to the home page.
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
    <Route
      key="stories"
      exact
      path={toLocaleRoute(FORK_URLS.STORIES)}
      component={StoriesPage}
    />,
    <Route
      key="stories-new"
      exact
      path={toLocaleRoute(FORK_URLS.STORIES_NEW)}
      component={NewRecordingPage}
    />,
    <Route
      key="speakers"
      exact
      path={toLocaleRoute(FORK_URLS.SPEAKERS)}
      component={SpeakersPage}
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
