import PromiseRouter from 'express-promise-router'
import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { getMySQLInstance } from '../lib/model/db/mysql'
import { getRoles, grantRole, isRole, requireRole, revokeRole } from './roles'
import storiesRouter from './stories/routes'

// Fork API, mounted at /api/v1/community.

const db = getMySQLInstance()

const getOwnRoles = async (request: Request, response: Response) => {
  const user = request.session?.user
  response.json({ roles: user?.email ? await getRoles(user) : [] })
}

const listUsers = async (_request: Request, response: Response) => {
  const [rows] = await db.query(`
    SELECT uc.client_id, uc.email, uc.username,
      GROUP_CONCAT(r.role ORDER BY r.role) AS roles
    FROM user_clients uc
    LEFT JOIN fork_user_roles r ON r.client_id = uc.client_id
    WHERE uc.email IS NOT NULL
    GROUP BY uc.client_id
    ORDER BY uc.email
  `)
  response.json(
    rows.map((row: { roles: string | null }) => ({
      ...row,
      roles: row.roles ? row.roles.split(',') : [],
    }))
  )
}

const changeRole =
  (change: 'grant' | 'revoke') =>
  async (request: Request, response: Response) => {
    const { clientId, role } = request.params
    const self = request.session.user

    if (!isRole(role)) {
      return response
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: 'unknown role' })
    }
    // Avoid locking the last admin out by accident
    if (
      change === 'revoke' &&
      role === 'admin' &&
      clientId === self.client_id
    ) {
      return response
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: 'cannot remove your own admin role' })
    }

    const [[user]] = await db.query(
      `SELECT client_id FROM user_clients WHERE client_id = ? AND email IS NOT NULL`,
      [clientId]
    )
    if (!user) {
      return response
        .status(StatusCodes.NOT_FOUND)
        .json({ message: 'unknown user' })
    }

    if (change === 'grant') {
      await grantRole(clientId, role, self.client_id)
    } else {
      await revokeRole(clientId, role)
    }
    response.sendStatus(StatusCodes.NO_CONTENT)
  }

export default PromiseRouter({ mergeParams: true })
  .use(storiesRouter)
  .get('/roles', getOwnRoles)
  .get('/admin/users', requireRole('admin'), listUsers)
  .put(
    '/admin/users/:clientId/roles/:role',
    requireRole('admin'),
    changeRole('grant')
  )
  .delete(
    '/admin/users/:clientId/roles/:role',
    requireRole('admin'),
    changeRole('revoke')
  )
