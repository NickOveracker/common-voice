import * as React from 'react'
import { useParams } from 'react-router'
import { Localized, useLocalization } from '@fluent/react'

import Page from '../../components/ui/page'
import PageHeading from '../../components/ui/page-heading'
import {
  Button,
  LabeledCheckbox,
  LabeledSelect,
  LabeledTextArea,
  LinkButton,
  Spinner,
} from '../../components/ui/ui'
import FORK_URLS from '../urls'
import {
  addTranscript,
  detectSegments,
  getRecording,
  listSegments,
  mergeSegment,
  Recording,
  recordingAudioUrl,
  RecordingLanguage,
  Segment,
  splitSegment,
  StoriesApiError,
  Transcript,
  TRANSCRIPT_KINDS,
  TRANSCRIPT_SCRIPTS,
  TranscriptKind,
  TranscriptScript,
  updateSegment,
} from './api'
import { formatDuration, formatTime } from './format'
import { RecordingLanguages } from './languages'
import { Player, PLAYBACK_RATES, SKIP_MS, usePlayer } from './player'

import './stories.css'

// A recording's segments, to transcribe and translate while listening.

const LANGUAGES: RecordingLanguage[] = ['ain', 'ja']

// Shortest segment a split or boundary move may leave (as on the server)
const MIN_SEGMENT_MS = 200

const LABELS: Record<TranscriptKind, string> = {
  transcription: 'fork-transcribe-transcription',
  translation_ja: 'fork-transcribe-translation-ja',
  translation_en: 'fork-transcribe-translation-en',
}

type Draft = {
  text: string
  script: TranscriptScript | null
  // The version this draft started from
  baseId: number | null
}

type Drafts = Record<TranscriptKind, Draft>

const draftsFor = (segment: Segment): Drafts =>
  Object.fromEntries(
    TRANSCRIPT_KINDS.map(kind => [
      kind,
      {
        text: segment[kind]?.text ?? '',
        script: segment[kind]?.script ?? null,
        baseId: segment[kind]?.id ?? null,
      },
    ])
  ) as Drafts

const isDirty = (segment: Segment, drafts: Drafts) =>
  TRANSCRIPT_KINDS.some(
    kind =>
      drafts[kind].text !== (segment[kind]?.text ?? '') ||
      (kind === 'transcription' &&
        drafts[kind].script !== (segment[kind]?.script ?? null))
  )

const ErrorMessage = ({ message }: { message: string }) => (
  <Localized id="fork-error" vars={{ message }}>
    <p className="fork-stories__error" role="alert" />
  </Localized>
)

const PlayerBar = ({
  player,
  durationMs,
}: {
  player: Player
  durationMs: number
}) => {
  const { l10n } = useLocalization()
  return (
    <div className="fork-transcribe__player">
      <Button
        rounded
        onClick={player.toggle}
        aria-label={l10n.getString(
          player.playing ? 'fork-transcribe-pause' : 'fork-transcribe-play'
        )}>
        {player.playing ? '❚❚' : '▶'}
      </Button>
      <Localized id="fork-transcribe-back" vars={{ seconds: SKIP_MS / 1000 }}>
        <Button rounded outline onClick={() => player.skip(-SKIP_MS)} />
      </Localized>
      <Localized
        id="fork-transcribe-forward"
        vars={{ seconds: SKIP_MS / 1000 }}>
        <Button rounded outline onClick={() => player.skip(SKIP_MS)} />
      </Localized>
      <span className="fork-transcribe__time" aria-live="off">
        {formatTime(player.timeMs)} / {formatTime(durationMs)}
      </span>
      <LabeledSelect
        label={l10n.getString('fork-transcribe-speed')}
        value={String(player.rate)}
        onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
          player.setRate(Number(event.target.value))
        }>
        {PLAYBACK_RATES.map(rate => (
          <option key={rate} value={rate}>
            {rate}×
          </option>
        ))}
      </LabeledSelect>
      <LabeledCheckbox
        label={l10n.getString('fork-transcribe-loop')}
        checked={player.loop}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          player.setLoop(event.target.checked)
        }
      />
    </div>
  )
}

