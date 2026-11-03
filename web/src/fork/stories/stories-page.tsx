import * as React from 'react'
import { Localized, useLocalization } from '@fluent/react'

import Page from '../../components/ui/page'
import PageHeading from '../../components/ui/page-heading'
import {
  Button,
  LabeledInput,
  LabeledSelect,
  LinkButton,
  Spinner,
} from '../../components/ui/ui'
import { LocaleLink } from '../../components/locale-helpers'
import FORK_URLS from '../urls'
import {
  completeRecording,
  getRecording,
  DialectEntry,
  listDialects,
  listRecordings,
  Recording,
  recordingAudioUrl,
} from './api'
import { uploadFile } from './chunked-upload'
import { contiguousChunkCount, formatDuration } from './format'
import { RecordingLanguages } from './languages'
import PromptText from './prompt-text'

import './stories.css'

const InterruptedUpload = ({
  recording,
  onChange,
}: {
  recording: Recording
  onChange: () => void
}) => {
  const { l10n } = useLocalization()
  const [progress, setProgress] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const savePartial = async () => {
    try {
      const { uploaded_chunks = [] } = await getRecording(recording.id)
      await completeRecording(
        recording.id,
        contiguousChunkCount(uploaded_chunks)
      )
      onChange()
    } catch (e) {
      setError(e.message)
    }
  }

  const resume = async (file: File) => {
    try {
      setProgress(0)
      await uploadFile(recording.id, file, setProgress)
      onChange()
    } catch (e) {
      setError(e.message)
      setProgress(null)
    }
  }

  return (
    <div className="fork-stories__interrupted">
      {recording.source === 'browser' ? (
        <Localized id="fork-stories-save-partial">
          <Button rounded outline onClick={savePartial} />
        </Localized>
      ) : progress === null ? (
        <LabeledInput
          type="file"
          accept="audio/*,video/*"
          label={l10n.getString('fork-stories-resume-upload')}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            resume(event.target.files[0])
          }
        />
      ) : (
        <Localized
          id="fork-upload-progress"
          vars={{ percent: Math.floor(progress * 100) }}>
          <span />
        </Localized>
      )}
      {error && (
        <Localized id="fork-error" vars={{ message: error }}>
          <p className="fork-stories__error" />
        </Localized>
      )}
    </div>
  )
}

const RecordingCard = ({
  recording,
  onChange,
}: {
  recording: Recording
  onChange: () => void
}) => (
  <li className="fork-stories__card">
    <h2>
      {recording.status === 'ready' ? (
        <LocaleLink to={FORK_URLS.STORY + recording.id}>
          {recording.title}
        </LocaleLink>
      ) : (
        recording.title
      )}
    </h2>
    <p className="fork-stories__meta">
      {recording.speakers.map(speaker => speaker.display_name).join(', ')}
      {' · '}
      <RecordingLanguages languages={recording.languages} />
      {recording.dialects.length > 0 &&
        ` · ${recording.dialects.map(d => d.name).join(', ')}`}
      {recording.recorded_on && (
        <>
          {' · '}
          <Localized
            id="fork-stories-recorded-on"
            vars={{ date: recording.recorded_on }}>
            <span />
          </Localized>
        </>
      )}
      {recording.location && (
        <>
          {' · '}
          <Localized
            id="fork-stories-location"
            vars={{ location: recording.location }}>
            <span />
          </Localized>
        </>
      )}
      {recording.duration_ms !== null && (
        <>
          {' · '}
          <Localized
            id="fork-stories-duration"
            vars={{ duration: formatDuration(recording.duration_ms) }}>
            <span />
          </Localized>
        </>
      )}
    </p>
    {recording.prompt && (
      <p className="fork-stories__meta">
        <Localized id="fork-stories-prompt">
          <span />
        </Localized>{' '}
        <PromptText prompt={recording.prompt} />
      </p>
    )}
    {recording.description && <p>{recording.description}</p>}

    {recording.status === 'ready' && (
      <>
        {recording.progress.segments > 0 && (
          <Localized
            id="fork-stories-progress"
            vars={{
              segments: recording.progress.segments,
              latin: recording.progress.transcription_latin,
              kana: recording.progress.transcription_kana,
              japanese: recording.progress.transcription_ja,
              translated: recording.progress.translation_ja,
            }}>
            <p className="fork-stories__meta" />
          </Localized>
        )}
        {recording.progress.approved + recording.progress.needs_work > 0 && (
          <Localized
            id="fork-stories-review-progress"
            vars={{
              approved: recording.progress.approved,
              needsWork: recording.progress.needs_work,
            }}>
            <p className="fork-stories__meta" />
          </Localized>
        )}
        <audio
          controls
          preload="none"
          src={recordingAudioUrl(recording.id)}
          className="fork-stories__audio"
        />
        <div className="fork-stories__card-actions">
          <Localized id="fork-stories-transcribe">
            <LinkButton rounded outline to={FORK_URLS.STORY + recording.id} />
          </Localized>
          {recording.can_manage && (
            <Localized id="fork-stories-download-original">
              <a href={recordingAudioUrl(recording.id, true)} />
            </Localized>
          )}
        </div>
      </>
    )}
    {recording.status === 'processing' && (
      <Localized id="fork-stories-status-processing">
        <p className="fork-stories__status" />
      </Localized>
    )}
    {recording.status === 'failed' && (
      <Localized id="fork-stories-status-failed">
        <p className="fork-stories__error" />
      </Localized>
    )}
    {recording.status === 'uploading' && (
      <>
        <Localized id="fork-stories-status-uploading">
          <p className="fork-stories__status" />
        </Localized>
        {recording.is_mine && (
          <InterruptedUpload recording={recording} onChange={onChange} />
        )}
      </>
    )}
  </li>
)

