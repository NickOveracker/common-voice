import * as React from 'react'
import { Localized, useLocalization } from '@fluent/react'

import Page from '../../components/ui/page'
import PageHeading from '../../components/ui/page-heading'
import {
  Button,
  LabeledInput,
  LinkButton,
  Spinner,
} from '../../components/ui/ui'
import FORK_URLS from '../urls'
import {
  completeRecording,
  getRecording,
  listRecordings,
  Recording,
  recordingAudioUrl,
} from './api'
import { uploadFile } from './chunked-upload'
import { contiguousChunkCount, formatDuration } from './format'
import { RecordingLanguages } from './languages'

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
    <h2>{recording.title}</h2>
    <p className="fork-stories__meta">
      {recording.speakers.map(speaker => speaker.display_name).join(', ')}
      {' · '}
      <RecordingLanguages languages={recording.languages} />
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
    {recording.description && <p>{recording.description}</p>}

    {recording.status === 'ready' && (
      <>
        <audio
          controls
          preload="none"
          src={recordingAudioUrl(recording.id)}
          className="fork-stories__audio"
        />
        {recording.can_manage && (
          <Localized id="fork-stories-download-original">
            <a href={recordingAudioUrl(recording.id, true)} />
          </Localized>
        )}
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
  const [mine, setMine] = React.useState(false)
  const [recordings, setRecordings] = React.useState<Recording[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    listRecordings(mine)
      .then(setRecordings)
      .catch(e => setError(e.message))
  }, [mine])

  React.useEffect(load, [load])

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
