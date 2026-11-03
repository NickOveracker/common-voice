import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { getMySQLInstance } from '../../lib/model/db/mysql'
import { hasRole } from '../roles'
import { queueSegmentDetection } from './processing'
import { TRANSCRIPT_KINDS } from './schemas'
import { withTransaction } from './transaction'

// Segments of a recording, and their transcriptions and translations.
// Anyone signed in can transcribe, translate and adjust segments; every
// transcript is kept as a new version (see the migration).

type Kind = typeof TRANSCRIPT_KINDS[number]

type SessionUser = { client_id: string; email: string }

type Connection = Parameters<Parameters<typeof withTransaction>[0]>[0]

type SegmentRow = {
  id: number
  recording_id: number
  start_ms: number
  end_ms: number
  speaker_id: number | null
  languages: string | null
}

type TranscriptRow = {
  id: number
  segment_id: number
  kind: Kind
  script: string | null
  text: string
  created_by: string | null
  created_at: string
}

// Shortest segment a split or boundary move may leave
export const MIN_SEGMENT_MS = 200

const db = getMySQLInstance()

function presentTranscript(user: SessionUser, row: TranscriptRow) {
  return {
    id: row.id,
    text: row.text,
    script: row.script,
    created_at: row.created_at,
    is_mine: row.created_by === user.client_id,
  }
}

async function currentTranscripts(
  query: Connection['query'],
  segmentIds: number[]
): Promise<TranscriptRow[]> {
  if (segmentIds.length === 0) return []
  const [rows] = await query(
    `
    SELECT t.* FROM fork_transcripts t
    JOIN (
      SELECT MAX(id) AS id FROM fork_transcripts
      WHERE segment_id IN (?)
      GROUP BY segment_id, kind
    ) latest ON latest.id = t.id
    `,
    [segmentIds]
  )
  return rows
}

async function presentSegments(user: SessionUser, recordingId: number) {
  const [segments]: [SegmentRow[]] = await db.query(
    `SELECT * FROM fork_segments WHERE recording_id = ? ORDER BY start_ms`,
    [recordingId]
  )
  const transcripts = await currentTranscripts(
    (...args) => db.query(...args),
    segments.map(segment => segment.id)
  )
  return segments.map(segment => {
    const current = (kind: Kind) => {
      const row = transcripts.find(
        t => t.segment_id === segment.id && t.kind === kind
      )
      return row ? presentTranscript(user, row) : null
    }
    return {
      id: segment.id,
      start_ms: segment.start_ms,
      end_ms: segment.end_ms,
      speaker_id: segment.speaker_id,
      languages: segment.languages ? segment.languages.split(',') : null,
      transcription: current('transcription'),
      translation_ja: current('translation_ja'),
      translation_en: current('translation_en'),
    }
  })
}

// How far transcription has got, for the list of recordings. Empty texts
// (cleared ones) don't count.
export async function segmentProgress(recordingIds: number[]) {
  const progress = new Map<
    number,
    { segments: number; transcribed: number; translated_ja: number }
  >()
  if (recordingIds.length === 0) return progress

  const [rows] = await db.query(
    `
    SELECT s.recording_id,
      COUNT(*) AS segments,
      SUM(EXISTS (
        SELECT 1 FROM fork_transcripts t
        WHERE t.id = (SELECT MAX(id) FROM fork_transcripts
                      WHERE segment_id = s.id AND kind = 'transcription')
          AND t.text <> ''
      )) AS transcribed,
      SUM(EXISTS (
        SELECT 1 FROM fork_transcripts t
        WHERE t.id = (SELECT MAX(id) FROM fork_transcripts
                      WHERE segment_id = s.id AND kind = 'translation_ja')
          AND t.text <> ''
      )) AS translated_ja
    FROM fork_segments s
    WHERE s.recording_id IN (?)
    GROUP BY s.recording_id
    `,
    [recordingIds]
  )
  for (const row of rows) {
    progress.set(row.recording_id, {
      segments: Number(row.segments),
      transcribed: Number(row.transcribed),
      translated_ja: Number(row.translated_ja),
    })
  }
  return progress
}

async function findReadyRecording(id: number) {
  const [[row]] = await db.query(
    `SELECT id, created_by, duration_ms FROM fork_recordings WHERE id = ? AND status = 'ready'`,
    [id]
  )
  return row as
    | { id: number; created_by: string | null; duration_ms: number }
    | undefined
}

