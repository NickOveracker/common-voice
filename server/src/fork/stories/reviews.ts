import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { getMySQLInstance } from '../../lib/model/db/mysql'
import { hasRole } from '../roles'
import { withTransaction } from './transaction'

// Reviewers (and moderators) check transcriptions and translations: each
// current version can be approved or marked as needing work, with a comment.
// Nobody reviews their own versions, and a new version starts unreviewed.

type SessionUser = { client_id: string; email: string }

type ReviewRow = {
  id: number
  transcript_id: number
  verdict: 'approved' | 'needs_work'
  comment: string | null
  reviewed_by: string | null
  created_at: string
}

const db = getMySQLInstance()

export function presentReview(user: SessionUser, row: ReviewRow) {
  return {
    verdict: row.verdict,
    comment: row.comment,
    created_at: row.created_at,
    is_mine: row.reviewed_by === user.client_id,
  }
}

export type Review = ReturnType<typeof presentReview>

// The latest review of each transcript version
export async function latestReviews(
  user: SessionUser,
  transcriptIds: number[]
): Promise<Map<number, Review>> {
  const reviews = new Map<number, Review>()
  if (transcriptIds.length === 0) return reviews
  const [rows] = await db.query(
    `
    SELECT r.* FROM fork_transcript_reviews r
    JOIN (
      SELECT MAX(id) AS id FROM fork_transcript_reviews
      WHERE transcript_id IN (?)
      GROUP BY transcript_id
    ) latest ON latest.id = r.id
    `,
    [transcriptIds]
  )
  for (const row of rows) {
    reviews.set(row.transcript_id, presentReview(user, row))
  }
  return reviews
}

export const addReview = async (request: Request, response: Response) => {
  const user = request.session.user
  if (!(await hasRole(user, 'reviewer'))) {
    return response.sendStatus(StatusCodes.FORBIDDEN)
  }
  const transcriptId = Number(request.params.transcriptId)
  const comment = request.body.comment?.normalize('NFC').trim() || null

  const result = await withTransaction(async connection => {
    const [[transcript]] = await connection.query(
      `
      SELECT t.*, s.recording_id FROM fork_transcripts t
      JOIN fork_segments s ON s.id = t.segment_id
      WHERE t.id = ?
      `,
      [transcriptId]
    )
    if (!transcript) return { status: StatusCodes.NOT_FOUND }
    // Same lock as edits to the recording's segments and transcripts
    await connection.query(
      `SELECT id FROM fork_recordings WHERE id = ? FOR UPDATE`,
      [transcript.recording_id]
    )
    const [[current]] = await connection.query(
      `SELECT id FROM fork_transcripts WHERE segment_id = ? AND kind = ? ORDER BY id DESC LIMIT 1`,
      [transcript.segment_id, transcript.kind]
    )
    if (current.id !== transcript.id) {
      return {
        status: StatusCodes.CONFLICT,
        message: 'not the current version',
      }
    }
    if (transcript.created_by === user.client_id) {
      return {
        status: StatusCodes.FORBIDDEN,
        message: 'cannot review your own version',
      }
    }
    if (!transcript.text) {
      return { status: StatusCodes.BAD_REQUEST, message: 'nothing to review' }
    }
    const [inserted] = await connection.query(
      `INSERT INTO fork_transcript_reviews SET ?`,
      [
        {
          transcript_id: transcriptId,
          verdict: request.body.verdict,
          comment,
          reviewed_by: user.client_id,
        },
      ]
    )
    const [[row]] = await connection.query(
      `SELECT * FROM fork_transcript_reviews WHERE id = ?`,
      [inserted.insertId]
    )
    return { status: StatusCodes.CREATED, review: presentReview(user, row) }
  })

  if (result.review) return response.status(result.status).json(result.review)
  if (result.message) {
    return response.status(result.status).json({ message: result.message })
  }
  response.sendStatus(result.status)
}
