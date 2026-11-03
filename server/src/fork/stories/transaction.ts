import { getMySQLInstance } from '../../lib/model/db/mysql'

type Connection = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: (...args: any[]) => Promise<any>
}

// Runs body in a transaction on a pooled connection.
export async function withTransaction<T>(
  body: (connection: Connection) => Promise<T>
): Promise<T> {
  const pool = await getMySQLInstance().getPool()
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const result = await body(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
