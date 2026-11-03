import * as React from 'react'
import { Localized, useLocalization } from '@fluent/react'

import { Button, LabeledSelect, LabeledTextArea } from '../../components/ui/ui'
import { createReport, REPORT_REASONS, ReportReason, Segment } from './api'
import { formatTime } from './format'

// Tells moderators about a problem with a recording, or one segment of it.
const ReportForm = ({
  recordingId,
  segments,
}: {
  recordingId: number
  segments: Segment[]
}) => {
  const { l10n } = useLocalization()
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState<ReportReason>('consent')
  const [segmentId, setSegmentId] = React.useState<number | null>(null)
  const [comment, setComment] = React.useState('')
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const send = async () => {
    setError(null)
    try {
      await createReport(recordingId, {
        reason,
        comment: comment.trim() || null,
        segment_id: segmentId,
      })
      setSent(true)
      setOpen(false)
      setComment('')
      setSegmentId(null)
    } catch (e) {
      setError(e.message)
    }
  }

  if (!open) {
    return (
      <p className="fork-report">
        {sent && (
          <Localized id="fork-report-sent">
            <span className="fork-stories__status" role="status" />
          </Localized>
        )}{' '}
        <Localized id="fork-report-open">
          <button
            type="button"
            className="fork-transcribe__link"
            onClick={() => {
              setSent(false)
              setOpen(true)
            }}
          />
        </Localized>
      </p>
    )
  }

  return (
    <form
      className="fork-stories__form fork-report"
      onSubmit={event => event.preventDefault()}>
      <Localized id="fork-report-title">
        <h2 />
      </Localized>
      <Localized id="fork-report-intro">
        <p className="fork-stories__hint" />
      </Localized>
      <LabeledSelect
        label={l10n.getString('fork-report-reason')}
        value={reason}
        onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
          setReason(event.target.value as ReportReason)
        }>
        {REPORT_REASONS.map(value => (
          <option key={value} value={value}>
            {l10n.getString(`fork-report-reason-${value}`)}
          </option>
        ))}
      </LabeledSelect>
      {segments.length > 1 && (
        <LabeledSelect
          label={l10n.getString('fork-report-segment')}
          value={segmentId ?? ''}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
            setSegmentId(Number(event.target.value) || null)
          }>
          <option value="">{l10n.getString('fork-report-whole')}</option>
          {segments.map((segment, index) => (
            <option key={segment.id} value={segment.id}>
              {index + 1}. {formatTime(segment.start_ms)} –{' '}
              {formatTime(segment.end_ms)}
            </option>
          ))}
        </LabeledSelect>
      )}
      <LabeledTextArea
        label={l10n.getString('fork-report-comment')}
        value={comment}
        maxLength={5000}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
          setComment(event.target.value)
        }
      />
      <div className="fork-stories__card-actions">
        <Localized id="fork-report-send">
          <Button rounded onClick={send} />
        </Localized>
        <Localized id="fork-cancel">
          <Button rounded outline onClick={() => setOpen(false)} />
        </Localized>
      </div>
      {error && (
        <Localized id="fork-error" vars={{ message: error }}>
          <p className="fork-stories__error" role="alert" />
        </Localized>
      )}
    </form>
  )
}

export default ReportForm
