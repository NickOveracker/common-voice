import * as React from 'react'
import { Localized, useLocalization } from '@fluent/react'

import Page from '../../components/ui/page'
import PageHeading from '../../components/ui/page-heading'
import {
  Button,
  LabeledCheckbox,
  LabeledInput,
  LabeledSelect,
  LabeledTextArea,
  LinkButton,
  Spinner,
} from '../../components/ui/ui'
import FORK_URLS from '../urls'
import {
  createRecording,
  listPrompts,
  listSpeakers,
  Prompt,
  RecordingLanguage,
  Speaker,
} from './api'
import { uploadFile } from './chunked-upload'
import { formatDuration } from './format'
import { ChunkedRecorder, RecorderState, supportedMimeType } from './recorder'

import './stories.css'

type Details = {
  title: string
  description: string
  languages: RecordingLanguage[]
  speakerIds: number[]
  recordedOn: string
  location: string
  promptId: number | null
}

const RECORDED_ON_PATTERN =
  '[0-9]{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?)?'

const Hint = ({ id }: { id: string }) => (
  <Localized id={id}>
    <p className="fork-stories__hint" />
  </Localized>
)

const ErrorMessage = ({ message }: { message: string }) => (
  <Localized id="fork-error" vars={{ message }}>
    <p className="fork-stories__error" role="alert" />
  </Localized>
)

const DetailsForm = ({
  onSubmit,
}: {
  onSubmit: (
    details: Details,
    source: 'browser' | 'upload',
    file?: File
  ) => void
}) => {
  const { l10n } = useLocalization()
  const [speakers, setSpeakers] = React.useState<Speaker[] | null>(null)
  const [prompts, setPrompts] = React.useState<Prompt[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [details, setDetails] = React.useState<Details>(() => ({
    title: '',
    description: '',
    languages: ['ain'],
    speakerIds: [],
    recordedOn: '',
    location: '',
    // Chosen on the prompts page
    promptId:
      Number(new URLSearchParams(window.location.search).get('prompt')) || null,
  }))
  const [file, setFile] = React.useState<File | null>(null)
  const canRecordRef = React.useRef(supportedMimeType() !== null)

  React.useEffect(() => {
    listSpeakers()
      .then(all => setSpeakers(all.filter(speaker => speaker.can_manage)))
      .catch(e => setError(e.message))
    listPrompts()
      .then(all => setPrompts(all.filter(p => p.status === 'approved')))
      .catch((): null => null)
  }, [])

  const set = (changes: Partial<Details>) =>
    setDetails(previous => ({ ...previous, ...changes }))

  const toggle = <T,>(list: T[], item: T, on: boolean) =>
    on ? [...list.filter(i => i !== item), item] : list.filter(i => i !== item)

  const isValid =
    details.title.trim() &&
    details.languages.length > 0 &&
    details.speakerIds.length > 0

  if (!speakers && !error) return <Spinner />

  return (
    <form
      className="fork-stories__form"
      onSubmit={event => event.preventDefault()}>
      <Localized id="fork-new-details">
        <h2 />
      </Localized>
      {error && <ErrorMessage message={error} />}

      <LabeledInput
        label={l10n.getString('fork-new-field-title')}
        required
        maxLength={255}
        value={details.title}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          set({ title: event.target.value })
        }
      />
      <LabeledTextArea
        label={l10n.getString('fork-new-field-description')}
        value={details.description}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
          set({ description: event.target.value })
        }
      />
      {prompts.length > 0 && (
        <LabeledSelect
          label={l10n.getString('fork-new-field-prompt')}
          value={details.promptId ?? ''}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
            set({ promptId: Number(event.target.value) || null })
          }>
          <option value="">{l10n.getString('fork-new-no-prompt')}</option>
          {prompts.map(prompt => (
            <option key={prompt.id} value={prompt.id}>
              {prompt.text_ja}
              {prompt.text_ain ? ` / ${prompt.text_ain}` : ''}
            </option>
          ))}
        </LabeledSelect>
      )}

      <fieldset>
        <Localized id="fork-new-field-languages">
          <legend />
        </Localized>
        {(['ain', 'ja'] as RecordingLanguage[]).map(language => (
          <LabeledCheckbox
            key={language}
            label={l10n.getString(language)}
            checked={details.languages.includes(language)}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              set({
                languages: toggle(
                  details.languages,
                  language,
                  event.target.checked
                ),
              })
            }
          />
        ))}
        <Hint id="fork-new-field-languages-hint" />
      </fieldset>

      <fieldset>
        <Localized id="fork-new-field-speakers">
          <legend />
        </Localized>
        {speakers?.length === 0 && (
          <Localized id="fork-new-no-speakers">
            <p />
          </Localized>
        )}
        {speakers?.map(speaker => (
          <LabeledCheckbox
            key={speaker.id}
            disabled={!speaker.consent?.archive}
            label={
              speaker.consent?.archive
                ? speaker.display_name
                : `${speaker.display_name} (${l10n.getString(
                    'fork-new-speaker-no-consent'
                  )})`
            }
            checked={details.speakerIds.includes(speaker.id)}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              set({
                speakerIds: toggle(
                  details.speakerIds,
                  speaker.id,
                  event.target.checked
                ),
              })
            }
          />
        ))}
        <Hint id="fork-new-field-speakers-hint" />
        <Localized id="fork-speakers-add">
          <LinkButton rounded outline to={FORK_URLS.SPEAKERS} />
        </Localized>
      </fieldset>

      <LabeledInput
        label={`${l10n.getString(
          'fork-new-field-recorded-on'
        )} ${l10n.getString('fork-optional')}`}
        pattern={RECORDED_ON_PATTERN}
        placeholder="1972-08-15"
        value={details.recordedOn}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          set({ recordedOn: event.target.value })
        }
      />
      <Hint id="fork-new-field-recorded-on-hint" />
      <LabeledInput
        label={`${l10n.getString('fork-new-field-location')} ${l10n.getString(
          'fork-optional'
        )}`}
        maxLength={255}
        value={details.location}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          set({ location: event.target.value })
        }
      />
      <Hint id="fork-new-field-location-hint" />

      <Localized id="fork-new-how">
        <h2 />
      </Localized>
      <div className="fork-stories__actions">
        {canRecordRef.current && (
          <Localized id="fork-new-record">
            <Button
              rounded
              disabled={!isValid}
              onClick={() => onSubmit(details, 'browser')}
            />
          </Localized>
        )}
      </div>
      <div className="fork-stories__upload">
        <LabeledInput
          type="file"
          accept="audio/*,video/*"
          label={l10n.getString('fork-upload-choose')}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setFile(event.target.files[0] ?? null)
          }
        />
        <Localized id="fork-new-upload">
          <Button
            rounded
            outline={canRecordRef.current}
            disabled={!isValid || !file}
            onClick={() => onSubmit(details, 'upload', file)}
          />
        </Localized>
      </div>
      {!canRecordRef.current && <Hint id="fork-recorder-unsupported" />}
    </form>
  )
}

