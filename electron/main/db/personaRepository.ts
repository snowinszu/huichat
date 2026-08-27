import type Database from 'better-sqlite3';
import type { CreatePersonaInput, PersonaRecord, PersonaWithUsage, UpdatePersonaInput } from '../../shared/ipc-types.js';

interface PersonaRow {
  id: number;
  name: string;
  bio: string;
  created_at: number;
  updated_at: number;
}

function toRecord(row: PersonaRow): PersonaRecord {
  return {
    id: row.id,
    name: row.name,
    bio: row.bio,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPersona(db: Database.Database, input: CreatePersonaInput): PersonaRecord {
  const now = Date.now();
  const result = db
    .prepare('INSERT INTO persona (name, bio, created_at, updated_at) VALUES (@name, @bio, @createdAt, @updatedAt)')
    .run({ name: input.name, bio: input.bio ?? '', createdAt: now, updatedAt: now });

  // Freshly inserted, so it's always found — the non-null assertion documents that invariant.
  return getPersona(db, Number(result.lastInsertRowid))!;
}

export function getPersona(db: Database.Database, id: number): PersonaRecord | undefined {
  const row = db.prepare('SELECT * FROM persona WHERE id = ?').get(id) as PersonaRow | undefined;
  return row ? toRecord(row) : undefined;
}

/**
 * Every persona plus how many chat cards currently reference it, so the
 * roles screen can show the usage badge and decide plain-vs-warning delete
 * without a second round trip. Creation order (oldest first) — unlike chat
 * cards, personas aren't "recently active," so there's no reason to reorder
 * the list as the user edits one.
 */
export function listPersonasWithUsage(db: Database.Database): PersonaWithUsage[] {
  const rows = db
    .prepare(
      `SELECT persona.*, COUNT(chat_card.id) AS usage_count
       FROM persona
       LEFT JOIN chat_card ON chat_card.persona_id = persona.id
       GROUP BY persona.id
       ORDER BY persona.created_at ASC, persona.id ASC`,
    )
    .all() as Array<PersonaRow & { usage_count: number }>;

  return rows.map((row) => ({ ...toRecord(row), usageCount: row.usage_count }));
}

/** Writes only the fields present in `patch`, immediately — same no-draft-state contract as chatCardRepository.updateChatCard. */
export function updatePersona(db: Database.Database, id: number, patch: UpdatePersonaInput): PersonaRecord {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as Array<[keyof UpdatePersonaInput, string]>;

  if (entries.length > 0) {
    const setClause = entries.map(([key]) => `${key} = @${key}`).join(', ');
    const params: Record<string, unknown> = { id, updatedAt: Date.now() };
    for (const [key, value] of entries) params[key] = value;
    db.prepare(`UPDATE persona SET ${setClause}, updated_at = @updatedAt WHERE id = @id`).run(params);
  }

  const updated = getPersona(db, id);
  if (!updated) throw new Error(`persona ${id} not found`);
  return updated;
}

/**
 * Deleting a persona that's still referenced by chat cards is allowed — the
 * `chat_card.persona_id` foreign key is `ON DELETE SET NULL`, so those cards
 * simply lose their persona link instead of the delete being blocked or
 * cascading. The confirmation UI (which already knows the usage count from
 * listPersonasWithUsage) is what warns the user before calling this.
 */
export function deletePersona(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM persona WHERE id = ?').run(id);
}
