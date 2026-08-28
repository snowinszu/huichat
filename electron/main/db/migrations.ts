import type Database from 'better-sqlite3';

interface ForeignKeyListRow {
  table: string;
  from: string;
  on_delete: string;
}

interface TableInfoRow {
  name: string;
}

/**
 * Issue #3 added `ON DELETE CASCADE` to `message.chat_card_id` (it wasn't
 * there in #1's original schema). `CREATE TABLE IF NOT EXISTS` never alters
 * an already-existing table, so any install whose SQLite file predates that
 * change is permanently stuck with the old constraint — deleting a chat
 * card that still has messages fails with "FOREIGN KEY constraint failed"
 * instead of cascading, breaking the "删除后所有历史记录将一并删除" promise
 * from the very first design. SQLite has no ALTER TABLE for changing a
 * foreign key's ON DELETE action, so fixing an existing table requires the
 * standard SQLite table-recreation dance: rename, recreate with the correct
 * constraint, copy rows, drop the old one.
 *
 * Cheap to check (one PRAGMA) and a no-op for both fresh installs (no
 * `message` table yet) and installs created after #3 (already correct) —
 * safe to call unconditionally on every launch, before the baseline
 * `CREATE TABLE IF NOT EXISTS` runs.
 *
 * The column list for the copy is computed from whichever columns the old
 * table actually has, not assumed — later issues (#8 translation, #9
 * annotations) also added columns via editing schema.ts directly with no
 * migration, so an install old enough to be missing the cascade could in
 * principle also be missing those. Copying only the intersection avoids a
 * "no such column" failure on top of the constraint one.
 */
export function migrateMessageCascadeDelete(db: Database.Database): void {
  const tableExists = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'message'`).get();
  if (!tableExists) return;

  const foreignKeys = db.pragma('foreign_key_list(message)') as ForeignKeyListRow[];
  const chatCardFk = foreignKeys.find((fk) => fk.table === 'chat_card' && fk.from === 'chat_card_id');
  if (!chatCardFk || chatCardFk.on_delete === 'CASCADE') return;

  const oldColumns = new Set((db.pragma('table_info(message)') as TableInfoRow[]).map((column) => column.name));
  const desiredColumns = ['id', 'chat_card_id', 'role', 'content', 'translation', 'annotation_type', 'annotation_text', 'created_at'];
  const columnList = desiredColumns.filter((column) => oldColumns.has(column)).join(', ');

  // Per SQLite's documented procedure for foreign-key-affecting schema
  // changes: disable enforcement for the duration of the rebuild, do it in
  // one transaction, then re-enable.
  db.pragma('foreign_keys = OFF');
  const migrate = db.transaction(() => {
    db.exec(`
      ALTER TABLE message RENAME TO message_pre_cascade_migration;

      CREATE TABLE message (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_card_id INTEGER NOT NULL REFERENCES chat_card(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('other', 'self', 'annotation')),
        content TEXT NOT NULL DEFAULT '',
        translation TEXT,
        annotation_type TEXT,
        annotation_text TEXT,
        created_at INTEGER NOT NULL
      );

      INSERT INTO message (${columnList})
      SELECT ${columnList} FROM message_pre_cascade_migration;

      DROP TABLE message_pre_cascade_migration;
    `);
  });
  migrate();
  db.pragma('foreign_keys = ON');
}

/**
 * The debug-export feature added `debug_prompt_export` and `debug_export_dir`
 * to `app_preference` by editing schema.ts's `CREATE TABLE IF NOT EXISTS`
 * directly (the same shortcut #8/#9 used for `message` — see the comment
 * above). That's fine for a brand-new install, but `app_preference` is a
 * singleton row seeded on first launch, so every existing install already
 * has the table without these columns, and `CREATE TABLE IF NOT EXISTS`
 * never alters a table that already exists. Left unfixed, the very next
 * `getAppPreference`/`updateAppPreference` call throws "no such column".
 *
 * Unlike the message-table cascade fix, no foreign key or CHECK constraint
 * is involved — SQLite's `ALTER TABLE ADD COLUMN` handles a plain new column
 * directly, no rename/recreate dance needed.
 */
export function migrateAppPreferenceDebugExportColumns(db: Database.Database): void {
  const tableExists = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_preference'`).get();
  if (!tableExists) return;

  const columns = new Set((db.pragma('table_info(app_preference)') as TableInfoRow[]).map((column) => column.name));
  if (!columns.has('debug_prompt_export')) {
    db.exec('ALTER TABLE app_preference ADD COLUMN debug_prompt_export INTEGER NOT NULL DEFAULT 0');
  }
  if (!columns.has('debug_export_dir')) {
    db.exec('ALTER TABLE app_preference ADD COLUMN debug_export_dir TEXT');
  }
}