const StoriesPage = () => {
  const { l10n } = useLocalization()
  const [mine, setMine] = React.useState(false)
  const [dialectId, setDialectId] = React.useState<number | null>(null)
  const [dialects, setDialects] = React.useState<DialectEntry[]>([])
  const [recordings, setRecordings] = React.useState<Recording[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    listRecordings(mine, dialectId)
      .then(setRecordings)
      .catch(e => setError(e.message))
  }, [mine, dialectId])

  React.useEffect(load, [load])
  React.useEffect(() => {
    listDialects()
      .then(all => setDialects(all.filter(d => d.recordings > 0)))
      .catch((): null => null)
  }, [])

  return (
    <Page className="fork-stories" isCentered>
      <PageHeading>
        <Localized id="fork-stories-title" />
      </PageHeading>
      <div className="fork-stories__actions">
        <Localized id="fork-stories-new">
          <LinkButton rounded to={FORK_URLS.STORIES_NEW} />
        </Localized>
        <Localized id="fork-stories-speakers">
          <LinkButton rounded outline to={FORK_URLS.SPEAKERS} />
        </Localized>
        <span className="fork-stories__filter">
          <Localized id="fork-stories-filter-all">
            <Button
              outline={mine}
              rounded
              onClick={() => setMine(false)}
              aria-pressed={!mine}
            />
          </Localized>
          <Localized id="fork-stories-filter-mine">
            <Button
              outline={!mine}
              rounded
              onClick={() => setMine(true)}
              aria-pressed={mine}
            />
          </Localized>
        </span>
      </div>
      {dialects.length > 0 && (
        <LabeledSelect
          className="fork-stories__dialect-filter"
          label={l10n.getString('fork-stories-filter-dialect')}
          value={dialectId ?? ''}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
            setDialectId(Number(event.target.value) || null)
          }>
          <option value="">
            {l10n.getString('fork-stories-all-dialects')}
          </option>
          {dialects.map(dialect => (
            <option key={dialect.id} value={dialect.id}>
              {dialect.name}
            </option>
          ))}
        </LabeledSelect>
      )}

      {error && (
        <Localized id="fork-error" vars={{ message: error }}>
          <p className="fork-stories__error" />
        </Localized>
      )}
      {!recordings && !error && <Spinner />}
      {recordings?.length === 0 && (
        <Localized id="fork-stories-empty">
          <p />
        </Localized>
      )}
      <ul className="fork-stories__list">
        {recordings?.map(recording => (
          <RecordingCard
            key={recording.id}
            recording={recording}
            onChange={load}
          />
        ))}
      </ul>
    </Page>
  )
}

export default StoriesPage