const SegmentRow = ({
  index,
  segment,
  isLast,
  recording,
  drafts,
  setDrafts,
  player,
  onSegments,
  onSaved,
}: {
  index: number
  segment: Segment
  isLast: boolean
  recording: Recording
  drafts: Drafts
  setDrafts: (drafts: Drafts) => void
  player: Player
  onSegments: (segments: Segment[]) => void
  onSaved: (segment: Segment) => void
}) => {
  const { l10n } = useLocalization()
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [conflicts, setConflicts] = React.useState<
    Partial<Record<TranscriptKind, Transcript | null>>
  >({})
  const [showEnglish, setShowEnglish] = React.useState(
    Boolean(segment.translation_en?.text)
  )

  const dirty = isDirty(segment, drafts)
  const active =
    player.timeMs >= segment.start_ms && player.timeMs < segment.end_ms
  const playingThis =
    player.playing &&
    player.bounds?.start_ms === segment.start_ms &&
    player.bounds?.end_ms === segment.end_ms
  const languages = segment.languages ?? recording.languages

  const setDraft = (kind: TranscriptKind, change: Partial<Draft>) => {
    setSaved(false)
    setDrafts({ ...drafts, [kind]: { ...drafts[kind], ...change } })
  }

  const run = async (action: () => Promise<Segment[]>) => {
    setError(null)
    try {
      onSegments(await action())
    } catch (e) {
      setError(e.message)
    }
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    const found: typeof conflicts = {}
    const next = { ...drafts }
    let updated = segment
    for (const kind of TRANSCRIPT_KINDS) {
      const draft = drafts[kind]
      const unchanged =
        draft.text === (segment[kind]?.text ?? '') &&
        (kind !== 'transcription' ||
          draft.script === (segment[kind]?.script ?? null))
      if (unchanged && draft.baseId === (segment[kind]?.id ?? null)) continue
      try {
        const transcript = await addTranscript(segment.id, {
          kind,
          text: draft.text,
          script: kind === 'transcription' ? draft.script : null,
          base_id: draft.baseId,
        })
        updated = { ...updated, [kind]: transcript }
        next[kind] = {
          text: transcript.text,
          script: transcript.script,
          baseId: transcript.id,
        }
      } catch (e) {
        if (e instanceof StoriesApiError && e.status === 409) {
          // Keep this person's text; saving again replaces the other one
          found[kind] = e.body?.current ?? null
          next[kind] = { ...draft, baseId: e.body?.current?.id ?? null }
        } else {
          setError(e.message)
        }
      }
    }
    setConflicts(found)
    setDrafts(next)
    onSaved(updated)
    setSaving(false)
    setSaved(Object.keys(found).length === 0)
  }

  // Split or set the end where playback is now
  const canCutHere =
    player.timeMs > segment.start_ms + MIN_SEGMENT_MS &&
    player.timeMs < segment.end_ms - MIN_SEGMENT_MS

  return (
    <li
      className={
        'fork-transcribe__segment' +
        (active ? ' fork-transcribe__segment--active' : '')
      }
      data-segment-id={segment.id}>
      <div className="fork-transcribe__segment-head">
        <Button
          rounded
          outline={!playingThis}
          className="fork-transcribe__play"
          onClick={() => player.playSegment(segment)}
          aria-label={l10n.getString('fork-transcribe-play-segment', {
            number: index + 1,
          })}>
          {playingThis ? '❚❚' : '▶'}
        </Button>
        <span className="fork-transcribe__range">
          {index + 1}. {formatTime(segment.start_ms)} –{' '}
          {formatTime(segment.end_ms)}
        </span>
        <LabeledSelect
          label={l10n.getString('fork-transcribe-speaker')}
          value={segment.speaker_id ?? ''}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
            run(() =>
              updateSegment(segment.id, {
                speaker_id: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            )
          }>
          <option value="">
            {l10n.getString('fork-transcribe-speaker-unset')}
          </option>
          {recording.speakers.map(speaker => (
            <option key={speaker.id} value={speaker.id}>
              {speaker.display_name}
            </option>
          ))}
        </LabeledSelect>
        <span className="fork-transcribe__languages">
          {LANGUAGES.map(language => (
            <LabeledCheckbox
              key={language}
              label={l10n.getString(language)}
              checked={languages.includes(language)}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const chosen = event.target.checked
                  ? [...languages, language]
                  : languages.filter(l => l !== language)
                if (chosen.length > 0) {
                  run(() =>
                    updateSegment(segment.id, {
                      languages: LANGUAGES.filter(l => chosen.includes(l)),
                    })
                  )
                }
              }}
            />
          ))}
        </span>
      </div>

      <div className="fork-transcribe__texts">
        <div className="fork-transcribe__text">
          <LabeledTextArea
            label={l10n.getString(LABELS.transcription)}
            value={drafts.transcription.text}
            rows={2}
            lang={languages.length === 1 ? languages[0] : undefined}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
              setDraft('transcription', { text: event.target.value })
            }
          />
          <LabeledSelect
            label={l10n.getString('fork-transcribe-script')}
            value={drafts.transcription.script ?? ''}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
              setDraft('transcription', {
                script: (event.target.value || null) as TranscriptScript,
              })
            }>
            <option value="" />
            {TRANSCRIPT_SCRIPTS.map(script => (
              <option key={script} value={script}>
                {l10n.getString(`fork-transcribe-script-${script}`)}
              </option>
            ))}
          </LabeledSelect>
        </div>
        <LabeledTextArea
          label={l10n.getString(LABELS.translation_ja)}
          value={drafts.translation_ja.text}
          rows={2}
          lang="ja"
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
            setDraft('translation_ja', { text: event.target.value })
          }
        />
        {showEnglish ? (
          <LabeledTextArea
            label={l10n.getString(LABELS.translation_en)}
            value={drafts.translation_en.text}
            rows={2}
            lang="en"
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
              setDraft('translation_en', { text: event.target.value })
            }
          />
        ) : (
          <Localized id="fork-transcribe-add-english">
            <button
              type="button"
              className="fork-transcribe__link"
              onClick={() => setShowEnglish(true)}
            />
          </Localized>
        )}
      </div>

      {Object.entries(conflicts).map(([kind, current]) => (
        <Localized
          key={kind}
          id="fork-transcribe-conflict"
          vars={{
            field: l10n.getString(LABELS[kind as TranscriptKind]),
            text: current?.text || '—',
          }}>
          <p className="fork-stories__error" role="alert" />
        </Localized>
      ))}
      {error && <ErrorMessage message={error} />}

      <div className="fork-transcribe__actions">
        <Localized id="fork-save">
          <Button
            rounded
            disabled={saving || (!dirty && Object.keys(conflicts).length === 0)}
            onClick={save}
          />
        </Localized>
        {saved && !dirty && (
          <Localized id="fork-transcribe-saved">
            <span className="fork-stories__status" role="status" />
          </Localized>
        )}
        <span className="fork-transcribe__tools">
          <Localized id="fork-transcribe-split">
            <Button
              rounded
              outline
              disabled={!canCutHere || dirty}
              onClick={() =>
                run(() => splitSegment(segment.id, Math.round(player.timeMs)))
              }
            />
          </Localized>
          {!isLast && (
            <>
              <Localized id="fork-transcribe-end-here">
                <Button
                  rounded
                  outline
                  disabled={!canCutHere || dirty}
                  onClick={() =>
                    run(() =>
                      updateSegment(segment.id, {
                        end_ms: Math.round(player.timeMs),
                      })
                    )
                  }
                />
              </Localized>
              <Localized id="fork-transcribe-merge">
                <Button
                  rounded
                  outline
                  disabled={dirty}
                  onClick={() => run(() => mergeSegment(segment.id))}
                />
              </Localized>
            </>
          )}
        </span>
      </div>
    </li>
  )
}

