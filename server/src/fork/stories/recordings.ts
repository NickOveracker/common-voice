import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { getMySQLInstance } from '../../lib/model/db/mysql'
import { getForkConfig } from '../config'
import { hasRole } from '../roles'
import { canManageSpeaker, currentConsents } from './speakers'
import { chunkPath, getAudioUrl, putObject } from './storage'
import { queueRecordingProcessing } from './processing'
import { emptyCounts, Progress, segmentProgress } from './segments'
import { isApprovedPrompt, promptsById } from './prompts'
import { withTransaction } from './transaction'

// Long recordings (stories, interviews, conversations). Audio is sent in
// chunks of up to CHUNK_MAX_BYTES, so recording in the browser can upload as
// it goes and large files can be uploaded and resumed. Once all chunks are
// in, the recording is processed in the background (processing.ts).

export const CHUNK_MAX_BYTES = 8 * 1024 * 1024

const db = getMySQLInstance()

type SessionUser = { client_id: string; email: string }

type RecordingRow = {
  id: number
  title: string
  description: string | null
  prompt_id: number | null
  languages: string
  source: string
  status: string
  recorded_on: string | null
  location: string | null
  original_filename: string | null
  size_bytes: number
  duration_ms: number | null
  error: string | null
  created_by: string | null
  created_at: string
}

async function findRecording(id: number): Promise<RecordingRow | undefined> {
  const [[row]] = await db.query(`SELECT * FROM fork_recordings WHERE id = ?`, [
    id,
  ])
  return row
}

async function canManageRecording(user: SessionUser, recording: RecordingRow) {
  return (
    recording.created_by === user.client_id ||
    (await hasRole(user, 'moderator'))
  )
}

// Every speaker must be someone the user may record, with current consent to
// at least keep the recording in the archive.
async function checkSpeakers(
  user: SessionUser,
  speakerIds: number[]
): Promise<string | null> {
  const [speakers] = await db.query(
    `SELECT id, client_id, created_by FROM fork_speakers WHERE id IN (?)`,
    [speakerIds]
  )
  if (speakers.length !== speakerIds.length) return 'unknown speaker'

  for (const speaker of speakers) {
    if (!(await canManageSpeaker(user, speaker))) {
      return `not allowed to record speaker ${speaker.id}`
    }
  }

  const consents = await currentConsents(speakerIds)
  const missing = speakerIds.filter(id => !consents.get(id)?.archive)
  return missing.length > 0
    ? `no consent to archive recordings of speaker ${missing.join(', ')}`
    : null
}

async function speakersByRecording(
  recordingIds: number[]
): Promise<Map<number, { id: number; display_name: string }[]>> {
  const result = new Map<number, { id: number; display_name: string }[]>()
  if (recordingIds.length === 0) return result

  const [rows] = await db.query(
    `
    SELECT rs.recording_id, s.id, s.display_name
    FROM fork_recording_speakers rs
    JOIN fork_speakers s ON s.id = rs.speaker_id
    WHERE rs.recording_id IN (?)
    ORDER BY s.display_name
    `,
    [recordingIds]
  )
  for (const { recording_id, id, display_name } of rows) {
    result.set(recording_id, [
      ...(result.get(recording_id) ?? []),
      { id, display_name },
    ])
  }
  return result
}

async function presentRecording(
  user: SessionUser,
  row: RecordingRow,
  speakers: { id: number; display_name: string }[],
  progress: Progress | undefined,
  prompts: Awaited<ReturnType<typeof promptsById>>
) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    prompt: row.prompt_id ? prompts.get(row.prompt_id) ?? null : null,
    languages: row.languages ? row.languages.split(',') : [],
    source: row.source,
    status: row.status,
    recorded_on: row.recorded_on,
    location: row.location,
    original_filename: row.original_filename,
    size_bytes: Number(row.size_bytes),
    duration_ms: row.duration_ms,
    speakers,
    created_at: row.created_at,
    is_mine: row.created_by === user.client_id,
    can_manage: await canManageRecording(user, row),
    error: row.status === 'failed' ? row.error : null,
    progress: progress ?? {
      segments: 0,
      approved: 0,
      needs_work: 0,
      ...emptyCounts(),
    },
  }
}

