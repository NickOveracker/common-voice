// Client for the stories API (server/src/fork/stories/routes.ts).

const BASE = '/api/v1/community'

export type Consent = {
  id: number
  archive: boolean
  community_use: boolean
  research: boolean
  speech_technology: boolean
  method: ConsentMethod
  given_on: string | null
  notes: string | null
  created_at: string
  withdrawn_at: string | null
}

export const CONSENT_METHODS = [
  'signed_form',
  'recorded_statement',
  'verbal',
  'family_or_community',
  'other',
] as const
export type ConsentMethod = typeof CONSENT_METHODS[number]

export type Speaker = {
  id: number
  display_name: string
  full_name: string | null
  birth_year: number | null
  gender: string | null
  region: string | null
  notes: string | null
  is_self: boolean
  can_manage: boolean
  consent: Consent | null
  consent_history?: Consent[]
}

export type SpeakerFields = Partial<
  Pick<
    Speaker,
    'display_name' | 'full_name' | 'birth_year' | 'gender' | 'region' | 'notes'
  >
>

export type RecordingLanguage = 'ain' | 'ja'

export type Recording = {
  id: number
  title: string
  description: string | null
  languages: RecordingLanguage[]
  source: 'browser' | 'upload'
  status: 'uploading' | 'processing' | 'ready' | 'failed'
  recorded_on: string | null
  location: string | null
  original_filename: string | null
  size_bytes: number
  duration_ms: number | null
  speakers: { id: number; display_name: string }[]
  created_at: string
  is_mine: boolean
  can_manage: boolean
  error: string | null
  uploaded_chunks?: number[]
  // Segments, and how many have text of each kind
  progress: { segments: number } & Record<TranscriptKind, number>
}

export type NewRecording = {
  title: string
  description?: string | null
  languages: RecordingLanguage[]
  speaker_ids: number[]
  source: 'browser' | 'upload'
  recorded_on?: string | null
  location?: string | null
  original_filename?: string | null
  original_mime?: string | null
}

export class StoriesApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly body: any = null
  ) {
    super(message)
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const isBinary = body instanceof Blob
  const response = await fetch(BASE + path, {
    method,
    credentials: 'same-origin',
    headers: isBinary
      ? { 'Content-Type': 'application/octet-stream' }
      : body === undefined
      ? {}
      : { 'Content-Type': 'application/json; charset=utf-8' },
    body: isBinary
      ? (body as Blob)
      : body === undefined
      ? undefined
      : JSON.stringify(body),
  })
  if (!response.ok) {
    const error = await response.json().catch((): null => null)
    throw new StoriesApiError(
      response.status,
      error?.message ?? response.statusText,
      error
    )
  }
  return response.status === 204 || response.status === 202
    ? (null as T)
    : response.json()
}

export const listSpeakers = () => request<Speaker[]>('GET', '/speakers')
export const getSpeaker = (id: number) =>
  request<Speaker>('GET', `/speakers/${id}`)
export const createSpeaker = (fields: SpeakerFields & { is_self?: boolean }) =>
  request<{ id: number }>('POST', '/speakers', fields)
export const updateSpeaker = (id: number, fields: SpeakerFields) =>
  request<null>('PATCH', `/speakers/${id}`, fields)
export const addConsent = (
  speakerId: number,
  consent: Omit<Consent, 'id' | 'created_at' | 'withdrawn_at'>
) => request<{ id: number }>('POST', `/speakers/${speakerId}/consents`, consent)
export const withdrawConsent = (speakerId: number, consentId: number) =>
  request<null>('POST', `/speakers/${speakerId}/consents/${consentId}/withdraw`)

export const listRecordings = (mine = false) =>
  request<Recording[]>('GET', `/recordings${mine ? '?mine=true' : ''}`)
export const getRecording = (id: number) =>
  request<Recording>('GET', `/recordings/${id}`)
export const createRecording = (recording: NewRecording) =>
  request<{ id: number }>('POST', '/recordings', recording)
export const uploadChunk = (recordingId: number, index: number, data: Blob) =>
  request<null>('PUT', `/recordings/${recordingId}/chunks/${index}`, data)
export const completeRecording = (recordingId: number, chunkCount: number) =>
  request<null>('POST', `/recordings/${recordingId}/complete`, {
    chunk_count: chunkCount,
  })
export const recordingAudioUrl = (id: number, original = false) =>
  `${BASE}/recordings/${id}/audio${original ? '?original=true' : ''}`

// Ainu is transcribed in Latin letters and in katakana (Japanese passages
// within them in Japanese); Japanese-only segments get transcription_ja
export const TRANSCRIPT_KINDS = [
  'transcription_latin',
  'transcription_kana',
  'transcription_ja',
  'translation_ja',
  'translation_en',
] as const
export type TranscriptKind = typeof TRANSCRIPT_KINDS[number]

export type Transcript = {
  id: number
  text: string
  created_at: string
  is_mine: boolean
}

export type Segment = {
  id: number
  start_ms: number
  end_ms: number
  speaker_id: number | null
  // null: as the recording
  languages: RecordingLanguage[] | null
} & Record<TranscriptKind, Transcript | null>

export const listSegments = (recordingId: number) =>
  request<Segment[]>('GET', `/recordings/${recordingId}/segments`)
export const detectSegments = (recordingId: number) =>
  request<null>('POST', `/recordings/${recordingId}/segments/detect`)
export const updateSegment = (
  id: number,
  changes: {
    speaker_id?: number | null
    languages?: RecordingLanguage[] | null
    end_ms?: number
  }
) => request<Segment[]>('PATCH', `/segments/${id}`, changes)
export const splitSegment = (id: number, atMs: number) =>
  request<Segment[]>('POST', `/segments/${id}/split`, { at_ms: atMs })
export const mergeSegment = (id: number) =>
  request<Segment[]>('POST', `/segments/${id}/merge`)

// Throws StoriesApiError 409 with body.current when someone else saved a
// version since baseId
export const addTranscript = (
  segmentId: number,
  transcript: {
    kind: TranscriptKind
    text: string
    base_id: number | null
  }
) =>
  request<Transcript>('POST', `/segments/${segmentId}/transcripts`, transcript)
