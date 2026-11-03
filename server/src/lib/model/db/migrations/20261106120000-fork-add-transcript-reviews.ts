// Fork: reviews of transcripts (see server/src/fork/stories/reviews.ts).
export const up = async function (db: any): Promise<any> {
  // Anyone signed in can transcribe, so the role that matters is reviewing
  await db.runSql(`
    ALTER TABLE fork_user_roles
    MODIFY role ENUM('admin', 'moderator', 'transcriber', 'reviewer') NOT NULL
  `)
  await db.runSql(
    `UPDATE fork_user_roles SET role = 'reviewer' WHERE role = 'transcriber'`
  )
  await db.runSql(`
    ALTER TABLE fork_user_roles
    MODIFY role ENUM('admin', 'moderator', 'reviewer') NOT NULL
  `)

  // A review is of one version of a transcript; a new version starts
  // unreviewed. The latest review of a version applies.
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS fork_transcript_reviews (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      transcript_id INT UNSIGNED NOT NULL,
      verdict ENUM('approved', 'needs_work') NOT NULL,
      comment TEXT CHARACTER SET utf8mb4,
      reviewed_by CHAR(36) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id),
      KEY (transcript_id, id),
      FOREIGN KEY (transcript_id) REFERENCES fork_transcripts(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES user_clients(client_id) ON DELETE SET NULL
    )
  `)
}

export const down = async function (db: any): Promise<any> {
  await db.runSql(`DROP TABLE fork_transcript_reviews`)
  await db.runSql(`
    ALTER TABLE fork_user_roles
    MODIFY role ENUM('admin', 'moderator', 'transcriber', 'reviewer') NOT NULL
  `)
  await db.runSql(
    `UPDATE fork_user_roles SET role = 'transcriber' WHERE role = 'reviewer'`
  )
  await db.runSql(`
    ALTER TABLE fork_user_roles
    MODIFY role ENUM('admin', 'moderator', 'transcriber') NOT NULL
  `)
}
