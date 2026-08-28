import type Database from 'better-sqlite3';

/**
 * The "forgot password" recovery path (see PRD non-goals: no cloud/security-
 * question recovery) — wipes every user-data table and puts `app_preference`
 * back to schema.ts's fresh-install defaults, lock password included. The
 * UI gates this behind a typed confirmation word; nothing here re-confirms
 * that, since by the time this runs the user has already agreed to lose
 * everything.
 */
export function resetAppData(db: Database.Database): void {
  const reset = db.transaction(() => {
    db.exec('DELETE FROM message');
    db.exec('DELETE FROM chat_card');
    db.exec('DELETE FROM persona');
    db.exec('DELETE FROM llm_model_card');
    db.exec('DELETE FROM settings');
    db.exec('DELETE FROM app_preference');
    db.prepare(
      `INSERT INTO app_preference (id, translate_non_chinese, auto_add_to_history, auto_extract_info, dark_mode, debug_prompt_export, debug_export_dir, updated_at)
       VALUES (1, 1, 0, 1, 0, 0, NULL, @updatedAt)`,
    ).run({ updatedAt: Date.now() });
  });
  reset();
}
