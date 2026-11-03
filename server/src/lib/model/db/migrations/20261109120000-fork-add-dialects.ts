// Fork: dialects of speakers and recordings (see
// server/src/fork/stories/dialects.ts).
export const up = async function (db: any): Promise<any> {
  // Anyone can add a dialect: speakers say what they speak. Admins tidy up
  // afterwards by merging entries; a merged entry stays as an alias of the
  // one it was merged into, so its name still finds it.
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS fork_dialects (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      merged_into INT UNSIGNED DEFAULT NULL,
      created_by CHAR(36) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id),
      UNIQUE KEY (name),
      FOREIGN KEY (merged_into) REFERENCES fork_dialects(id),
      FOREIGN KEY (created_by) REFERENCES user_clients(client_id) ON DELETE SET NULL
    )
  `)

  await db.runSql(`
    CREATE TABLE IF NOT EXISTS fork_speaker_dialects (
      speaker_id INT UNSIGNED NOT NULL,
      dialect_id INT UNSIGNED NOT NULL,
      PRIMARY KEY (speaker_id, dialect_id),
      FOREIGN KEY (speaker_id) REFERENCES fork_speakers(id) ON DELETE CASCADE,
      FOREIGN KEY (dialect_id) REFERENCES fork_dialects(id)
    )
  `)

  await db.runSql(`
    CREATE TABLE IF NOT EXISTS fork_recording_dialects (
      recording_id INT UNSIGNED NOT NULL,
      dialect_id INT UNSIGNED NOT NULL,
      PRIMARY KEY (recording_id, dialect_id),
      FOREIGN KEY (recording_id) REFERENCES fork_recordings(id) ON DELETE CASCADE,
      FOREIGN KEY (dialect_id) REFERENCES fork_dialects(id)
    )
  `)
}

export const down = async function (db: any): Promise<any> {
  await db.runSql(`DROP TABLE fork_recording_dialects`)
  await db.runSql(`DROP TABLE fork_speaker_dialects`)
  await db.runSql(`DROP TABLE fork_dialects`)
}
