import path from 'node:path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from './schema.js';
import { migrateMessageCascadeDelete, migrateAppPreferenceDebugExportColumns, migrateChatCardHistorySummaryColumns } from './migrations.js';

let db: Database.Database | null = null;

/**
 * Opens (creating on first launch) the local SQLite database in Electron's
 * per-OS app-data directory and applies the baseline schema. Idempotent:
 * CREATE TABLE IF NOT EXISTS means re-running on every launch is safe.
 *
 * `migrateMessageCascadeDelete` runs first (and before `foreign_keys` gets
 * turned back on inside it) because it repairs a table that may already
 * exist with a constraint predating the baseline schema — the idempotent
 * CREATE TABLE below can't fix an existing table, only create a missing one.
 * `migrateAppPreferenceDebugExportColumns` and `migrateChatCardHistorySummaryColumns`
 * fix the same class of problem for columns added straight into schema.ts
 * without a migration.
 */
export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'app.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrateMessageCascadeDelete(db);
  migrateAppPreferenceDebugExportColumns(db);
  migrateChatCardHistorySummaryColumns(db);
  db.exec(SCHEMA_SQL);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized yet — call initDatabase() first.');
  }
  return db;
}