// Runs body with the segment's recording locked, so that changes to one
// recording's segments happen one at a time.
async function withSegment<T>(
  segmentId: number,
  body: (
    connection: Connection,
    segment: SegmentRow,
    next: SegmentRow | undefined
  ) => Promise<T>
): Promise<T | null> {
  return withTransaction(async connection => {
    const [[found]] = await connection.query(
      `SELECT recording_id FROM fork_segments WHERE id = ?`,
      [segmentId]
    )
    if (!found) return null
    await connection.query(
      `SELECT id FROM fork_recordings WHERE id = ? FOR UPDATE`,
      [found.recording_id]
    )
    const [[segment]] = await connection.query(
      `SELECT * FROM fork_segments WHERE id = ?`,
      [segmentId]
    )
    if (!segment) return null
    const [[next]] = await connection.query(
      `SELECT * FROM fork_segments WHERE recording_id = ? AND start_ms > ? ORDER BY start_ms LIMIT 1`,
      [segment.recording_id, segment.start_ms]
    )
    return body(connection, segment, next)
  })
}

class BadRequest extends Error {}

async function respondWithSegments(
  request: Request,
  response: Response,
  run: () => Promise<number | null>
) {
  try {
    const recordingId = await run()
    if (recordingId === null) return response.sendStatus(StatusCodes.NOT_FOUND)
    response.json(await presentSegments(request.session.user, recordingId))
  } catch (error) {
    if (error instanceof BadRequest) {
      return response
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: error.message })
    }
    throw error
  }
}

export const listSegments = async (request: Request, response: Response) => {
  const recording = await findReadyRecording(Number(request.params.recordingId))
  if (!recording) return response.sendStatus(StatusCodes.NOT_FOUND)
  response.json(await presentSegments(request.session.user, recording.id))
}

// Finds the segments again from pauses, for recordings processed before
// segments existed, or when the first attempt went badly. Only while nothing
// has been transcribed, since it replaces every segment.
export const detectSegments = async (request: Request, response: Response) => {
  const user = request.session.user
  const recording = await findReadyRecording(Number(request.params.recordingId))
  if (!recording) return response.sendStatus(StatusCodes.NOT_FOUND)
  if (
    recording.created_by !== user.client_id &&
    !(await hasRole(user, 'moderator'))
  ) {
    return response.sendStatus(StatusCodes.FORBIDDEN)
  }

  const transcribed = await withTransaction(async connection => {
    await connection.query(
      `SELECT id FROM fork_recordings WHERE id = ? FOR UPDATE`,
      [recording.id]
    )
    const [[{ count }]] = await connection.query(
      `
      SELECT COUNT(*) AS count FROM fork_transcripts t
      JOIN fork_segments s ON s.id = t.segment_id
      WHERE s.recording_id = ?
      `,
      [recording.id]
    )
    if (count > 0) return true
    await connection.query(`DELETE FROM fork_segments WHERE recording_id = ?`, [
      recording.id,
    ])
    return false
  })
  if (transcribed) {
    return response
      .status(StatusCodes.CONFLICT)
      .json({ message: 'already transcribed' })
  }
  await queueSegmentDetection(recording.id)
  response.sendStatus(StatusCodes.ACCEPTED)
}

export const updateSegment = (request: Request, response: Response) =>
  respondWithSegments(request, response, () =>
    withSegment(
      Number(request.params.segmentId),
      async (connection, segment, next) => {
        const { speaker_id, languages, end_ms } = request.body
        const changes: Record<string, unknown> = {
          updated_by: request.session.user.client_id,
        }

        if (speaker_id !== undefined) {
          if (speaker_id !== null) {
            const [[onRecording]] = await connection.query(
              `SELECT 1 AS yes FROM fork_recording_speakers WHERE recording_id = ? AND speaker_id = ?`,
              [segment.recording_id, speaker_id]
            )
            if (!onRecording) {
              throw new BadRequest('speaker is not on this recording')
            }
          }
          changes.speaker_id = speaker_id
        }
        if (languages !== undefined) {
          changes.languages = languages ? languages.join(',') : null
        }
        if (end_ms !== undefined && end_ms !== segment.end_ms) {
          if (!next) throw new BadRequest('the last segment ends the recording')
          if (
            end_ms < segment.start_ms + MIN_SEGMENT_MS ||
            end_ms > next.end_ms - MIN_SEGMENT_MS
          ) {
            throw new BadRequest('boundary out of range')
          }
          changes.end_ms = end_ms
          await connection.query(
            `UPDATE fork_segments SET start_ms = ?, updated_by = ? WHERE id = ?`,
            [end_ms, request.session.user.client_id, next.id]
          )
        }

        await connection.query(`UPDATE fork_segments SET ? WHERE id = ?`, [
          changes,
          segment.id,
        ])
        return segment.recording_id
      }
    )
  )

