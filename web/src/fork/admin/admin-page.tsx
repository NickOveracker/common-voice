import * as React from 'react'
import { Localized, useLocalization } from '@fluent/react'

import Page from '../../components/ui/page'
import PageHeading from '../../components/ui/page-heading'
import { LabeledInput, Spinner } from '../../components/ui/ui'
import {
  CommunityUser,
  getOwnRoles,
  grantRole,
  listUsers,
  revokeRole,
  Role,
} from '../stories/api'

import '../stories/stories.css'
import './admin.css'

// Community roles, for admins (server/src/fork/roles.ts).

const ROLES: Role[] = ['admin', 'moderator', 'reviewer']

const ErrorMessage = ({ message }: { message: string }) => (
  <Localized id="fork-error" vars={{ message }}>
    <p className="fork-stories__error" role="alert" />
  </Localized>
)

const AdminPage = () => {
  const { l10n } = useLocalization()
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null)
  const [users, setUsers] = React.useState<CommunityUser[] | null>(null)
  const [filter, setFilter] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    listUsers()
      .then(setUsers)
      .catch(e => setError(e.message))
  }, [])

  React.useEffect(() => {
    getOwnRoles()
      .then(({ roles }) => {
        setIsAdmin(roles.includes('admin'))
        if (roles.includes('admin')) load()
      })
      .catch(e => setError(e.message))
  }, [load])

  const change = async (user: CommunityUser, role: Role, granted: boolean) => {
    setBusy(true)
    setError(null)
    try {
      await (granted ? grantRole : revokeRole)(user.client_id, role)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const needle = filter.trim().toLowerCase()
  const shown = users?.filter(
    user =>
      !needle ||
      user.email.toLowerCase().includes(needle) ||
      user.username?.toLowerCase().includes(needle)
  )

  return (
    <Page className="fork-stories fork-admin" isCentered>
      <PageHeading>
        <Localized id="fork-admin-title" />
      </PageHeading>
      {error && <ErrorMessage message={error} />}
      {isAdmin === null && !error && <Spinner />}
      {isAdmin === false && (
        <Localized id="fork-admin-only">
          <p />
        </Localized>
      )}
      {isAdmin && (
        <>
          <Localized id="fork-admin-roles-intro">
            <p />
          </Localized>
          <ul className="fork-admin__roles">
            {ROLES.map(role => (
              <li key={role}>
                <Localized id={`fork-role-${role}`}>
                  <strong />
                </Localized>
                {' — '}
                <Localized id={`fork-role-${role}-description`}>
                  <span />
                </Localized>
              </li>
            ))}
          </ul>
          <LabeledInput
            label={l10n.getString('fork-admin-filter')}
            value={filter}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setFilter(event.target.value)
            }
          />
          {!users && !error && <Spinner />}
          {shown && (
            <div className="fork-admin__table-wrap">
              <table className="fork-admin__table">
                <thead>
                  <tr>
                    <Localized id="fork-admin-user">
                      <th scope="col" />
                    </Localized>
                    {ROLES.map(role => (
                      <Localized key={role} id={`fork-role-${role}`}>
                        <th scope="col" />
                      </Localized>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map(user => (
                    <tr key={user.client_id}>
                      <th scope="row">
                        {user.username || '—'}
                        <span className="fork-stories__meta">{user.email}</span>
                      </th>
                      {ROLES.map(role => {
                        const configured =
                          role === 'admin' && user.configured_admin
                        return (
                          <td key={role}>
                            <input
                              type="checkbox"
                              aria-label={l10n.getString(
                                'fork-admin-role-for',
                                {
                                  role: l10n.getString(`fork-role-${role}`),
                                  user: user.username || user.email,
                                }
                              )}
                              checked={configured || user.roles.includes(role)}
                              disabled={busy || configured}
                              title={
                                configured
                                  ? l10n.getString('fork-admin-configured')
                                  : undefined
                              }
                              onChange={event =>
                                change(user, role, event.target.checked)
                              }
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Localized id="fork-admin-configured-note">
            <p className="fork-stories__hint" />
          </Localized>
        </>
      )}
    </Page>
  )
}

export default AdminPage
