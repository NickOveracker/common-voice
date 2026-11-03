// Fork: segments of long recordings, and their transcriptions and
// translations (see server/src/fork/stories/segments.ts).
export const up = async function (db: any): Promise<any> {
  // A recording is divided into consecutive segments, with no gaps: each
  // segment ends where the next one starts. They are first found from pauses
  // in the speech, then adjusted by hand.
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS fork_segments (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      recording_id INT UNSIGNED NOT NULL,
      start_ms INT UNSIGNED NOT NULL,
      end_ms INT UNSIGNED NOT NULL,
      speaker_id INT UNSIGNED DEFAULT NULL,
      -- NULL: as the recording
      languages SET('ain', 'ja') DEFAULT NULL,
      updated_by CHAR(36) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT NOW(),
      updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
      PRIMARY KEY (id),
      UNIQUE KEY (recording_id, start_ms),
      FOREIGN KEY (recording_id) REFERENCES fork_recordings(id) ON DELETE CASCADE,
      FOREIGN KEY (speaker_id) REFERENCES fork_speakers(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES user_clients(client_id) ON DELETE SET NULL
    )
  `)

  // Transcriptions and translations are never edited: each save adds a
  // version, and the latest one of each kind is current.
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS fork_transcripts (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      segment_id INT UNSIGNED NOT NULL,
      -- Ainu is transcribed separately in Latin letters and in katakana
      -- (Japanese passages within them in Japanese writing); segments only
      -- in Japanese have a Japanese transcription instead
      kind ENUM('transcription_latin', 'transcription_kana', 'transcription_ja',
                'translation_ja', 'translation_en') NOT NULL,
      text TEXT CHARACTER SET utf8mb4 NOT NULL,
      created_by CHAR(36) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id),
      KEY (segment_id, kind, id),
      FOREIGN KEY (segment_id) REFERENCES fork_segments(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES user_clients(client_id) ON DELETE SET NULL
    )
  `)
}

export const down = async function (db: any): Promise<any> {
  await db.runSql(`DROP TABLE fork_transcripts`)
  await db.runSql(`DROP TABLE fork_segments`)
}