// The first part keeps the transcripts; the second starts empty.
export const splitSegment = (request: Request, response: Response) =>
  respondWithSegments(request, response, () =>
    withSegment(
      Number(request.params.segmentId),
      async (connection, segment) => {
        const at = request.body.at_ms
        if (
          at < segment.start_ms + MIN_SEGMENT_MS ||
          at > segment.end_ms - MIN_SEGMENT_MS
        ) {
          throw new BadRequest('split point out of range')
        }
        const user = request.session.user.client_id
        await connection.query(
          `UPDATE fork_segments SET end_ms = ?, updated_by = ? WHERE id = ?`,
          [at, user, segment.id]
        )
        await connection.query(`INSERT INTO fork_segments SET ?`, [
          {
            recording_id: segment.recording_id,
            start_ms: at,
            end_ms: segment.end_ms,
            speaker_id: segment.speaker_id,
            languages: segment.languages,
            updated_by: user,
          },
        ])
        return segment.recording_id
      }
    )
  )

const joinTexts = (a?: string, b?: string) =>
  [a, b].filter(text => text && text.trim()).join(' ')

// Merges a segment with the next one. Their transcripts are joined into a new
// version on the merged segment; the older versions of the second segment's
// transcripts go with it.
export const mergeSegment = (request: Request, response: Response) =>
  respondWithSegments(request, response, () =>
    withSegment(
      Number(request.params.segmentId),
      async (connection, segment, next) => {
        if (!next) throw new BadRequest('no next segment')
        const user = request.session.user.client_id

        const transcripts = await currentTranscripts(
          (...args) => connection.query(...args),
          [segment.id, next.id]
        )
        for (const kind of TRANSCRIPT_KINDS) {
          const first = transcripts.find(
            t => t.segment_id === segment.id && t.kind === kind
          )
          const second = transcripts.find(
            t => t.segment_id === next.id && t.kind === kind
          )
          if (!second?.text.trim()) continue
          const script =
            !first?.text.trim() || first.script === second.script
              ? second.script
              : 'mixed'
          await connection.query(`INSERT INTO fork_transcripts SET ?`, [
            {
              segment_id: segment.id,
              kind,
              script: kind === 'transcription' ? script : null,
              text: joinTexts(first?.text, second.text),
              created_by: user,
            },
          ])
        }

        const languages = new Set(
          [segment.languages, next.languages]
            .filter(Boolean)
            .flatMap(value => value.split(','))
        )
        await connection.query(`DELETE FROM fork_segments WHERE id = ?`, [
          next.id,
        ])
        await connection.query(`UPDATE fork_segments SET ? WHERE id = ?`, [
          {
            end_ms: next.end_ms,
            speaker_id:
              segment.speaker_id === next.speaker_id
                ? segment.speaker_id
                : null,
            languages:
              segment.languages && next.languages
                ? [...languages].join(',')
                : null,
            updated_by: user,
          },
          segment.id,
        ])
        return segment.recording_id
      }
    )
  )

export const addTranscript = async (request: Request, response: Response) => {
  const user = request.session.user
  const { kind, base_id } = request.body
  const text = request.body.text.normalize('NFC').trim()
  const script =
    kind === 'transcription' && text ? request.body.script ?? null : null

  const result = await withSegment(
    Number(request.params.segmentId),
    async (connection, segment) => {
      const [[current]] = await connection.query(
        `SELECT * FROM fork_transcripts WHERE segment_id = ? AND kind = ? ORDER BY id DESC LIMIT 1`,
        [segment.id, kind]
      )
      if ((current?.id ?? null) !== base_id) {
        return { conflict: current ? presentTranscript(user, current) : null }
      }
      if (current && current.text === text && current.script === script) {
        return { saved: presentTranscript(user, current) }
      }
      const [inserted] = await connection.query(
        `INSERT INTO fork_transcripts SET ?`,
        [
          {
            segment_id: segment.id,
            kind,
            script,
            text,
            created_by: user.client_id,
          },
        ]
      )
      const [[row]] = await connection.query(
        `SELECT * FROM fork_transcripts WHERE id = ?`,
        [inserted.insertId]
      )
      return { saved: presentTranscript(user, row) }
    }
  )

  if (!result) return response.sendStatus(StatusCodes.NOT_FOUND)
  if ('conflict' in result) {
    // Someone else saved a version since this edit started
    return response
      .status(StatusCodes.CONFLICT)
      .json({ message: 'changed meanwhile', current: result.conflict })
  }
  response.status(StatusCodes.CREATED).json(result.saved)
}

export const listTranscriptVersions = async (
  request: Request,
  response: Response
) => {
  const kind = String(request.query.kind)
  if (!(TRANSCRIPT_KINDS as readonly string[]).includes(kind)) {
    return response.sendStatus(StatusCodes.BAD_REQUEST)
  }
  const [rows] = await db.query(
    `SELECT * FROM fork_transcripts WHERE segment_id = ? AND kind = ? ORDER BY id DESC`,
    [Number(request.params.segmentId), kind]
  )
  response.json(
    rows.map((row: TranscriptRow) =>
      presentTranscript(request.session.user, row)
    )
  )
}
