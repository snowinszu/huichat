import type Database from 'better-sqlite3';
import type { AppPreferenceRecord, UpdateAppPreferenceInput } from '../../shared/ipc-types.js';

interface AppPreferenceRow {
  id: 1;
  translate_non_chinese: 0 | 1;
  auto_add_to_history: 0 | 1;
  auto_extract_info: 0 | 1;
  dark_mode: 0 | 1;
  debug_prompt_export: 0 | 1;
  debug_export_dir: string | null;
  web_search_enabled: 0 | 1;
  web_search_api_key: string | null;
  updated_at: number;
}

function toRecord(row: AppPreferenceRow): AppPreferenceRecord {
  return {
    translateNonChinese: row.translate_non_chinese === 1,
    autoAddToHistory: row.auto_add_to_history === 1,
    autoExtractInfo: row.auto_extract_info === 1,
    darkMode: row.dark_mode === 1,
    debugPromptExport: row.debug_prompt_export === 1,
    debugExportDir: row.debug_export_dir,
    webSearchEnabled: row.web_search_enabled === 1,
    webSearchApiKey: row.web_search_api_key,
    updatedAt: row.updated_at,
  };
}

/** Always returns a row — schema.ts seeds row id=1 with defaults via `INSERT OR IGNORE`, so callers never need to handle a missing-preferences case. */
export function getAppPreference(db: Database.Database): AppPreferenceRecord {
  const row = db.prepare('SELECT * FROM app_preference WHERE id = 1').get() as AppPreferenceRow;
  return toRecord(row);
}

const UPDATABLE_COLUMNS: Record<keyof UpdateAppPreferenceInput, string> = {
  translateNonChinese: 'translate_non_chinese',
  autoAddToHistory: 'auto_add_to_history',
  autoExtractInfo: 'auto_extract_info',
  darkMode: 'dark_mode',
  debugPromptExport: 'debug_prompt_export',
  debugExportDir: 'debug_export_dir',
  webSearchEnabled: 'web_search_enabled',
  webSearchApiKey: 'web_search_api_key',
};

// debugExportDir is a plain string (or null to clear it), not a toggle — the
// blanket `value ? 1 : 0` every other field here uses would corrupt it into
// 0/1, so each column converts its own JS value to the SQLite param it needs.
const COLUMN_PARAM_VALUE: Record<keyof UpdateAppPreferenceInput, (value: unknown) => unknown> = {
  translateNonChinese: (value) => (value ? 1 : 0),
  autoAddToHistory: (value) => (value ? 1 : 0),
  autoExtractInfo: (value) => (value ? 1 : 0),
  darkMode: (value) => (value ? 1 : 0),
  debugPromptExport: (value) => (value ? 1 : 0),
  debugExportDir: (value) => value,
  webSearchEnabled: (value) => (value ? 1 : 0),
  webSearchApiKey: (value) => value,
};

/** Writes only the fields present in `patch`, immediately — same no-draft-state contract as every other repository in this app (e.g. `updatePersona`). */
export function updateAppPreference(db: Database.Database, patch: UpdateAppPreferenceInput): AppPreferenceRecord {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as Array<[keyof UpdateAppPreferenceInput, unknown]>;

  if (entries.length > 0) {
    const setClause = entries.map(([key]) => `${UPDATABLE_COLUMNS[key]} = @${key}`).join(', ');
    const params: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of entries) params[key] = COLUMN_PARAM_VALUE[key](value);
    db.prepare(`UPDATE app_preference SET ${setClause}, updated_at = @updatedAt WHERE id = 1`).run(params);
  }

  return getAppPreference(db);
}
