// Fork: exports of the archive (see server/src/fork/stories/exports.ts).
export const up = async function (db: any): Promise<any> {
  // Every export is kept on record: who made it, for what purpose and with
  // what in it, even after its file is deleted.
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS fork_exports (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      purpose ENUM('archive', 'community_use', 'research', 'speech_technology') NOT NULL,
      audio ENUM('none', 'recordings', 'segments') NOT NULL,
      only_checked TINYINT(1) NOT NULL DEFAULT 0,
      status ENUM('queued', 'building', 'ready', 'failed', 'deleted') NOT NULL DEFAULT 'queued',
      recordings INT UNSIGNED DEFAULT NULL,
      segments INT UNSIGNED DEFAULT NULL,
      speakers INT UNSIGNED DEFAULT NULL,
      size_bytes BIGINT UNSIGNED DEFAULT NULL,
      path VARCHAR(255) DEFAULT NULL,
      error TEXT,
      created_by CHAR(36) DEFAULT NULL,
      deleted_by CHAR(36) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT NOW(),
      finished_at DATETIME DEFAULT NULL,
      deleted_at DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      FOREIGN KEY (created_by) REFERENCES user_clients(client_id) ON DELETE SET NULL,
      FOREIGN KEY (deleted_by) REFERENCES user_clients(client_id) ON DELETE SET NULL
    )
  `)
}

export const down = async function (db: any): Promise<any> {
  await db.runSql(`DROP TABLE fork_exports`)
}
