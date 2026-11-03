import * as React from 'react'
import { Localized } from '@fluent/react'

import { LinkButton } from '../components/ui/ui'
import FORK_URLS from './urls'
import { getOwnRoles } from './stories/api'

import './admin/admin.css'

// The community's own pages, for the home page. The admin page is only
// linked for admins.
const CommunityLinks = () => {
  const [isAdmin, setIsAdmin] = React.useState(false)

  React.useEffect(() => {
    getOwnRoles()
      .then(({ roles }) => setIsAdmin(roles.includes('admin')))
      .catch((): null => null)
  }, [])

  return (
    <div className="fork-community-links">
      <Localized id="fork-menu-stories">
        <LinkButton rounded to={FORK_URLS.STORIES} />
      </Localized>
      <Localized id="fork-menu-record-story">
        <LinkButton rounded outline to={FORK_URLS.STORIES_NEW} />
      </Localized>
      <Localized id="fork-menu-speakers">
        <LinkButton rounded outline to={FORK_URLS.SPEAKERS} />
      </Localized>
      {isAdmin && (
        <Localized id="fork-admin-title">
          <LinkButton rounded outline to={FORK_URLS.ADMIN} />
        </Localized>
      )}
    </div>
  )
}

export default CommunityLinks