const Transcriber = ({
  recording,
  initialSegments,
}: {
  recording: Recording
  initialSegments: Segment[]
}) => {
  const player = usePlayer()
  const [segments, setSegments] = React.useState(initialSegments)
  const [drafts, setDrafts] = React.useState<Record<number, Drafts>>(() =>
    Object.fromEntries(initialSegments.map(s => [s.id, draftsFor(s)]))
  )

  // After a split, merge or other change: the full new list. Unsaved drafts
  // of segments that still exist are kept.
  const onSegments = (next: Segment[]) => {
    setSegments(next)
    setDrafts(current =>
      Object.fromEntries(
        next.map(s => [
          s.id,
          current[s.id] && isDirty(s, current[s.id])
            ? current[s.id]
            : draftsFor(s),
        ])
      )
    )
  }

  const onSaved = (saved: Segment) =>
    onSegments(segments.map(s => (s.id === saved.id ? saved : s)))

  const dirty = segments.some(s => drafts[s.id] && isDirty(s, drafts[s.id]))
  React.useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Escape plays or pauses the segment being typed in. Not while an input
  // method is composing: there Escape cancels the composition.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.isComposing) return
    const row = (event.target as HTMLElement).closest('[data-segment-id]')
    const segment = segments.find(
      s => s.id === Number(row?.getAttribute('data-segment-id'))
    )
    if (!segment) return
    event.preventDefault()
    player.playSegment(segment)
  }
  const keyHandler = React.useRef(onKeyDown)
  keyHandler.current = onKeyDown
  const container = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const element = container.current
    const listener = (event: KeyboardEvent) => keyHandler.current(event)
    element?.addEventListener('keydown', listener)
    return () => element?.removeEventListener('keydown', listener)
  }, [])

  return (
    <div ref={container}>
      <audio
        ref={player.audioRef}
        src={recordingAudioUrl(recording.id)}
        preload="metadata"
      />
      <PlayerBar player={player} durationMs={recording.duration_ms ?? 0} />
      <Localized id="fork-transcribe-help">
        <p className="fork-stories__hint" />
      </Localized>
      <ol className="fork-transcribe__segments">
        {segments.map((segment, index) => (
          <SegmentRow
            key={segment.id}
            index={index}
            segment={segment}
            isLast={index === segments.length - 1}
            recording={recording}
            drafts={drafts[segment.id] ?? draftsFor(segment)}
            setDrafts={value =>
              setDrafts(current => ({ ...current, [segment.id]: value }))
            }
            player={player}
            onSegments={onSegments}
            onSaved={onSaved}
          />
        ))}
      </ol>
    </div>
  )
}

