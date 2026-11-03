// Fork: community roles (see server/src/fork/roles.ts).
// Prefixed with fork_ so it can't clash with tables added upstream.
export const up = async function (db: any): Promise<any> {
  return db.runSql(`
    CREATE TABLE IF NOT EXISTS fork_user_roles (
      client_id CHAR(36) NOT NULL,
      role ENUM('admin', 'moderator', 'transcriber') NOT NULL,
      granted_by CHAR(36) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT NOW(),
      PRIMARY KEY (client_id, role),
      FOREIGN KEY (client_id) REFERENCES user_clients(client_id) ON DELETE CASCADE,
      FOREIGN KEY (granted_by) REFERENCES user_clients(client_id) ON DELETE SET NULL
    )
  `)
}

export const down = async function (db: any): Promise<any> {
  return db.runSql(`DROP TABLE fork_user_roles`)
}
