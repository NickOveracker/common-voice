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
const RecordingPage = lazyWithRetry(() => import('./stories/recording-page'))
const AdminPage = lazyWithRetry(() => import('./admin/admin-page'))
const PromptsPage = lazyWithRetry(() => import('./stories/prompts-page'))
const ReportsPage = lazyWithRetry(() => import('./stories/reports-page'))
const ExportsPage = lazyWithRetry(() => import('./admin/exports-page'))

// Upstream pages that are hidden on private instances. They link to public
// datasets, donations, Mozilla's own content or language requests, or are
// upstream's scripted speech, which this archive doesn't use.
// See also visible-menu-items.ts.
const HIDDEN_PAGES = [
  URLS.SPEAK,
  URLS.LISTEN,
  URLS.WRITE,
  URLS.REVIEW,
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
      key="story"
      exact
      path={toLocaleRoute(FORK_URLS.STORY + ':recordingId(\\d+)')}
      component={RecordingPage}
    />,
    <Route
      key="prompts"
      exact
      path={toLocaleRoute(FORK_URLS.PROMPTS)}
      component={PromptsPage}
    />,
    <Route
      key="reports"
      exact
      path={toLocaleRoute(FORK_URLS.REPORTS)}
      component={ReportsPage}
    />,
    <Route
      key="exports"
      exact
      path={toLocaleRoute(FORK_URLS.EXPORTS)}
      component={ExportsPage}
    />,
    <Route
      key="admin"
      exact
      path={toLocaleRoute(FORK_URLS.ADMIN)}
      component={AdminPage}
    />,
    <Route
      key="speakers"
      exact
      path={toLocaleRoute(FORK_URLS.SPEAKERS)}
      component={SpeakersPage}
    />,
    // Scripted speech statistics, goals and awards, under /dashboard/…
    <Route
      key="dashboard"
      path={toLocaleRoute(URLS.DASHBOARD)}
      render={() => <Redirect to={toLocaleRoute(URLS.ROOT)} />}
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