export const listRecordings = async (request: Request, response: Response) => {
  const user = request.session.user
  const mine = request.query.mine === 'true'
  const [rows] = await db.query(
    `
    SELECT * FROM fork_recordings
    WHERE (? = 0 OR created_by = ?)
      -- Unfinished uploads are only shown to whoever is uploading them
      AND (status <> 'uploading' OR created_by = ?)
    ORDER BY created_at DESC, id DESC
    `,
    [mine ? 1 : 0, user.client_id, user.client_id]
  )
  const ids = rows.map((row: RecordingRow) => row.id)
  const speakers = await speakersByRecording(ids)
  const progress = await segmentProgress(ids)
  const prompts = await promptsById(
    rows.map((row: RecordingRow) => row.prompt_id).filter(Boolean)
  )
  response.json(
    await Promise.all(
      rows.map((row: RecordingRow) =>
        presentRecording(
          user,
          row,
          speakers.get(row.id) ?? [],
          progress.get(row.id),
          prompts
        )
      )
    )
  )
}

export const getRecording = async (request: Request, response: Response) => {
  const user = request.session.user
  const recording = await findRecording(Number(request.params.recordingId))
  if (!recording) return response.sendStatus(StatusCodes.NOT_FOUND)

  const speakers = await speakersByRecording([recording.id])
  const [chunks] = await db.query(
    `SELECT chunk_index FROM fork_recording_chunks WHERE recording_id = ? ORDER BY chunk_index`,
    [recording.id]
  )
  response.json({
    ...(await presentRecording(
      user,
      recording,
      speakers.get(recording.id) ?? [],
      (await segmentProgress([recording.id])).get(recording.id),
      await promptsById(recording.prompt_id ? [recording.prompt_id] : [])
    )),
    // Lets an interrupted upload continue where it stopped
    uploaded_chunks:
      recording.status === 'uploading'
        ? chunks.map((chunk: { chunk_index: number }) => chunk.chunk_index)
        : [],
  })
}

export const createRecording = async (request: Request, response: Response) => {
  const user = request.session.user
  const body = request.body

  const speakerError = await checkSpeakers(user, body.speaker_ids)
  if (speakerError) {
    return response
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: speakerError })
  }
  if (body.prompt_id && !(await isApprovedPrompt(body.prompt_id))) {
    return response
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: 'unknown prompt' })
  }

  const id = await withTransaction(async connection => {
    const [result] = await connection.query(
      `INSERT INTO fork_recordings SET ?`,
      [
        {
          title: body.title,
          description: body.description ?? null,
          prompt_id: body.prompt_id ?? null,
          languages: body.languages.join(','),
          source: body.source,
          recorded_on: body.recorded_on ?? null,
          location: body.location ?? null,
          original_filename: body.original_filename ?? null,
          original_mime: body.original_mime ?? null,
          created_by: user.client_id,
        },
      ]
    )
    await connection.query(
      `INSERT INTO fork_recording_speakers (recording_id, speaker_id) VALUES ?`,
      [
        body.speaker_ids.map((speakerId: number) => [
          result.insertId,
          speakerId,
        ]),
      ]
    )
    return result.insertId
  })
  response.status(StatusCodes.CREATED).json({ id })
}

export const updateRecording = async (request: Request, response: Response) => {
  const user = request.session.user
  const recording = await findRecording(Number(request.params.recordingId))
  if (!recording) return response.sendStatus(StatusCodes.NOT_FOUND)
  if (!(await canManageRecording(user, recording))) {
    return response.sendStatus(StatusCodes.FORBIDDEN)
  }

  const { speaker_ids, languages, ...fields } = request.body
  if (fields.prompt_id && !(await isApprovedPrompt(fields.prompt_id))) {
    return response
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: 'unknown prompt' })
  }
  if (speaker_ids) {
    const speakerError = await checkSpeakers(user, speaker_ids)
    if (speakerError) {
      return response
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: speakerError })
    }
  }

  await withTransaction(async connection => {
    const changes = {
      ...fields,
      ...(languages ? { languages: languages.join(',') } : {}),
    }
    if (Object.keys(changes).length > 0) {
      await connection.query(`UPDATE fork_recordings SET ? WHERE id = ?`, [
        changes,
        recording.id,
      ])
    }
    if (speaker_ids) {
      await connection.query(
        `DELETE FROM fork_recording_speakers WHERE recording_id = ?`,
        [recording.id]
      )
      await connection.query(
        `INSERT INTO fork_recording_speakers (recording_id, speaker_id) VALUES ?`,
        [speaker_ids.map((speakerId: number) => [recording.id, speakerId])]
      )
    }
  })
  response.sendStatus(StatusCodes.NO_CONTENT)
}