const NoSegments = ({
  recording,
  onDetected,
}: {
  recording: Recording
  onDetected: (segments: Segment[]) => void
}) => {
  const [detecting, setDetecting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const detect = async () => {
    setDetecting(true)
    setError(null)
    try {
      await detectSegments(recording.id)
      // Detection runs in the background; long recordings take a while
      for (let attempt = 0; attempt < 200; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        const segments = await listSegments(recording.id)
        if (segments.length > 0) return onDetected(segments)
      }
      setDetecting(false)
    } catch (e) {
      setError(e.message)
      setDetecting(false)
    }
  }

  return (
    <div className="fork-stories__card">
      <Localized id="fork-transcribe-no-segments">
        <p />
      </Localized>
      {recording.can_manage &&
        (detecting ? (
          <Localized id="fork-transcribe-detecting">
            <p className="fork-stories__status" role="status" />
          </Localized>
        ) : (
          <Localized id="fork-transcribe-detect">
            <Button rounded onClick={detect} />
          </Localized>
        ))}
      {error && <ErrorMessage message={error} />}
    </div>
  )
}

const RecordingPage = () => {
  const { recordingId } = useParams<{ recordingId: string }>()
  const [recording, setRecording] = React.useState<Recording | null>(null)
  const [segments, setSegments] = React.useState<Segment[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const id = Number(recordingId)
    Promise.all([getRecording(id), listSegments(id)])
      .then(([recording, segments]) => {
        setRecording(recording)
        setSegments(segments)
      })
      .catch(e => setError(e.message))
  }, [recordingId])

  return (
    <Page className="fork-stories fork-transcribe" isCentered>
      <Localized id="fork-transcribe-back-to-stories">
        <LinkButton
          rounded
          outline
          className="fork-transcribe__back"
          to={FORK_URLS.STORIES}
        />
      </Localized>
      {error && <ErrorMessage message={error} />}
      {!recording && !error && <Spinner />}
      {recording && (
        <>
          <PageHeading>{recording.title}</PageHeading>
          <p className="fork-stories__meta">
            {recording.speakers.map(s => s.display_name).join(', ')}
            {' · '}
            <RecordingLanguages languages={recording.languages} />
            {recording.recorded_on && ` · ${recording.recorded_on}`}
            {recording.location && ` · ${recording.location}`}
            {' · '}
            {formatDuration(recording.duration_ms)}
          </p>
          {recording.description && <p>{recording.description}</p>}
          {segments && segments.length > 0 ? (
            <Transcriber recording={recording} initialSegments={segments} />
          ) : (
            <NoSegments recording={recording} onDetected={setSegments} />
          )}
        </>
      )}
    </Page>
  )
}

export default RecordingPage
