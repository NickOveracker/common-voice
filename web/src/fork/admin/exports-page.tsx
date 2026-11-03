import * as React from 'react'
import { Localized, useLocalization } from '@fluent/react'

import Page from '../../components/ui/page'
import PageHeading from '../../components/ui/page-heading'
import {
  Button,
  LabeledCheckbox,
  LabeledSelect,
  Spinner,
} from '../../components/ui/ui'
import {
  ArchiveExport,
  createExport,
  deleteExport,
  EXPORT_PURPOSES,
  ExportAudio,
  exportDownloadUrl,
  ExportPurpose,
  getOwnRoles,
  listExports,
} from '../stories/api'

import '../stories/stories.css'
import './admin.css'

// Exports of the archive, for admins. Each one includes only recordings
// whose every speaker currently consents to its purpose.

const AUDIO: ExportAudio[] = ['none', 'recordings', 'segments']

const formatWhen = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

const formatSize = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : `${Math.max(0.1, bytes / 1024 ** 2).toFixed(1)} MB`

const ErrorMessage = ({ message }: { message: string }) => (
  <Localized id="fork-error" vars={{ message }}>
    <p className="fork-stories__error" role="alert" />
  </Localized>
)

const NewExport = ({ onCreated }: { onCreated: () => void }) => {
  const { l10n } = useLocalization()
  const [purpose, setPurpose] = React.useState<ExportPurpose>('research')
  const [audio, setAudio] = React.useState<ExportAudio>('none')
  const [onlyChecked, setOnlyChecked] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const create = async () => {
    setError(null)
    try {
      await createExport({ purpose, audio, only_checked: onlyChecked })
      onCreated()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <form
      className="fork-stories__form"
      onSubmit={event => event.preventDefault()}>
      <Localized id="fork-exports-new">
        <h2 />
      </Localized>
      <LabeledSelect
        label={l10n.getString('fork-exports-purpose')}
        value={purpose}
        onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
          setPurpose(event.target.value as ExportPurpose)
        }>
        {EXPORT_PURPOSES.map(value => (
          <option key={value} value={value}>
            {l10n.getString(`fork-exports-purpose-${value}`)}
          </option>
        ))}
      </LabeledSelect>
      <Localized id={`fork-exports-purpose-${purpose}-note`}>
        <p className="fork-stories__hint" />
      </Localized>
      <LabeledSelect
        label={l10n.getString('fork-exports-audio')}
        value={audio}
        onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
          setAudio(event.target.value as ExportAudio)
        }>
        {AUDIO.map(value => (
          <option key={value} value={value}>
            {l10n.getString(`fork-exports-audio-${value}`)}
          </option>
        ))}
      </LabeledSelect>
      <LabeledCheckbox
        label={l10n.getString('fork-exports-only-checked')}
        checked={onlyChecked}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          setOnlyChecked(event.target.checked)
        }
      />
      <Localized id="fork-exports-create">
        <Button rounded onClick={create} />
      </Localized>
      {error && <ErrorMessage message={error} />}
    </form>
  )
}

const ExportCard = ({
  item,
  onChanged,
}: {
  item: ArchiveExport
  onChanged: () => void
}) => {
  const { l10n } = useLocalization()
  const [error, setError] = React.useState<string | null>(null)

  const remove = async () => {
    if (!window.confirm(l10n.getString('fork-exports-delete-confirm'))) return
    setError(null)
    try {
      await deleteExport(item.id)
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <li className="fork-stories__card">
      <h2>
        #{item.id}{' '}
        <Localized id={`fork-exports-purpose-${item.purpose}`}>
          <span />
        </Localized>
      </h2>
      <p className="fork-stories__meta">
        <Localized id={`fork-exports-audio-${item.audio}`}>
          <span />
        </Localized>
        {item.only_checked && (
          <>
            {' · '}
            <Localized id="fork-exports-only-checked-short">
              <span />
            </Localized>
          </>
        )}
        {' · '}
        {formatWhen(item.created_at)}
        {item.created_by && ` · ${item.created_by}`}
      </p>
      <Localized id={`fork-exports-status-${item.status}`}>
        <p className="fork-stories__status" />
      </Localized>
      {item.status === 'ready' && (
        <>
          <Localized
            id="fork-exports-contents"
            vars={{
              recordings: item.recordings,
              speakers: item.speakers,
              segments: item.segments,
              size: formatSize(item.size_bytes ?? 0),
            }}>
            <p />
          </Localized>
          <div className="fork-stories__card-actions">
            <Localized id="fork-exports-download">
              <a className="button rounded" href={exportDownloadUrl(item.id)} />
            </Localized>
            <Localized id="fork-exports-delete">
              <button
                type="button"
                className="fork-transcribe__link"
                onClick={remove}
              />
            </Localized>
          </div>
        </>
      )}
      {item.status === 'failed' && (
        <>
          {item.error && <ErrorMessage message={item.error} />}
          <Localized id="fork-exports-delete">
            <button
              type="button"
              className="fork-transcribe__link"
              onClick={remove}
            />
          </Localized>
        </>
      )}
      {item.status === 'deleted' && item.deleted_at && (
        <Localized
          id="fork-exports-deleted-by"
          vars={{
            who: item.deleted_by ?? '—',
            when: formatWhen(item.deleted_at),
          }}>
          <p className="fork-stories__meta" />
        </Localized>
      )}
      {error && <ErrorMessage message={error} />}
    </li>
  )
}

const ExportsPage = () => {
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null)
  const [exports, setExports] = React.useState<ArchiveExport[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    listExports()
      .then(setExports)
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

  // Check again while an export is being built
  const building = exports?.some(
    e => e.status === 'queued' || e.status === 'building'
  )
  React.useEffect(() => {
    if (!building) return
    const timer = window.setInterval(load, 3000)
    return () => window.clearInterval(timer)
  }, [building, load])

  return (
    <Page className="fork-stories" isCentered>
      <PageHeading>
        <Localized id="fork-exports-title" />
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
          <Localized id="fork-exports-intro">
            <p />
          </Localized>
          <NewExport onCreated={load} />
          <ul className="fork-stories__list">
            {exports?.map(item => (
              <ExportCard key={item.id} item={item} onChanged={load} />
            ))}
          </ul>
        </>
      )}
    </Page>
  )
}

export default ExportsPage
