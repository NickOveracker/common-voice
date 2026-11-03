import React from 'react'

import { HeroSection } from '../components/pages/home/hero-section'
import { ActionItemsSection } from '../components/pages/home/action-items-section'
import Page from '../components/ui/page'
import { isContributable, useLocale } from '../components/locale-helpers'

// The upstream home page without Mozilla's community, partner, developer and
// dataset sections.
const PrivateHome = () => {
  const [locale] = useLocale()
  const isLocaleContributable = isContributable(locale)

  return (
    <Page className="home">
      <HeroSection isLocaleContributable={isLocaleContributable} />
      <ActionItemsSection isLocaleContributable={isLocaleContributable} />
    </Page>
  )
}

export default PrivateHome
