/**
 * Baseline schema for Phase 1. All four tables from the PRD's technical
 * considerations are created up front so later features (settings, persona,
 * chat card, chat UI) only add logic, not migrations.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model TEXT NOT NULL,
  base_url TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS persona (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_group (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_card (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  other_info TEXT NOT NULL DEFAULT '',
  avatar_path TEXT,
  long_term_goal TEXT NOT NULL DEFAULT '',
  short_term_goal TEXT NOT NULL DEFAULT '',
  persona_id INTEGER REFERENCES persona(id) ON DELETE SET NULL,
  group_id INTEGER REFERENCES chat_group(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  history_summary TEXT NOT NULL DEFAULT '',
  summarized_through_message_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_chat_card_persona_id ON chat_card(persona_id);
CREATE INDEX IF NOT EXISTS idx_chat_card_group_id ON chat_card(group_id);

CREATE TABLE IF NOT EXISTS llm_model_card (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model TEXT NOT NULL,
  base_url TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_preference (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  translate_non_chinese INTEGER NOT NULL DEFAULT 1,
  auto_add_to_history INTEGER NOT NULL DEFAULT 0,
  auto_extract_info INTEGER NOT NULL DEFAULT 1,
  dark_mode INTEGER NOT NULL DEFAULT 0,
  debug_prompt_export INTEGER NOT NULL DEFAULT 0,
  debug_export_dir TEXT,
  lock_password_hash TEXT,
  lock_password_salt TEXT,
  web_search_enabled INTEGER NOT NULL DEFAULT 0,
  web_search_api_key TEXT,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO app_preference (id, translate_non_chinese, auto_add_to_history, auto_extract_info, dark_mode, debug_prompt_export, debug_export_dir, web_search_enabled, web_search_api_key, updated_at)
VALUES (1, 1, 0, 1, 0, 0, NULL, 0, NULL, 0);

CREATE TABLE IF NOT EXISTS message (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_card_id INTEGER NOT NULL REFERENCES chat_card(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('other', 'self', 'annotation')),
  content TEXT NOT NULL DEFAULT '',
  translation TEXT,
  annotation_type TEXT,
  annotation_text TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_chat_card_id ON message(chat_card_id);
`;