const RecorderPanel = ({
  recordingId,
  onDone,
}: {
  recordingId: number
  onDone: () => void
}) => {
  const [status, setStatus] = React.useState({
    state: 'idle' as RecorderState,
    elapsedMs: 0,
    uploadedChunks: 0,
    pendingUploads: 0,
    error: null as Error | null,
  })
  const [error, setError] = React.useState<string | null>(null)
  const recorderRef = React.useRef<ChunkedRecorder | null>(null)

  React.useEffect(() => {
    recorderRef.current = new ChunkedRecorder(recordingId, setStatus)
    // Tick the timer while recording
    const timer = window.setInterval(() => {
      const recorder = recorderRef.current
      if (recorder) {
        setStatus(previous => ({
          ...previous,
          elapsedMs: recorder.elapsedMs(),
        }))
      }
    }, 500)
    return () => {
      window.clearInterval(timer)
      recorderRef.current?.abandon()
    }
  }, [recordingId])

  // Warn before closing the page mid-recording
  React.useEffect(() => {
    if (status.state === 'idle') return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [status.state])

  const run = (action: () => Promise<void> | void) => async () => {
    try {
      await action()
    } catch (e) {
      setError(e.message)
    }
  }

  const recorder = recorderRef.current
  return (
    <div className="fork-stories__recorder">
      <Hint id="fork-recorder-keep-open" />
      <p className="fork-stories__timer">
        <Localized
          id="fork-recorder-elapsed"
          vars={{ duration: formatDuration(status.elapsedMs) }}>
          <span />
        </Localized>
      </p>
      <p>
        <Localized
          id="fork-recorder-uploaded"
          vars={{ count: status.uploadedChunks }}>
          <span />
        </Localized>
        {status.pendingUploads > 0 && (
          <>
            {' '}
            <Localized id="fork-recorder-uploading">
              <span />
            </Localized>
          </>
        )}
      </p>
      <div className="fork-stories__actions">
        {status.state === 'idle' && (
          <Localized id="fork-recorder-start">
            <Button rounded onClick={run(() => recorder.start())} />
          </Localized>
        )}
        {status.state === 'recording' && (
          <Localized id="fork-recorder-pause">
            <Button rounded outline onClick={run(() => recorder.pause())} />
          </Localized>
        )}
        {status.state === 'paused' && (
          <Localized id="fork-recorder-resume">
            <Button rounded outline onClick={run(() => recorder.resume())} />
          </Localized>
        )}
        {(status.state === 'recording' || status.state === 'paused') && (
          <Localized id="fork-recorder-finish">
            <Button
              rounded
              onClick={run(async () => {
                await recorder.finish()
                onDone()
              })}
            />
          </Localized>
        )}
        {status.state === 'finishing' && (
          <Localized id="fork-recorder-finishing">
            <p />
          </Localized>
        )}
      </div>
      {(error || status.error) && (
        <ErrorMessage message={error ?? status.error.message} />
      )}
    </div>
  )
}

const UploadPanel = ({
  recordingId,
  file,
  onDone,
}: {
  recordingId: number
  file: File
  onDone: () => void
}) => {
  const [progress, setProgress] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)

  const upload = React.useCallback(async () => {
    try {
      setError(null)
      await uploadFile(recordingId, file, setProgress)
      onDone()
    } catch (e) {
      setError(e.message)
    }
  }, [recordingId, file])

  React.useEffect(() => {
    upload()
  }, [upload])

  return (
    <div className="fork-stories__upload">
      <p>{file.name}</p>
      <progress value={progress} max={1} />
      <Localized
        id="fork-upload-progress"
        vars={{ percent: Math.floor(progress * 100) }}>
        <p />
      </Localized>
      {error && (
        <>
          <ErrorMessage message={error} />
          <Localized id="fork-upload-start">
            <Button rounded onClick={upload} />
          </Localized>
        </>
      )}
    </div>
  )
}

