import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { getMySQLInstance } from '../../lib/model/db/mysql'
import { hasRole } from '../roles'

// Speakers are the people whose voices are recorded. Facilitators create
// speakers for the elders they record; members can also create a speaker for
// themselves. Real names (full_name) are only shown to whoever created the
// speaker, the speaker themselves, and moderators.

const db = getMySQLInstance()

type SessionUser = { client_id: string; email: string }

export type Consent = {
  id: number
  archive: boolean
  community_use: boolean
  research: boolean
  speech_technology: boolean
  method: string
  given_on: string | null
  notes: string | null
  created_at: string
  withdrawn_at: string | null
}

type SpeakerRow = {
  id: number
  display_name: string
  full_name: string | null
  birth_year: number | null
  gender: string | null
  region: string | null
  notes: string | null
  client_id: string | null
  created_by: string | null
}

const SPEAKER_FIELDS = [
  'display_name',
  'full_name',
  'birth_year',
  'gender',
  'region',
  'notes',
] as const

async function findSpeaker(id: number): Promise<SpeakerRow | undefined> {
  const [[row]] = await db.query(`SELECT * FROM fork_speakers WHERE id = ?`, [
    id,
  ])
  return row
}

// Who may edit a speaker, add consent and record them.
export async function canManageSpeaker(
  user: SessionUser,
  speaker: Pick<SpeakerRow, 'client_id' | 'created_by'>
): Promise<boolean> {
  return (
    speaker.created_by === user.client_id ||
    speaker.client_id === user.client_id ||
    (await hasRole(user, 'moderator'))
  )
}

// The consent that applies now: the latest one that hasn't been withdrawn.
export async function currentConsents(
  speakerIds: number[]
): Promise<Map<number, Consent>> {
  const consents = new Map<number, Consent>()
  if (speakerIds.length === 0) return consents

  const [rows] = await db.query(
    `
    SELECT c.* FROM fork_consents c
    WHERE c.speaker_id IN (?) AND c.withdrawn_at IS NULL
    ORDER BY c.created_at DESC, c.id DESC
    `,
    [speakerIds]
  )
  for (const row of rows) {
    if (!consents.has(row.speaker_id))
      consents.set(row.speaker_id, toConsent(row))
  }
  return consents
}

// MySQL returns TINYINT(1) as numbers
type ConsentRow = Omit<
  Consent,
  'archive' | 'community_use' | 'research' | 'speech_technology'
> & {
  archive: number
  community_use: number
  research: number
  speech_technology: number
}

function toConsent(row: ConsentRow): Consent {
  return {
    id: row.id,
    archive: Boolean(row.archive),
    community_use: Boolean(row.community_use),
    research: Boolean(row.research),
    speech_technology: Boolean(row.speech_technology),
    method: row.method,
    given_on: row.given_on,
    notes: row.notes,
    created_at: row.created_at,
    withdrawn_at: row.withdrawn_at,
  }
}

async function presentSpeaker(
  user: SessionUser,
  row: SpeakerRow,
  consent: Consent | undefined
) {
  const canManage = await canManageSpeaker(user, row)
  return {
    id: row.id,
    display_name: row.display_name,
    birth_year: row.birth_year,
    gender: row.gender,
    region: row.region,
    is_self: row.client_id === user.client_id,
    can_manage: canManage,
    consent: consent ?? null,
    ...(canManage
      ? { full_name: row.full_name, notes: row.notes }
      : { full_name: null, notes: null }),
  }
}

export const listSpeakers = async (request: Request, response: Response) => {
  const user = request.session.user
  const [rows] = await db.query(
    `SELECT * FROM fork_speakers ORDER BY display_name, id`
  )
  const consents = await currentConsents(rows.map((row: SpeakerRow) => row.id))
  response.json(
    await Promise.all(
      rows.map((row: SpeakerRow) =>
        presentSpeaker(user, row, consents.get(row.id))
      )
    )
  )
}