/**
 * Same class of problem as `migrateAppPreferenceDebugExportColumns`, this
 * time for `chat_card`: the history-summary feature added `history_summary`
 * and `summarized_through_message_id` straight into schema.ts's `CREATE
 * TABLE IF NOT EXISTS`, which never alters a `chat_card` table that already
 * exists from before this feature shipped. Unlike `app_preference`,
 * `chat_card` isn't a singleton — but the fix is the same either way: a
 * plain `ALTER TABLE ADD COLUMN` for whichever columns are missing.
 */
export function migrateChatCardHistorySummaryColumns(db: Database.Database): void {
  const tableExists = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'chat_card'`).get();
  if (!tableExists) return;

  const columns = new Set((db.pragma('table_info(chat_card)') as TableInfoRow[]).map((column) => column.name));
  if (!columns.has('history_summary')) {
    db.exec("ALTER TABLE chat_card ADD COLUMN history_summary TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.has('summarized_through_message_id')) {
    db.exec('ALTER TABLE chat_card ADD COLUMN summarized_through_message_id INTEGER');
  }
}

/**
 * Same class of problem as `migrateAppPreferenceDebugExportColumns`: the
 * app-lock feature added `lock_password_hash` and `lock_password_salt`
 * straight into schema.ts's `CREATE TABLE IF NOT EXISTS`, which never alters
 * an `app_preference` table that already exists from before this feature
 * shipped.
 */
export function migrateAppPreferenceLockColumns(db: Database.Database): void {
  const tableExists = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_preference'`).get();
  if (!tableExists) return;

  const columns = new Set((db.pragma('table_info(app_preference)') as TableInfoRow[]).map((column) => column.name));
  if (!columns.has('lock_password_hash')) {
    db.exec('ALTER TABLE app_preference ADD COLUMN lock_password_hash TEXT');
  }
  if (!columns.has('lock_password_salt')) {
    db.exec('ALTER TABLE app_preference ADD COLUMN lock_password_salt TEXT');
  }
}

/**
 * Same class of problem as `migrateAppPreferenceDebugExportColumns`: the
 * web-search feature added `web_search_enabled` and `web_search_api_key`
 * straight into schema.ts's `CREATE TABLE IF NOT EXISTS`, which never
 * alters an `app_preference` table that already exists from before this
 * feature shipped.
 */
/**
 * Same class of problem as `migrateChatCardHistorySummaryColumns`: the
 * chat-card-grouping feature added `chat_group` and a `chat_card.group_id`
 * foreign key straight into schema.ts, which never alters a `chat_card`
 * table that already exists from before this feature shipped.
 *
 * `chat_group` is created here (not left to the baseline `CREATE TABLE IF
 * NOT EXISTS` below) so the table exists before the `ALTER TABLE ADD COLUMN
 * ... REFERENCES chat_group(id)` runs — on a fresh install neither table
 * exists yet, so this is a no-op and schema.ts's own `CREATE TABLE`s take
 * over from here.
 */
export function migrateChatCardGroupColumn(db: Database.Database): void {
  const tableExists = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'chat_card'`).get();
  if (!tableExists) return;

  const columns = new Set((db.pragma('table_info(chat_card)') as TableInfoRow[]).map((column) => column.name));
  if (columns.has('group_id')) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_group (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    ALTER TABLE chat_card ADD COLUMN group_id INTEGER REFERENCES chat_group(id) ON DELETE SET NULL;
  `);
}

/**
 * Same class of problem as `migrateAppPreferenceDebugExportColumns`: the
 * persona-writing-style feature added `style` straight into schema.ts's
 * `persona` table definition, which never alters a `persona` table that
 * already exists from before this feature shipped.
 */
export function migrateAddPersonaStyleColumn(db: Database.Database): void {
  const tableExists = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'persona'`).get();
  if (!tableExists) return;

  const columns = new Set((db.pragma('table_info(persona)') as TableInfoRow[]).map((column) => column.name));
  if (!columns.has('style')) {
    db.exec("ALTER TABLE persona ADD COLUMN style TEXT NOT NULL DEFAULT ''");
  }
}

export function migrateAppPreferenceWebSearchColumns(db: Database.Database): void {
  const tableExists = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_preference'`).get();
  if (!tableExists) return;

  const columns = new Set((db.pragma('table_info(app_preference)') as TableInfoRow[]).map((column) => column.name));
  if (!columns.has('web_search_enabled')) {
    db.exec('ALTER TABLE app_preference ADD COLUMN web_search_enabled INTEGER NOT NULL DEFAULT 0');
  }
  if (!columns.has('web_search_api_key')) {
    db.exec('ALTER TABLE app_preference ADD COLUMN web_search_api_key TEXT');
  }
}
