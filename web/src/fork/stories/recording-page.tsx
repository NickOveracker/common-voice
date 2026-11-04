import * as React from 'react'
import { useParams } from 'react-router'
import { Localized, useLocalization } from '@fluent/react'

import Page from '../../components/ui/page'
import PageHeading from '../../components/ui/page-heading'
import {
  Button,
  LabeledCheckbox,
  LabeledSelect,
  Spinner,
} from '../../components/ui/ui'
import { LocaleLink } from '../../components/locale-helpers'
import FORK_URLS from '../urls'
import {
  addTranscript,
  detectSegments,
  getOwnRoles,
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
  TranscriptKind,
  updateSegment,
} from './api'
import { formatDuration, formatTime } from './format'
import { RecordingLanguages } from './languages'
import TranscriptField from './transcript-field'
import ReportForm from './report-form'
import { Player, PLAYBACK_RATES, SKIP_MS, usePlayer } from './player'

import './stories.css'

// A recording's segments, to transcribe and translate while listening.

const LANGUAGES: RecordingLanguage[] = ['ain', 'ja']

// Shortest segment a split or boundary move may leave (as on the server)
const MIN_SEGMENT_MS = 200

const FIELDS: Record<TranscriptKind, { label: string; lang: string }> = {
  transcription_latin: {
    label: 'fork-transcribe-transcription-latin',
    lang: 'ain-Latn',
  },
  transcription_kana: {
    label: 'fork-transcribe-transcription-kana',
    lang: 'ain-Kana',
  },
  transcription_ja: { label: 'fork-transcribe-transcription-ja', lang: 'ja' },
  translation_ja: { label: 'fork-transcribe-translation-ja', lang: 'ja' },
  translation_en: { label: 'fork-transcribe-translation-en', lang: 'en' },
}

// Ainu is transcribed in Latin letters and in katakana, and translated into
// Japanese; Japanese-only speech just gets a Japanese transcription. Fields
// with text are shown regardless, so nothing is hidden when the languages
// change.
const kindsToShow = (
  languages: RecordingLanguage[],
  drafts: Drafts,
  showEnglish: boolean
) =>
  TRANSCRIPT_KINDS.filter(kind => {
    const relevant = {
      transcription_latin: languages.includes('ain'),
      transcription_kana: languages.includes('ain'),
      transcription_ja: !languages.includes('ain'),
      translation_ja: languages.includes('ain'),
      translation_en: showEnglish,
    }[kind]
    return relevant || drafts[kind].text !== ''
  })

type Draft = {
  text: string
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
        baseId: segment[kind]?.id ?? null,
      },
    ])
  ) as Drafts

const isDirty = (segment: Segment, drafts: Drafts) =>
  TRANSCRIPT_KINDS.some(
    kind => drafts[kind].text !== (segment[kind]?.text ?? '')
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
  canReview,
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
  canReview: boolean
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
      const unchanged = draft.text === (segment[kind]?.text ?? '')
      if (unchanged && draft.baseId === (segment[kind]?.id ?? null)) continue
      try {
        const transcript = await addTranscript(segment.id, {
          kind,
          text: draft.text,
          base_id: draft.baseId,
        })
        updated = { ...updated, [kind]: transcript }
        next[kind] = {
          text: transcript.text,
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
        {kindsToShow(languages, drafts, showEnglish).map(kind => (
          <TranscriptField
            key={kind}
            segmentId={segment.id}
            kind={kind}
            label={l10n.getString(FIELDS[kind].label)}
            lang={FIELDS[kind].lang}
            text={drafts[kind].text}
            current={segment[kind]}
            dirty={drafts[kind].text !== (segment[kind]?.text ?? '')}
            canReview={canReview}
            onChange={text => setDraft(kind, { text })}
            onReviewed={transcript =>
              onSaved({ ...segment, [kind]: transcript })
            }
          />
        ))}
        {!showEnglish && !drafts.translation_en.text && (
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
            field: l10n.getString(FIELDS[kind as TranscriptKind].label),
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

// Has text that no reviewer has approved yet
const needsChecking = (segment: Segment) =>
  TRANSCRIPT_KINDS.some(
    kind => segment[kind]?.text && segment[kind].review?.verdict !== 'approved'
  )

const Transcriber = ({
  recording,
  initialSegments,
  canReview,
}: {
  recording: Recording
  initialSegments: Segment[]
  canReview: boolean
}) => {
  const { l10n } = useLocalization()
  const player = usePlayer()
  const [onlyUnchecked, setOnlyUnchecked] = React.useState(false)
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
      {recording.languages.includes('ain') && (
        <Localized id="fork-transcribe-japanese-within">
          <p className="fork-stories__hint" />
        </Localized>
      )}
      <LabeledCheckbox
        label={l10n.getString('fork-review-filter')}
        checked={onlyUnchecked}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          setOnlyUnchecked(event.target.checked)
        }
      />
      <ol className="fork-transcribe__segments">
        {segments.map((segment, index) =>
          onlyUnchecked && !needsChecking(segment) ? null : (
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
              canReview={canReview}
            />
          )
        )}
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
  const [canReview, setCanReview] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const id = Number(recordingId)
    Promise.all([getRecording(id), listSegments(id), getOwnRoles()])
      .then(([recording, segments, { roles }]) => {
        setRecording(recording)
        setSegments(segments)
        // Every role includes reviewing
        setCanReview(roles.length > 0)
      })
      .catch(e => setError(e.message))
  }, [recordingId])

  return (
    <Page className="fork-stories fork-transcribe" isCentered>
      <Localized id="fork-transcribe-back-to-stories">
        <LocaleLink
          className="fork-transcribe__back-link"
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
          <ReportForm recordingId={recording.id} segments={segments ?? []} />
          {segments && segments.length > 0 ? (
            <Transcriber
              recording={recording}
              initialSegments={segments}
              canReview={canReview}
            />
          ) : (
            <NoSegments recording={recording} onDetected={setSegments} />
          )}
        </>
      )}
    </Page>
  )
}

export default RecordingPage
