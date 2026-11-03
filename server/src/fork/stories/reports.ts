import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { getMySQLInstance } from '../../lib/model/db/mysql'
import { hasRole } from '../roles'

// Reports of problems with a recording, or one of its segments: a consent
// concern, something that shouldn't be shared, wrong details, bad audio.
// Anyone signed in can report; moderators see open reports and resolve them
// with a note. What to do about the recording itself is up to them.

export const REPORT_REASONS = [
  'consent',
  'sensitive',
  'wrong_details',
  'audio',
  'other',
] as const

const db = getMySQLInstance()

const clean = (text: string | null | undefined) =>
  text?.normalize('NFC').trim() || null

export const createReport = async (request: Request, response: Response) => {
  const user = request.session.user
  const recordingId = Number(request.params.recordingId)
  const { reason, comment, segment_id } = request.body

  const [[recording]] = await db.query(
    `SELECT id FROM fork_recordings WHERE id = ? AND (status <> 'uploading' OR created_by = ?)`,
    [recordingId, user.client_id]
  )
  if (!recording) return response.sendStatus(StatusCodes.NOT_FOUND)
  if (segment_id) {
    const [[segment]] = await db.query(
      `SELECT id FROM fork_segments WHERE id = ? AND recording_id = ?`,
      [segment_id, recordingId]
    )
    if (!segment) {
      return response
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: 'segment is not in this recording' })
    }
  }

  const [result] = await db.query(`INSERT INTO fork_reports SET ?`, [
    {
      recording_id: recordingId,
      segment_id: segment_id ?? null,
      reason,
      comment: clean(comment),
      created_by: user.client_id,
    },
  ])
  response.status(StatusCodes.CREATED).json({ id: result.insertId })
}

// For moderators: open reports, or resolved ones with ?status=resolved
export const listReports = async (request: Request, response: Response) => {
  if (!(await hasRole(request.session.user, 'moderator'))) {
    return response.sendStatus(StatusCodes.FORBIDDEN)
  }
  const status = request.query.status === 'resolved' ? 'resolved' : 'open'
  const [rows] = await db.query(
    `
    SELECT rp.id, rp.recording_id, rp.segment_id, rp.reason, rp.comment,
      rp.status, rp.resolution, rp.created_at, rp.resolved_at,
      rec.title AS recording_title,
      seg.start_ms AS segment_start_ms, seg.end_ms AS segment_end_ms,
      reporter.username AS reported_by, resolver.username AS resolved_by
    FROM fork_reports rp
    JOIN fork_recordings rec ON rec.id = rp.recording_id
    LEFT JOIN fork_segments seg ON seg.id = rp.segment_id
    LEFT JOIN user_clients reporter ON reporter.client_id = rp.created_by
    LEFT JOIN user_clients resolver ON resolver.client_id = rp.resolved_by
    WHERE rp.status = ?
    ORDER BY rp.id ${status === 'open' ? 'ASC' : 'DESC'}
    LIMIT 500
    `,
    [status]
  )
  response.json(rows)
}

export const resolveReport = async (request: Request, response: Response) => {
  const user = request.session.user
  if (!(await hasRole(user, 'moderator'))) {
    return response.sendStatus(StatusCodes.FORBIDDEN)
  }
  const [result] = await db.query(
    `
    UPDATE fork_reports
    SET status = 'resolved', resolution = ?, resolved_by = ?, resolved_at = NOW()
    WHERE id = ? AND status = 'open'
    `,
    [
      clean(request.body.resolution),
      user.client_id,
      Number(request.params.reportId),
    ]
  )
  if (result.affectedRows === 0) {
    return response.sendStatus(StatusCodes.NOT_FOUND)
  }
  response.sendStatus(StatusCodes.NO_CONTENT)
}
