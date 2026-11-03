import * as React from 'react'
import { Localized } from '@fluent/react'

import URLS from '../urls'
import { LocaleLink } from '../components/locale-helpers'

import '../components/layout/footer.css'

// Replaces the upstream footer (Mozilla links, newsletter, sharing, license)
// on private instances.
const PrivateFooter = React.memo(() => (
  <footer>
    <div id="moz-links">
      <div className="divider-bottom" />
      <div className="links">
        <div>
          <Localized id="privacy">
            <LocaleLink to={URLS.PRIVACY} data-testid="privacy-link" />
          </Localized>
          <Localized id="terms">
            <LocaleLink to={URLS.TERMS} data-testid="terms-link" />
          </Localized>
        </div>
      </div>
    </div>
  </footer>
))

PrivateFooter.displayName = 'PrivateFooter'

export default PrivateFooter
