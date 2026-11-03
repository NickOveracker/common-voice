import * as React from 'react'
import { Localized, useLocalization } from '@fluent/react'

import { Button, LabeledInput, LabeledTextArea } from '../../components/ui/ui'
import {
  addReview,
  listTranscriptVersions,
  Review,
  Transcript,
  TranscriptKind,
} from './api'

// One transcription or translation of a segment: the text box, how its
// current version was reviewed, buttons for reviewers, and earlier versions.

// In the viewer's own time zone
const formatWhen = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

const ReviewStatus = ({ review }: { review: Review | null }) =>
  !review ? (
    <Localized id="fork-review-unreviewed">
      <span className="fork-review fork-review--none" />
    </Localized>
  ) : review.verdict === 'approved' ? (
    <Localized id="fork-review-approved">
      <span className="fork-review fork-review--approved" />
    </Localized>
  ) : (
    <Localized
      id={
        review.comment
          ? 'fork-review-needs-work-comment'
          : 'fork-review-needs-work'
      }
      vars={{ comment: review.comment ?? '' }}>
      <span className="fork-review fork-review--needs-work" />
    </Localized>
  )

const History = ({
  segmentId,
  kind,
  currentId,
  onRestore,
}: {
  segmentId: number
  kind: TranscriptKind
  currentId: number | null
  onRestore: (text: string) => void
}) => {
  const [versions, setVersions] = React.useState<Transcript[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    listTranscriptVersions(segmentId, kind)
      .then(setVersions)
      .catch(e => setError(e.message))
  }, [segmentId, kind, currentId])

  if (error) {
    return (
      <Localized id="fork-error" vars={{ message: error }}>
        <p className="fork-stories__error" />
      </Localized>
    )
  }
  if (!versions) return null
  return (
    <ol className="fork-review__history">
      {versions.map(version => (
        <li key={version.id}>
          <span className="fork-stories__meta">
            {formatWhen(version.created_at)}
            {version.is_mine && (
              <>
                {' '}
                <Localized id="fork-review-mine">
                  <span />
                </Localized>
              </>
            )}{' '}
            <ReviewStatus review={version.review} />
          </span>
          <span className="fork-review__text">{version.text || '—'}</span>
          {version.id !== currentId && (
            <Localized id="fork-review-restore">
              <button
                type="button"
                className="fork-transcribe__link"
                onClick={() => onRestore(version.text)}
              />
            </Localized>
          )}
        </li>
      ))}
    </ol>
  )
}

const TranscriptField = ({
  segmentId,
  kind,
  label,
  lang,
  text,
  current,
  dirty,
  canReview,
  onChange,
  onReviewed,
}: {
  segmentId: number
  kind: TranscriptKind
  label: string
  lang: string
  text: string
  current: Transcript | null
  // This field has unsaved changes
  dirty: boolean
  canReview: boolean
  onChange: (text: string) => void
  onReviewed: (transcript: Transcript) => void
}) => {
  const { l10n } = useLocalization()
  const [showHistory, setShowHistory] = React.useState(false)
  const [commenting, setCommenting] = React.useState(false)
  const [comment, setComment] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const hasText = Boolean(current?.text)
  const mayReview = canReview && hasText && !current.is_mine && !dirty

  const review = async (verdict: Review['verdict']) => {
    setError(null)
    try {
      const saved = await addReview(
        current.id,
        verdict,
        verdict === 'needs_work' ? comment.trim() || null : null
      )
      setCommenting(false)
      setComment('')
      onReviewed({ ...current, review: saved })
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="fork-transcribe__field">
      <LabeledTextArea
        label={label}
        value={text}
        rows={2}
        lang={lang}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
          onChange(event.target.value)
        }
      />
      {(hasText || current) && (
        <div className="fork-review__bar">
          {hasText && !dirty && <ReviewStatus review={current.review} />}
          {mayReview && !commenting && (
            <>
              {current.review?.verdict !== 'approved' && (
                <Localized id="fork-review-approve">
                  <button
                    type="button"
                    className="fork-transcribe__link"
                    onClick={() => review('approved')}
                  />
                </Localized>
              )}
              {current.review?.verdict !== 'needs_work' && (
                <Localized id="fork-review-request-changes">
                  <button
                    type="button"
                    className="fork-transcribe__link"
                    onClick={() => setCommenting(true)}
                  />
                </Localized>
              )}
            </>
          )}
          {current && (
            <Localized
              id={
                showHistory ? 'fork-review-history-hide' : 'fork-review-history'
              }>
              <button
                type="button"
                className="fork-transcribe__link"
                aria-expanded={showHistory}
                onClick={() => setShowHistory(!showHistory)}
              />
            </Localized>
          )}
        </div>
      )}
      {mayReview && commenting && (
        <div className="fork-review__comment">
          <LabeledInput
            label={l10n.getString('fork-review-comment')}
            value={comment}
            maxLength={2000}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setComment(event.target.value)
            }
          />
          <Localized id="fork-review-send">
            <Button rounded outline onClick={() => review('needs_work')} />
          </Localized>
          <Localized id="fork-cancel">
            <Button rounded outline onClick={() => setCommenting(false)} />
          </Localized>
        </div>
      )}
      {error && (
        <Localized id="fork-error" vars={{ message: error }}>
          <p className="fork-stories__error" role="alert" />
        </Localized>
      )}
      {showHistory && (
        <History
          segmentId={segmentId}
          kind={kind}
          currentId={current?.id ?? null}
          onRestore={onChange}
        />
      )}
    </div>
  )
}

export default TranscriptField
