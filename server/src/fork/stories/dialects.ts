import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { getMySQLInstance } from '../../lib/model/db/mysql'
import { withTransaction } from './transaction'

// Dialects of speakers and recordings. Speakers say what they speak, so
// anyone signed in can add a dialect without waiting for approval. Admins
// tidy up afterwards: renaming entries, and merging two that are the same
// (沙流 and Saru). A merged entry is kept as an alias of the one it was
// merged into, and its speakers and recordings move there.

type Connection = Parameters<Parameters<typeof withTransaction>[0]>[0]

type DialectRow = {
  id: number
  name: string
  merged_into: number | null
}

export type Dialect = { id: number; name: string }

const db = getMySQLInstance()

const clean = (name: string) =>
  name.normalize('NFC').trim().replace(/\s+/g, ' ')

// Names that differ only in case, width or spacing are the same dialect:
// "Saru", "saru" and "Ｓａｒｕ"
const sameNameKey = (name: string) =>
  name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()

async function allDialects(
  query: Connection['query'] = (...args) => db.query(...args)
): Promise<DialectRow[]> {
  const [rows] = await query(`SELECT id, name, merged_into FROM fork_dialects`)
  return rows
}

// The entry a dialect was merged into, or itself
function resolve(rows: DialectRow[], id: number): DialectRow | undefined {
  let row = rows.find(r => r.id === id)
  for (let hops = 0; row?.merged_into && hops < 100; hops++) {
    row = rows.find(r => r.id === row.merged_into)
  }
  return row
}

