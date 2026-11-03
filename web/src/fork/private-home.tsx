import * as React from 'react'
import { Localized } from '@fluent/react'

import Page from '../components/ui/page'
import PageHeading from '../components/ui/page-heading'
import CommunityLinks from './community-links'

// The home page of a private instance: the site's name, what it is for, and
// its pages. Upstream's home page is about Mozilla's datasets, with photos
// of other communities.
const PrivateHome = () => (
  <Page className="fork-home" isCentered>
    <PageHeading>
      <Localized id="fork-site-name" />
    </PageHeading>
    <Localized id="fork-home-intro">
      <p className="fork-home__intro" />
    </Localized>
    <CommunityLinks />
  </Page>
)

export default PrivateHome
