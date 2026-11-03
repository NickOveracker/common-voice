import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { getMySQLInstance } from '../../lib/model/db/mysql'
import { hasRole } from '../roles'

// Prompts: topics and questions that draw out stories ("Tell us about the
// games you played as a child"). Anyone signed in can suggest one, in
// Japanese and optionally in Ainu; moderators approve or reject them, and
// their own suggestions are approved straight away. Recordings can name the
// prompt they answer.

type SessionUser = { client_id: string; email: string }

type PromptRow = {
  id: number
  text_ja: string
  text_ain: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_by: string | null
  recordings: number
}

const db = getMySQLInstance()

const clean = (text: string | null | undefined) =>
  text?.normalize('NFC').trim() || null

function presentPrompt(user: SessionUser, row: PromptRow) {
  return {
    id: row.id,
    text_ja: row.text_ja,
    text_ain: row.text_ain,
    status: row.status,
    is_mine: row.created_by === user.client_id,
    recordings: Number(row.recordings ?? 0),
  }
}

// Approved prompts for everyone; moderators also see the others, and people
// see their own suggestions.
export const listPrompts = async (request: Request, response: Response) => {
  const user = request.session.user
  const moderator = await hasRole(user, 'moderator')
  const [rows] = await db.query(
    `
    SELECT p.*,
      (SELECT COUNT(*) FROM fork_recordings r
       WHERE r.prompt_id = p.id AND r.status = 'ready') AS recordings
    FROM fork_prompts p
    WHERE p.status = 'approved' OR ? OR p.created_by = ?
    ORDER BY FIELD(p.status, 'pending', 'approved', 'rejected'), p.id DESC
    `,
    [moderator, user.client_id]
  )
  response.json(rows.map((row: PromptRow) => presentPrompt(user, row)))
}

export const createPrompt = async (request: Request, response: Response) => {
  const user = request.session.user
  const textJa = clean(request.body.text_ja)
  if (!textJa) {
    return response
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: 'text_ja is required' })
  }
  const moderator = await hasRole(user, 'moderator')
  const [result] = await db.query(`INSERT INTO fork_prompts SET ?`, [
    {
      text_ja: textJa,
      text_ain: clean(request.body.text_ain),
      status: moderator ? 'approved' : 'pending',
      created_by: user.client_id,
      reviewed_by: moderator ? user.client_id : null,
    },
  ])
  response
    .status(StatusCodes.CREATED)
    .json({ id: result.insertId, status: moderator ? 'approved' : 'pending' })
}

// Moderators approve, reject or edit prompts
export const updatePrompt = async (request: Request, response: Response) => {
  const user = request.session.user
  if (!(await hasRole(user, 'moderator'))) {
    return response.sendStatus(StatusCodes.FORBIDDEN)
  }
  const changes: Record<string, unknown> = { reviewed_by: user.client_id }
  const { status, text_ja, text_ain } = request.body
  if (status !== undefined) changes.status = status
  if (text_ja !== undefined) {
    if (!clean(text_ja)) {
      return response
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: 'text_ja is required' })
    }
    changes.text_ja = clean(text_ja)
  }
  if (text_ain !== undefined) changes.text_ain = clean(text_ain)

  const [result] = await db.query(`UPDATE fork_prompts SET ? WHERE id = ?`, [
    changes,
    Number(request.params.promptId),
  ])
  if (result.affectedRows === 0) {
    return response.sendStatus(StatusCodes.NOT_FOUND)
  }
  response.sendStatus(StatusCodes.NO_CONTENT)
}

// For recordings: only approved prompts can be chosen
export async function isApprovedPrompt(id: number): Promise<boolean> {
  const [[row]] = await db.query(
    `SELECT id FROM fork_prompts WHERE id = ? AND status = 'approved'`,
    [id]
  )
  return Boolean(row)
}

export async function promptsById(ids: number[]) {
  const prompts = new Map<
    number,
    { id: number; text_ja: string; text_ain: string | null }
  >()
  if (ids.length === 0) return prompts
  const [rows] = await db.query(
    `SELECT id, text_ja, text_ain FROM fork_prompts WHERE id IN (?)`,
    [ids]
  )
  for (const row of rows) prompts.set(row.id, row)
  return prompts
}