export const getSpeaker = async (request: Request, response: Response) => {
  const user = request.session.user
  const speaker = await findSpeaker(Number(request.params.speakerId))
  if (!speaker) return response.sendStatus(StatusCodes.NOT_FOUND)

  const [consentRows] = await db.query(
    `SELECT * FROM fork_consents WHERE speaker_id = ? ORDER BY created_at DESC, id DESC`,
    [speaker.id]
  )
  const consents = (await currentConsents([speaker.id])).get(speaker.id)
  response.json({
    ...(await presentSpeaker(user, speaker, consents)),
    // Full consent history only for those who manage the speaker
    consent_history: (await canManageSpeaker(user, speaker))
      ? consentRows.map(toConsent)
      : [],
  })
}

export const createSpeaker = async (request: Request, response: Response) => {
  const user = request.session.user
  const { is_self, ...fields } = request.body

  if (is_self) {
    const [[existing]] = await db.query(
      `SELECT id FROM fork_speakers WHERE client_id = ?`,
      [user.client_id]
    )
    if (existing) {
      return response.status(StatusCodes.CONFLICT).json({
        message: 'you already have a speaker profile',
        id: existing.id,
      })
    }
  }

  const [result] = await db.query(`INSERT INTO fork_speakers SET ?`, [
    {
      ...pick(fields, SPEAKER_FIELDS),
      client_id: is_self ? user.client_id : null,
      created_by: user.client_id,
    },
  ])
  response.status(StatusCodes.CREATED).json({ id: result.insertId })
}

export const updateSpeaker = async (request: Request, response: Response) => {
  const user = request.session.user
  const speaker = await findSpeaker(Number(request.params.speakerId))
  if (!speaker) return response.sendStatus(StatusCodes.NOT_FOUND)
  if (!(await canManageSpeaker(user, speaker))) {
    return response.sendStatus(StatusCodes.FORBIDDEN)
  }

  await db.query(`UPDATE fork_speakers SET ? WHERE id = ?`, [
    pick(request.body, SPEAKER_FIELDS),
    speaker.id,
  ])
  response.sendStatus(StatusCodes.NO_CONTENT)
}

export const addConsent = async (request: Request, response: Response) => {
  const user = request.session.user
  const speaker = await findSpeaker(Number(request.params.speakerId))
  if (!speaker) return response.sendStatus(StatusCodes.NOT_FOUND)
  if (!(await canManageSpeaker(user, speaker))) {
    return response.sendStatus(StatusCodes.FORBIDDEN)
  }

  const { archive, community_use, research, speech_technology } = request.body
  const [result] = await db.query(`INSERT INTO fork_consents SET ?`, [
    {
      speaker_id: speaker.id,
      archive,
      community_use,
      research,
      speech_technology,
      method: request.body.method,
      given_on: request.body.given_on ?? null,
      notes: request.body.notes ?? null,
      recorded_by: user.client_id,
    },
  ])
  response.status(StatusCodes.CREATED).json({ id: result.insertId })
}

export const withdrawConsent = async (request: Request, response: Response) => {
  const user = request.session.user
  const speaker = await findSpeaker(Number(request.params.speakerId))
  if (!speaker) return response.sendStatus(StatusCodes.NOT_FOUND)
  if (!(await canManageSpeaker(user, speaker))) {
    return response.sendStatus(StatusCodes.FORBIDDEN)
  }

  const [result] = await db.query(
    `
    UPDATE fork_consents SET withdrawn_at = NOW(), withdrawn_by = ?
    WHERE id = ? AND speaker_id = ? AND withdrawn_at IS NULL
    `,
    [user.client_id, Number(request.params.consentId), speaker.id]
  )
  response.sendStatus(
    result.affectedRows ? StatusCodes.NO_CONTENT : StatusCodes.NOT_FOUND
  )
}

function pick<T extends object, K extends readonly string[]>(
  object: T,
  keys: K
): Partial<T> {
  return Object.fromEntries(
    Object.entries(object).filter(([key]) => keys.includes(key))
  ) as Partial<T>
}
