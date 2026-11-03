import * as React from 'react'
import { useLocalization } from '@fluent/react'

import Logo from '../components/layout/logo'
import { LocaleLink } from '../components/locale-helpers'
import { IS_PRIVATE_INSTANCE } from './config'

import './logo.css'

type Props = React.ComponentProps<typeof Logo>

// On private instances, the site name as plain text instead of the Common
// Voice logo. The name is the fork-site-name string, so it follows the
// interface language and is also used as the page title.
const SiteName = (props: Props) => {
  const { l10n } = useLocalization()
  const name = l10n.getString('fork-site-name')

  React.useEffect(() => {
    if (IS_PRIVATE_INSTANCE) document.title = name
  }, [name])

  if (!IS_PRIVATE_INSTANCE) {
    return <Logo {...props} />
  }

  return (
    <LocaleLink className="Logo fork-site-name" to="">
      {name}
    </LocaleLink>
  )
}

export default SiteName
