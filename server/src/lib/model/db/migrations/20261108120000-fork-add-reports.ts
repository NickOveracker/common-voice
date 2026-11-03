// Fork: reports of problems with recordings (see
// server/src/fork/stories/reports.ts).
export const up = async function (db: any): Promise<any> {
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS fork_reports (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      recording_id INT UNSIGNED NOT NULL,
      -- When the problem is in one segment
      segment_id INT UNSIGNED DEFAULT NULL,
      reason ENUM('consent', 'sensitive', 'wrong_details', 'audio', 'other') NOT NULL,
      comment TEXT CHARACTER SET utf8mb4,
      status ENUM('open', 'resolved') NOT NULL DEFAULT 'open',
      resolution TEXT CHARACTER SET utf8mb4,
      created_by CHAR(36) DEFAULT NULL,
      resolved_by CHAR(36) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT NOW(),
      resolved_at DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      KEY (status, id),
      FOREIGN KEY (recording_id) REFERENCES fork_recordings(id) ON DELETE CASCADE,
      FOREIGN KEY (segment_id) REFERENCES fork_segments(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES user_clients(client_id) ON DELETE SET NULL,
      FOREIGN KEY (resolved_by) REFERENCES user_clients(client_id) ON DELETE SET NULL
    )
  `)
}

export const down = async function (db: any): Promise<any> {
  await db.runSql(`DROP TABLE fork_reports`)
}
