import type Database from 'better-sqlite3';
import type { CreateModelCardInput, LlmProviderId, ModelCardRecord, UpdateModelCardInput } from '../../shared/ipc-types.js';

interface ModelCardRow {
  id: number;
  name: string;
  provider: LlmProviderId;
  api_key: string;
  model: string;
  base_url: string | null;
  is_current: 0 | 1;
  created_at: number;
  updated_at: number;
}

function toRecord(row: ModelCardRow): ModelCardRecord {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    apiKey: row.api_key,
    model: row.model,
    baseUrl: row.base_url,
    isCurrent: row.is_current === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** New cards always start as not-current — whether a freshly created card should become current (e.g. "first card ever") is a caller decision, not this function's. */
export function createModelCard(db: Database.Database, input: CreateModelCardInput): ModelCardRecord {
  const now = Date.now();
  const result = db
    .prepare(
      `INSERT INTO llm_model_card (name, provider, api_key, model, base_url, is_current, created_at, updated_at)
       VALUES (@name, @provider, @apiKey, @model, @baseUrl, 0, @createdAt, @updatedAt)`,
    )
    .run({
      name: input.name,
      provider: input.provider,
      apiKey: input.apiKey,
      model: input.model,
      baseUrl: input.baseUrl ?? null,
      createdAt: now,
      updatedAt: now,
    });

  // Freshly inserted, so it's always found — the non-null assertion documents that invariant.
  return getModelCard(db, Number(result.lastInsertRowid))!;
}

export function getModelCard(db: Database.Database, id: number): ModelCardRecord | undefined {
  const row = db.prepare('SELECT * FROM llm_model_card WHERE id = ?').get(id) as ModelCardRow | undefined;
  return row ? toRecord(row) : undefined;
}

/** The one card every AI-calling feature should use. `undefined` when no card has been created yet, or none has been marked current. */
export function getCurrentModelCard(db: Database.Database): ModelCardRecord | undefined {
  const row = db.prepare('SELECT * FROM llm_model_card WHERE is_current = 1 LIMIT 1').get() as ModelCardRow | undefined;
  return row ? toRecord(row) : undefined;
}

/** Oldest first, matching the persona list ordering convention. */
export function listModelCards(db: Database.Database): ModelCardRecord[] {
  const rows = db.prepare('SELECT * FROM llm_model_card ORDER BY created_at ASC, id ASC').all() as ModelCardRow[];
  return rows.map(toRecord);
}

const UPDATABLE_COLUMNS: Record<keyof UpdateModelCardInput, string> = {
  name: 'name',
  provider: 'provider',
  apiKey: 'api_key',
  model: 'model',
  baseUrl: 'base_url',
};

/** Writes only the fields present in `patch`, immediately — same no-draft-state contract as chatCardRepository.updateChatCard. Never touches `is_current`; use setCurrentModelCard for that. */
export function updateModelCard(db: Database.Database, id: number, patch: UpdateModelCardInput): ModelCardRecord {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as Array<
    [keyof UpdateModelCardInput, string | null]
  >;

  if (entries.length > 0) {
    const setClause = entries.map(([key]) => `${UPDATABLE_COLUMNS[key]} = @${key}`).join(', ');
    const params: Record<string, unknown> = { id, updatedAt: Date.now() };
    for (const [key, value] of entries) params[key] = value;
    db.prepare(`UPDATE llm_model_card SET ${setClause}, updated_at = @updatedAt WHERE id = @id`).run(params);
  }

  const updated = getModelCard(db, id);
  if (!updated) throw new Error(`llm_model_card ${id} not found`);
  return updated;
}

export function deleteModelCard(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM llm_model_card WHERE id = ?').run(id);
}

/**
 * Atomically moves the "current" flag to `id`: clears whichever row currently
 * holds it, then sets it on `id`, inside one transaction so a crash between
 * the two writes can never leave 0 or 2 current cards. better-sqlite3's
 * `.transaction()` runs synchronously, so no other query can interleave.
 */
export function setCurrentModelCard(db: Database.Database, id: number): ModelCardRecord {
  const run = db.transaction((cardId: number) => {
    db.prepare('UPDATE llm_model_card SET is_current = 0 WHERE is_current = 1').run();
    const result = db.prepare('UPDATE llm_model_card SET is_current = 1, updated_at = ? WHERE id = ?').run(Date.now(), cardId);
    if (result.changes === 0) throw new Error(`llm_model_card ${cardId} not found`);
  });

  run(id);
  return getModelCard(db, id)!;
}
