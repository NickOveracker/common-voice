import * as React from 'react'
import { Localized, useLocalization } from '@fluent/react'

import Page from '../../components/ui/page'
import PageHeading from '../../components/ui/page-heading'
import { Button, LabeledInput, Spinner } from '../../components/ui/ui'
import { LocaleLink } from '../../components/locale-helpers'
import FORK_URLS from '../urls'
import { listReports, Report, resolveReport, StoriesApiError } from './api'

const FORBIDDEN = 'forbidden'
import { formatTime } from './format'

import './stories.css'

// Reports of problems with recordings, for moderators.

const formatWhen = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

const ReportCard = ({
  report,
  onResolved,
}: {
  report: Report
  onResolved: () => void
}) => {
  const { l10n } = useLocalization()
  const [resolution, setResolution] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const resolve = async () => {
    setError(null)
    try {
      await resolveReport(report.id, resolution.trim() || null)
      onResolved()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <li className="fork-stories__card">
      <h2>
        <LocaleLink to={FORK_URLS.STORY + report.recording_id}>
          {report.recording_title}
        </LocaleLink>
      </h2>
      <p className="fork-stories__meta">
        <Localized id={`fork-report-reason-${report.reason}`}>
          <strong />
        </Localized>
        {report.segment_start_ms !== null && (
          <>
            {' · '}
            {formatTime(report.segment_start_ms)} –{' '}
            {formatTime(report.segment_end_ms)}
          </>
        )}
        {' · '}
        {formatWhen(report.created_at)}
        {report.reported_by && ` · ${report.reported_by}`}
      </p>
      {report.comment && <p>{report.comment}</p>}
      {report.status === 'open' ? (
        <div className="fork-review__comment">
          <LabeledInput
            label={l10n.getString('fork-reports-resolution')}
            value={resolution}
            maxLength={5000}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setResolution(event.target.value)
            }
          />
          <Localized id="fork-reports-resolve">
            <Button rounded outline onClick={resolve} />
          </Localized>
        </div>
      ) : (
        <Localized
          id="fork-reports-resolved-by"
          vars={{
            who: report.resolved_by ?? '—',
            when: report.resolved_at ? formatWhen(report.resolved_at) : '',
            resolution: report.resolution ?? '—',
          }}>
          <p className="fork-stories__status" />
        </Localized>
      )}
      {error && (
        <Localized id="fork-error" vars={{ message: error }}>
          <p className="fork-stories__error" role="alert" />
        </Localized>
      )}
    </li>
  )
}

const ReportsPage = () => {
  const [status, setStatus] = React.useState<Report['status']>('open')
  const [reports, setReports] = React.useState<Report[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    setError(null)
    listReports(status)
      .then(setReports)
      .catch(e =>
        setError(
          e instanceof StoriesApiError && e.status === 403
            ? FORBIDDEN
            : e.message
        )
      )
  }, [status])
  React.useEffect(load, [load])

  return (
    <Page className="fork-stories" isCentered>
      <PageHeading>
        <Localized id="fork-reports-title" />
      </PageHeading>
      <div className="fork-stories__actions">
        <span className="fork-stories__filter">
          <Localized id="fork-reports-open">
            <Button
              rounded
              outline={status !== 'open'}
              aria-pressed={status === 'open'}
              onClick={() => setStatus('open')}
            />
          </Localized>
          <Localized id="fork-reports-resolved">
            <Button
              rounded
              outline={status !== 'resolved'}
              aria-pressed={status === 'resolved'}
              onClick={() => setStatus('resolved')}
            />
          </Localized>
        </span>
      </div>
      {error === FORBIDDEN ? (
        <Localized id="fork-reports-moderators-only">
          <p />
        </Localized>
      ) : (
        error && (
          <Localized id="fork-error" vars={{ message: error }}>
            <p className="fork-stories__error" role="alert" />
          </Localized>
        )
      )}
      {!reports && !error && <Spinner />}
      {reports?.length === 0 && (
        <Localized id="fork-reports-none">
          <p />
        </Localized>
      )}
      <ul className="fork-stories__list">
        {reports?.map(report => (
          <ReportCard key={report.id} report={report} onResolved={load} />
        ))}
      </ul>
    </Page>
  )
}

export default ReportsPage
