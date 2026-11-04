import * as React from 'react'
import { useEffect } from 'react'
import { Localized } from '@fluent/react'

import { ErrorBoundaryErrorCode } from '../../../services/app-error'
import { trackError } from '../../../services/tracker'
import { LocaleLink } from '../../locale-helpers'
import { GitHubLink, DiscourseLink, MatrixLink } from '../../shared/links'
import { GithubIconCode, DiscourseIconCode, MatrixIcon } from '../../ui/icons'

import RoundButton from '../../ui/round-button'
import Page from '../../ui/page'
import PageHeading from '../../ui/page-heading'
import PageTextContent from '../../ui/page-text-content'
import VisuallyHidden from '../../visually-hidden/visually-hidden'
import { IS_PRIVATE_INSTANCE } from '../../../fork/config'

import './error-page.css'

interface Props {
  children?: React.ReactNode
  errorCode: ErrorBoundaryErrorCode | '404'
  prevPath?: string
}

const ErrorPage = ({ children, errorCode, prevPath }: Props) => {
  useEffect(() => {
    trackError(errorCode, prevPath || '')
  }, [])

  const headingLocalisationId = `error-title-${errorCode}`

  // Private instances: no Mozilla community links, only the way back home
  const privateContent = IS_PRIVATE_INSTANCE && (
    <Localized
      id={
        errorCode === '404'
          ? 'fork-error-page-content-404'
          : 'fork-error-page-content'
      }
      elems={{ homepageLink: <LocaleLink to="" /> }}>
      <p />
    </Localized>
  )

  return (
    <Page className="error-page">
      <div className="error-page-wrapper">
        <div className="error-page__content">
          <PageHeading>
            <Localized id={headingLocalisationId} />
          </PageHeading>

          <PageTextContent>
            <h2>
              <Localized id="error-code" vars={{ code: errorCode }} />
            </h2>
            {children || privateContent || (
              <React.Fragment>
                <Localized
                  id={`error-content-${errorCode}`}
                  elems={{
                    homepageLink: <LocaleLink to="" />,
                    matrixLink: <MatrixLink />,
                    githubLink: <GitHubLink />,
                    discourseLink: <DiscourseLink />,
                  }}>
                  <p />
                </Localized>
                <div className="error-page__buttons">
                  <RoundButton>
                    <DiscourseLink>
                      <VisuallyHidden>Discourse</VisuallyHidden>
                      <DiscourseIconCode />
                    </DiscourseLink>
                  </RoundButton>

                  <RoundButton>
                    <GitHubLink>
                      <VisuallyHidden>GitHub</VisuallyHidden>
                      <GithubIconCode />
                    </GitHubLink>
                  </RoundButton>

                  <RoundButton>
                    <MatrixLink>
                      <VisuallyHidden>Matrix</VisuallyHidden>
                      <MatrixIcon />
                    </MatrixLink>
                  </RoundButton>
                </div>
              </React.Fragment>
            )}
          </PageTextContent>
        </div>
        <div className="error-page__image">
          <img
            src={require('./images/mars-sad.svg')}
            alt=""
            loading="lazy"
            role="presentation"
          />
        </div>
      </div>
    </Page>
  )
}

export default ErrorPage
