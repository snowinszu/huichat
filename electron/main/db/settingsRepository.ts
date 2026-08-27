import type Database from 'better-sqlite3';
import type { LlmProviderId, SaveSettingsInput, SettingsRecord } from '../../shared/ipc-types.js';

interface SettingsRow {
  id: 1;
  provider: LlmProviderId;
  api_key: string;
  model: string;
  base_url: string | null;
  updated_at: number;
}

function toRecord(row: SettingsRow): SettingsRecord {
  return {
    provider: row.provider,
    apiKey: row.api_key,
    model: row.model,
    baseUrl: row.base_url,
    updatedAt: row.updated_at,
  };
}

export function getSettings(db: Database.Database): SettingsRecord | undefined {
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsRow | undefined;
  return row ? toRecord(row) : undefined;
}

/**
 * `settings` is a single-row table (id is CHECK'd to 1), so saving is always
 * an upsert — works whether this is the first save or an edit of an
 * existing config.
 */
export function saveSettings(db: Database.Database, input: SaveSettingsInput): SettingsRecord {
  db.prepare(
    `INSERT INTO settings (id, provider, api_key, model, base_url, updated_at)
     VALUES (1, @provider, @apiKey, @model, @baseUrl, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       provider = excluded.provider,
       api_key = excluded.api_key,
       model = excluded.model,
       base_url = excluded.base_url,
       updated_at = excluded.updated_at`,
  ).run({
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
    baseUrl: input.baseUrl ?? null,
    updatedAt: Date.now(),
  });

  // Just wrote row id=1, so it's always found — the non-null assertion documents that invariant.
  return getSettings(db)!;
}
