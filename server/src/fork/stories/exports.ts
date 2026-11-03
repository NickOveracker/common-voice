import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { getMySQLInstance } from '../../lib/model/db/mysql'
import { queueExport } from './processing'
import {
  deleteObject,
  getAudioUrl,
  streamObject,
  streamsThroughApp,
} from './storage'

// Exports of the archive, for admins (the routes require the admin role).
// They are built in the background (export-builder.ts); every export stays
// on record, including deleted ones.

const db = getMySQLInstance()

export const createExport = async (request: Request, response: Response) => {
  const { purpose, audio, only_checked } = request.body
  const [result] = await db.query(`INSERT INTO fork_exports SET ?`, [
    {
      purpose,
      audio,
      only_checked: only_checked ? 1 : 0,
      created_by: request.session.user.client_id,
    },
  ])
  await queueExport(result.insertId)
  response.status(StatusCodes.ACCEPTED).json({ id: result.insertId })
}

export const listExports = async (_request: Request, response: Response) => {
  const [rows] = await db.query(`
    SELECT e.id, e.purpose, e.audio, e.only_checked, e.status, e.recordings,
      e.segments, e.speakers, e.size_bytes, e.error, e.created_at,
      e.finished_at, e.deleted_at,
      creator.username AS created_by, deleter.username AS deleted_by
    FROM fork_exports e
    LEFT JOIN user_clients creator ON creator.client_id = e.created_by
    LEFT JOIN user_clients deleter ON deleter.client_id = e.deleted_by
    ORDER BY e.id DESC
    LIMIT 200
  `)
  response.json(
    rows.map((row: { only_checked: number; size_bytes: number | null }) => ({
      ...row,
      only_checked: Boolean(row.only_checked),
      size_bytes: row.size_bytes === null ? null : Number(row.size_bytes),
    }))
  )
}

// The zip: streamed when files are on the server's own disk, otherwise a
// redirect to a short-lived link
export const downloadExport = async (request: Request, response: Response) => {
  const [[row]] = await db.query(
    `SELECT path FROM fork_exports WHERE id = ? AND status = 'ready'`,
    [Number(request.params.exportId)]
  )
  if (!row) return response.sendStatus(StatusCodes.NOT_FOUND)
  if (!streamsThroughApp())
    return response.redirect(await getAudioUrl(row.path))
  await streamObject(row.path, request, response, {
    contentType: 'application/zip',
    downloadName: `ainu-voice-export-${request.params.exportId}.zip`,
  })
}

// Deletes the file; the record of the export stays
export const deleteExport = async (request: Request, response: Response) => {
  const id = Number(request.params.exportId)
  const [[row]] = await db.query(
    `SELECT path FROM fork_exports WHERE id = ? AND status IN ('ready', 'failed')`,
    [id]
  )
  if (!row) return response.sendStatus(StatusCodes.NOT_FOUND)
  if (row.path) await deleteObject(row.path).catch((): null => null)
  await db.query(
    `
    UPDATE fork_exports
    SET status = 'deleted', path = NULL, deleted_by = ?, deleted_at = NOW()
    WHERE id = ?
    `,
    [request.session.user.client_id, id]
  )
  response.sendStatus(StatusCodes.NO_CONTENT)
}
