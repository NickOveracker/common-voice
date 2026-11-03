// Fork: speakers, consent and long recordings (see server/src/fork/stories/).
// Prefixed with fork_ so they can't clash with tables added upstream.
export const up = async function (db: any): Promise<any> {
  // People whose voices are recorded. Not necessarily site users: facilitators
  // create speakers for the elders they record.
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS fork_speakers (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      display_name VARCHAR(255) CHARACTER SET utf8mb4 NOT NULL,
      full_name VARCHAR(255) CHARACTER SET utf8mb4 DEFAULT NULL,
      birth_year SMALLINT UNSIGNED DEFAULT NULL,
      gender VARCHAR(64) CHARACTER SET utf8mb4 DEFAULT NULL,
      region VARCHAR(255) CHARACTER SET utf8mb4 DEFAULT NULL,
      notes TEXT CHARACTER SET utf8mb4,
      client_id CHAR(36) DEFAULT NULL,
      created_by CHAR(36) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT NOW(),
      updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
      PRIMARY KEY (id),
      UNIQUE KEY (client_id),
      FOREIGN KEY (client_id) REFERENCES user_clients(client_id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES user_clients(client_id) ON DELETE SET NULL
    )
  `)

  // Consent is never edited: a change adds a new row, and withdrawal is
  // recorded on the row. The latest row that isn't withdrawn applies.
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS fork_consents (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      speaker_id INT UNSIGNED NOT NULL,
      archive TINYINT(1) NOT NULL,
      community_use TINYINT(1) NOT NULL,
      research TINYINT(1) NOT NULL,
      speech_technology TINYINT(1) NOT NULL,
      method ENUM('signed_form', 'recorded_statement', 'verbal', 'family_or_community', 'other') NOT NULL,
      given_on DATE DEFAULT NULL,
      notes TEXT CHARACTER SET utf8mb4,
      recorded_by CHAR(36) DEFAULT NULL,
      withdrawn_at DATETIME DEFAULT NULL,
      withdrawn_by CHAR(36) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id),
      FOREIGN KEY (speaker_id) REFERENCES fork_speakers(id) ON DELETE CASCADE,
      FOREIGN KEY (recorded_by) REFERENCES user_clients(client_id) ON DELETE SET NULL,
      FOREIGN KEY (withdrawn_by) REFERENCES user_clients(client_id) ON DELETE SET NULL
    )
  `)

  // Long recordings, either recorded in the browser or uploaded. Audio is
  // uploaded in chunks, then joined and transcoded in the background.
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS fork_recordings (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      title VARCHAR(255) CHARACTER SET utf8mb4 NOT NULL,
      description TEXT CHARACTER SET utf8mb4,
      languages SET('ain', 'ja') NOT NULL,
      source ENUM('browser', 'upload') NOT NULL,
      status ENUM('uploading', 'processing', 'ready', 'failed') NOT NULL DEFAULT 'uploading',
      recorded_on VARCHAR(10) DEFAULT NULL,
      location VARCHAR(255) CHARACTER SET utf8mb4 DEFAULT NULL,
      original_filename VARCHAR(255) CHARACTER SET utf8mb4 DEFAULT NULL,
      original_mime VARCHAR(255) DEFAULT NULL,
      original_path VARCHAR(255) DEFAULT NULL,
      playback_path VARCHAR(255) DEFAULT NULL,
      size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      duration_ms INT UNSIGNED DEFAULT NULL,
      error TEXT,
      created_by CHAR(36) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT NOW(),
      updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
      PRIMARY KEY (id),
      KEY (status),
      FOREIGN KEY (created_by) REFERENCES user_clients(client_id) ON DELETE SET NULL
    )
  `)

  await db.runSql(`
    CREATE TABLE IF NOT EXISTS fork_recording_speakers (
      recording_id INT UNSIGNED NOT NULL,
      speaker_id INT UNSIGNED NOT NULL,
      PRIMARY KEY (recording_id, speaker_id),
      FOREIGN KEY (recording_id) REFERENCES fork_recordings(id) ON DELETE CASCADE,
      FOREIGN KEY (speaker_id) REFERENCES fork_speakers(id)
    )
  `)

  await db.runSql(`
    CREATE TABLE IF NOT EXISTS fork_recording_chunks (
      recording_id INT UNSIGNED NOT NULL,
      chunk_index INT UNSIGNED NOT NULL,
      size_bytes INT UNSIGNED NOT NULL,
      PRIMARY KEY (recording_id, chunk_index),
      FOREIGN KEY (recording_id) REFERENCES fork_recordings(id) ON DELETE CASCADE
    )
  `)
}

export const down = async function (db: any): Promise<any> {
  await db.runSql(`DROP TABLE fork_recording_chunks`)
  await db.runSql(`DROP TABLE fork_recording_speakers`)
  await db.runSql(`DROP TABLE fork_recordings`)
  await db.runSql(`DROP TABLE fork_consents`)
  await db.runSql(`DROP TABLE fork_speakers`)
}
