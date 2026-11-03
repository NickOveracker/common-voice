import { Request, Response, NextFunction } from 'express'
import { getConfig } from '../config-helper'
import { getMySQLInstance } from '../lib/model/db/mysql'

// Community roles. Upstream has no roles: everything is decided by crowd
// votes. Admins manage roles and content, moderators look after content and
// reports, and reviewers check transcriptions and translations (which anyone
// signed in can write).
//
// People whose email is in CV_ADMIN_EMAILS are always admins, so the first
// admins can be set up before anyone has a role.

export const ROLES = ['admin', 'moderator', 'reviewer'] as const
export type Role = typeof ROLES[number]

export const isRole = (value: string): value is Role =>
  ROLES.includes(value as Role)

const db = getMySQLInstance()

function adminEmails(): string[] {
  return (getConfig().ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
}

export async function getRoles(user: {
  client_id?: string
  email?: string
}): Promise<Role[]> {
  const roles = new Set<Role>()

  if (user.email && adminEmails().includes(user.email.toLowerCase())) {
    roles.add('admin')
  }

  if (user.client_id) {
    const [rows] = await db.query(
      `SELECT role FROM fork_user_roles WHERE client_id = ?`,
      [user.client_id]
    )
    for (const { role } of rows) roles.add(role)
  }

  return [...roles]
}

// Roles that include others: admins can do everything, and moderators can
// review.
const INCLUDED: Record<Role, Role[]> = {
  admin: ['moderator', 'reviewer'],
  moderator: ['reviewer'],
  reviewer: [],
}

export async function hasRole(
  user: { client_id?: string; email?: string },
  role: Role
): Promise<boolean> {
  const roles = await getRoles(user)
  return roles.some(held => held === role || INCLUDED[held].includes(role))
}

export async function grantRole(
  clientId: string,
  role: Role,
  grantedBy: string
): Promise<void> {
  await db.query(
    `INSERT IGNORE INTO fork_user_roles (client_id, role, granted_by) VALUES (?, ?, ?)`,
    [clientId, role, grantedBy]
  )
}

export async function revokeRole(clientId: string, role: Role): Promise<void> {
  await db.query(
    `DELETE FROM fork_user_roles WHERE client_id = ? AND role = ?`,
    [clientId, role]
  )
}

export function requireRole(role: Role) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const user = request.session?.user
    // Roles only apply to people who signed in, not anonymous clients
    if (user?.email && (await hasRole(user, role))) {
      return next()
    }
    response.status(403).json({ message: `${role} role required` })
  }
}
