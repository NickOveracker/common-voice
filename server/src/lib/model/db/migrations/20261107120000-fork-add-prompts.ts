// Fork: prompts for stories (see server/src/fork/stories/prompts.ts).
export const up = async function (db: any): Promise<any> {
  // Topics and questions that draw out stories. Anyone can suggest one;
  // moderators approve them before they are offered.
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS fork_prompts (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      text_ja TEXT CHARACTER SET utf8mb4 NOT NULL,
      text_ain TEXT CHARACTER SET utf8mb4,
      status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      created_by CHAR(36) DEFAULT NULL,
      reviewed_by CHAR(36) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT NOW(),
      updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
      PRIMARY KEY (id),
      KEY (status),
      FOREIGN KEY (created_by) REFERENCES user_clients(client_id) ON DELETE SET NULL,
      FOREIGN KEY (reviewed_by) REFERENCES user_clients(client_id) ON DELETE SET NULL
    )
  `)

  // The prompt a recording answers, if any
  await db.runSql(`
    ALTER TABLE fork_recordings
    ADD COLUMN prompt_id INT UNSIGNED DEFAULT NULL AFTER description,
    ADD CONSTRAINT fork_recordings_prompt_fk
      FOREIGN KEY (prompt_id) REFERENCES fork_prompts(id) ON DELETE SET NULL
  `)
}

export const down = async function (db: any): Promise<any> {
  await db.runSql(`
    ALTER TABLE fork_recordings
    DROP FOREIGN KEY fork_recordings_prompt_fk,
    DROP COLUMN prompt_id
  `)
  await db.runSql(`DROP TABLE fork_prompts`)
}