type Step =
  | { name: 'details' }
  | { name: 'record'; recordingId: number }
  | { name: 'upload'; recordingId: number; file: File }
  | { name: 'done' }

const NewRecordingPage = () => {
  const [step, setStep] = React.useState<Step>({ name: 'details' })
  const [error, setError] = React.useState<string | null>(null)
  const create = async (
    details: Details,
    source: 'browser' | 'upload',
    file?: File
  ) => {
    try {
      setError(null)
      const { id } = await createRecording({
        title: details.title.trim(),
        description: details.description.trim() || null,
        languages: details.languages,
        speaker_ids: details.speakerIds,
        source,
        recorded_on: details.recordedOn.trim() || null,
        location: details.location.trim() || null,
        prompt_id: details.promptId,
        original_filename: file?.name ?? null,
        original_mime: file?.type || null,
      })
      setStep(
        source === 'upload'
          ? { name: 'upload', recordingId: id, file }
          : { name: 'record', recordingId: id }
      )
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Page className="fork-stories" isCentered>
      <PageHeading>
        <Localized id="fork-new-title" />
      </PageHeading>
      {error && <ErrorMessage message={error} />}
      {step.name === 'details' && <DetailsForm onSubmit={create} />}
      {step.name === 'record' && (
        <RecorderPanel
          recordingId={step.recordingId}
          onDone={() => setStep({ name: 'done' })}
        />
      )}
      {step.name === 'upload' && (
        <UploadPanel
          recordingId={step.recordingId}
          file={step.file}
          onDone={() => setStep({ name: 'done' })}
        />
      )}
      {step.name === 'done' && (
        <>
          <Localized id="fork-new-done">
            <p />
          </Localized>
          <Localized id="fork-new-back">
            <LinkButton rounded to={FORK_URLS.STORIES} />
          </Localized>
        </>
      )}
    </Page>
  )
}

export default NewRecordingPage