export const uploadChunk = async (request: Request, response: Response) => {
  const user = request.session.user
  const recording = await findRecording(Number(request.params.recordingId))
  const index = Number(request.params.chunkIndex)
  const data = request.body

  if (!recording) return response.sendStatus(StatusCodes.NOT_FOUND)
  if (recording.created_by !== user.client_id) {
    return response.sendStatus(StatusCodes.FORBIDDEN)
  }
  if (recording.status !== 'uploading') {
    return response
      .status(StatusCodes.CONFLICT)
      .json({ message: 'recording is no longer accepting audio' })
  }
  if (!Number.isInteger(index) || index < 0) {
    return response.sendStatus(StatusCodes.BAD_REQUEST)
  }
  if (!Buffer.isBuffer(data) || data.length === 0) {
    return response
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: 'empty chunk' })
  }

  const [[{ total }]] = await db.query(
    `SELECT COALESCE(SUM(size_bytes), 0) AS total FROM fork_recording_chunks WHERE recording_id = ? AND chunk_index <> ?`,
    [recording.id, index]
  )
  if (Number(total) + data.length > getForkConfig().RECORDING_MAX_BYTES) {
    return response
      .status(StatusCodes.REQUEST_TOO_LONG)
      .json({ message: 'recording is too large' })
  }

  await putObject(chunkPath(recording.id, index), data)
  await db.query(
    `
    INSERT INTO fork_recording_chunks (recording_id, chunk_index, size_bytes)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE size_bytes = VALUES(size_bytes)
    `,
    [recording.id, index, data.length]
  )
  response.sendStatus(StatusCodes.NO_CONTENT)
}

export const completeRecording = async (
  request: Request,
  response: Response
) => {
  const user = request.session.user
  const recording = await findRecording(Number(request.params.recordingId))
  if (!recording) return response.sendStatus(StatusCodes.NOT_FOUND)
  if (recording.created_by !== user.client_id) {
    return response.sendStatus(StatusCodes.FORBIDDEN)
  }
  if (recording.status !== 'uploading') {
    return response
      .status(StatusCodes.CONFLICT)
      .json({ message: 'recording is already complete' })
  }

  const chunkCount: number = request.body.chunk_count
  const [chunks] = await db.query(
    `SELECT chunk_index, size_bytes FROM fork_recording_chunks WHERE recording_id = ? ORDER BY chunk_index`,
    [recording.id]
  )
  const complete =
    chunks.length === chunkCount &&
    chunks.every(
      (chunk: { chunk_index: number }, i: number) => chunk.chunk_index === i
    )
  if (!complete) {
    return response.status(StatusCodes.BAD_REQUEST).json({
      message: 'missing chunks',
      uploaded_chunks: chunks.map(
        (chunk: { chunk_index: number }) => chunk.chunk_index
      ),
    })
  }

  const size = chunks.reduce(
    (sum: number, chunk: { size_bytes: number }) => sum + chunk.size_bytes,
    0
  )
  await db.query(
    `UPDATE fork_recordings SET status = 'processing', size_bytes = ? WHERE id = ? AND status = 'uploading'`,
    [size, recording.id]
  )
  await queueRecordingProcessing(recording.id)
  response.sendStatus(StatusCodes.ACCEPTED)
}

// Redirects to a short-lived URL for the playback copy, or for the original
// file (?original=true) for those who manage the recording.
export const getRecordingAudio = async (
  request: Request,
  response: Response
) => {
  const user = request.session.user
  const recording = await findRecording(Number(request.params.recordingId))
  if (!recording || recording.status !== 'ready') {
    return response.sendStatus(StatusCodes.NOT_FOUND)
  }

  const [[paths]] = await db.query(
    `SELECT original_path, playback_path FROM fork_recordings WHERE id = ?`,
    [recording.id]
  )
  if (request.query.original === 'true') {
    if (!(await canManageRecording(user, recording))) {
      return response.sendStatus(StatusCodes.FORBIDDEN)
    }
    return response.redirect(await getAudioUrl(paths.original_path))
  }
  response.redirect(await getAudioUrl(paths.playback_path))
}