export const listDialects = async (_request: Request, response: Response) => {
  const rows = await allDialects()
  const [speakers] = await db.query(
    `SELECT dialect_id, COUNT(*) AS count FROM fork_speaker_dialects GROUP BY dialect_id`
  )
  const [recordings] = await db.query(
    `SELECT dialect_id, COUNT(*) AS count FROM fork_recording_dialects GROUP BY dialect_id`
  )
  const count = (list: { dialect_id: number; count: number }[], id: number) =>
    Number(list.find(row => row.dialect_id === id)?.count ?? 0)

  response.json(
    rows
      .filter(row => !row.merged_into)
      .map(row => ({
        id: row.id,
        name: row.name,
        // Names merged into this one
        aliases: rows
          .filter(
            other =>
              other.id !== row.id && resolve(rows, other.id)?.id === row.id
          )
          .map(other => other.name),
        speakers: count(speakers, row.id),
        recordings: count(recordings, row.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  )
}

// Adds a dialect, or finds the existing one with the same name (or a name
// merged into it)
export const createDialect = async (request: Request, response: Response) => {
  const name = clean(request.body.name)
  if (!name) {
    return response
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: 'name is required' })
  }
  const find = async () => {
    const rows = await allDialects()
    const match = rows.find(row => sameNameKey(row.name) === sameNameKey(name))
    return match ? resolve(rows, match.id) : undefined
  }

  const existing = await find()
  if (existing) {
    return response.json({
      id: existing.id,
      name: existing.name,
      created: false,
    })
  }
  try {
    const [result] = await db.query(`INSERT INTO fork_dialects SET ?`, [
      { name, created_by: request.session.user.client_id },
    ])
    response
      .status(StatusCodes.CREATED)
      .json({ id: result.insertId, name, created: true })
  } catch (error) {
    // Someone added the same name at the same moment
    if (error?.code !== 'ER_DUP_ENTRY') throw error
    const added = await find()
    response.json({ id: added.id, name: added.name, created: false })
  }
}

export const renameDialect = async (request: Request, response: Response) => {
  const id = Number(request.params.dialectId)
  const name = clean(request.body.name)
  const rows = await allDialects()
  const dialect = rows.find(row => row.id === id && !row.merged_into)
  if (!dialect) return response.sendStatus(StatusCodes.NOT_FOUND)

  const clash = rows.find(
    row => row.id !== id && sameNameKey(row.name) === sameNameKey(name)
  )
  if (clash) {
    // Same as another entry: that's a merge, not a rename
    return response.status(StatusCodes.CONFLICT).json({
      message: 'another dialect has this name',
      dialect: resolve(rows, clash.id),
    })
  }
  await db.query(`UPDATE fork_dialects SET name = ? WHERE id = ?`, [name, id])
  response.sendStatus(StatusCodes.NO_CONTENT)
}

// Moves everything from one dialect to another, keeping the first as an
// alias of the second
export const mergeDialect = async (request: Request, response: Response) => {
  const from = Number(request.params.dialectId)
  const into = Number(request.body.into_id)

  const error = await withTransaction(async connection => {
    const rows = await allDialects((...args) => connection.query(...args))
    const source = rows.find(row => row.id === from && !row.merged_into)
    const target = rows.find(row => row.id === into && !row.merged_into)
    if (!source || !target) return 'unknown dialect'
    if (source.id === target.id) return 'cannot merge a dialect into itself'

    for (const table of ['fork_speaker_dialects', 'fork_recording_dialects']) {
      const owner =
        table === 'fork_speaker_dialects' ? 'speaker_id' : 'recording_id'
      await connection.query(
        `INSERT IGNORE INTO ${table} (${owner}, dialect_id)
         SELECT ${owner}, ? FROM ${table} WHERE dialect_id = ?`,
        [into, from]
      )
      await connection.query(`DELETE FROM ${table} WHERE dialect_id = ?`, [
        from,
      ])
    }
    // Aliases of the source become aliases of the target too
    await connection.query(
      `UPDATE fork_dialects SET merged_into = ? WHERE id = ? OR merged_into = ?`,
      [into, from, from]
    )
    return null
  })

  if (error) {
    return response.status(StatusCodes.BAD_REQUEST).json({ message: error })
  }
  response.sendStatus(StatusCodes.NO_CONTENT)
}

// Checks dialect ids from a request; ids of merged entries become the ids
// they were merged into. Returns null if any is unknown.
export async function resolveDialectIds(
  ids: number[]
): Promise<number[] | null> {
  if (ids.length === 0) return []
  const rows = await allDialects()
  const resolved = ids.map(id => resolve(rows, id)?.id)
  if (resolved.some(id => id === undefined)) return null
  return [...new Set(resolved)]
}

export async function setDialects(
  connection: Connection,
  owner: 'speaker' | 'recording',
  ownerId: number,
  dialectIds: number[]
) {
  const table =
    owner === 'speaker' ? 'fork_speaker_dialects' : 'fork_recording_dialects'
  const column = owner === 'speaker' ? 'speaker_id' : 'recording_id'
  await connection.query(`DELETE FROM ${table} WHERE ${column} = ?`, [ownerId])
  if (dialectIds.length > 0) {
    await connection.query(
      `INSERT INTO ${table} (${column}, dialect_id) VALUES ?`,
      [dialectIds.map(id => [ownerId, id])]
    )
  }
}

export async function dialectsOf(
  owner: 'speaker' | 'recording',
  ownerIds: number[]
): Promise<Map<number, Dialect[]>> {
  const result = new Map<number, Dialect[]>()
  if (ownerIds.length === 0) return result
  const table =
    owner === 'speaker' ? 'fork_speaker_dialects' : 'fork_recording_dialects'
  const column = owner === 'speaker' ? 'speaker_id' : 'recording_id'
  const [rows] = await db.query(
    `
    SELECT x.${column} AS owner_id, d.id, d.name
    FROM ${table} x JOIN fork_dialects d ON d.id = x.dialect_id
    WHERE x.${column} IN (?)
    ORDER BY d.name
    `,
    [ownerIds]
  )
  for (const { owner_id, id, name } of rows) {
    result.set(owner_id, [...(result.get(owner_id) ?? []), { id, name }])
  }
  return result
}

// The dialects of some speakers together, for a new recording
export async function speakersDialectIds(
  speakerIds: number[]
): Promise<number[]> {
  const dialects = await dialectsOf('speaker', speakerIds)
  return [...new Set([...dialects.values()].flat().map(dialect => dialect.id))]
}
