import * as React from 'react'
import { Localized } from '@fluent/react'
import { useLocation } from 'react-router'

import { useTypedSelector } from '../stores/tree'
import { LinkButton, Spinner } from '../components/ui/ui'
import Page from '../components/ui/page'
import PageHeading from '../components/ui/page-heading'
import PageTextContent from '../components/ui/page-text-content'
import URLS from '../urls'
import { IS_PRIVATE_INSTANCE } from './config'
import HeaderLanguageSelect from './header-language-select'

import './sign-in-gate.css'

// Pages that must work before sign-in: finishing the sign-in itself, and the
// documents people should be able to read before agreeing to anything.
const ANONYMOUS_PAGES = [
  '/login-success',
  '/login-failure',
  URLS.PRIVACY,
  URLS.TERMS,
]

const isAnonymousPage = (pathname: string) => {
  // pathname is /<locale>/<page>
  const page = '/' + pathname.split('/').slice(2).join('/')
  return ANONYMOUS_PAGES.includes(page)
}

const SignInPage = () => {
  // Lets layout.css hide the menu and navigation while signed out
  React.useEffect(() => {
    document.body.classList.add('fork-signed-out')
    return () => document.body.classList.remove('fork-signed-out')
  }, [])

  return (
    <Page className="sign-in-gate" isCentered>
      <PageHeading>
        <Localized id="fork-sign-in-title" />
      </PageHeading>
      <PageTextContent>
        <Localized id="fork-sign-in-body">
          <p />
        </Localized>
      </PageTextContent>
      <Localized id="fork-sign-in-button">
        <LinkButton rounded href="/login" className="sign-in-gate__button" />
      </Localized>
      {/* The header's language menu is hidden while signed out */}
      <div className="sign-in-gate__language">
        <HeaderLanguageSelect />
      </div>
    </Page>
  )
}

// On private instances, everything except ANONYMOUS_PAGES requires sign-in.
// The server enforces this too (server/src/fork/require-login.ts); this only
// replaces pages that would otherwise fail to load.
const SignInGate = ({ children }: { children: React.ReactNode }) => {
  const user = useTypedSelector(({ user }) => user)
  const { pathname } = useLocation()

  if (!IS_PRIVATE_INSTANCE || isAnonymousPage(pathname)) {
    return <>{children}</>
  }

  if (user.isFetchingAccount) {
    return <Spinner />
  }

  // Signed-in users without a profile yet only have an email here
  const isSignedIn = user.userClients.some(userClient => userClient.email)

  return isSignedIn ? <>{children}</> : <SignInPage />
}

export default SignInGate
