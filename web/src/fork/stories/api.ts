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
  constructor(readonly status: number, message: string) {
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
      error?.message ?? response.statusText
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
  request<null>(
    'POST',
    `/speakers/${speakerId}/consents/${consentId}/withdraw`
  )

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
