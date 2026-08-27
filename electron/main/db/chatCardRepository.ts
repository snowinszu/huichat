import type Database from 'better-sqlite3';
import { deleteAvatarIfLocal } from '../avatarStorage.js';
import type { ChatCardRecord, CreateChatCardInput, UpdateChatCardInput } from '../../shared/ipc-types.js';

interface ChatCardRow {
  id: number;
  name: string;
  other_info: string;
  avatar_path: string | null;
  long_term_goal: string;
  short_term_goal: string;
  persona_id: number | null;
  created_at: number;
  updated_at: number;
  history_summary: string;
  summarized_through_message_id: number | null;
}

function toRecord(row: ChatCardRow): ChatCardRecord {
  return {
    id: row.id,
    name: row.name,
    otherInfo: row.other_info,
    avatarPath: row.avatar_path,
    longTermGoal: row.long_term_goal,
    shortTermGoal: row.short_term_goal,
    personaId: row.persona_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    historySummary: row.history_summary,
    summarizedThroughMessageId: row.summarized_through_message_id,
  };
}

export function createChatCard(db: Database.Database, input: CreateChatCardInput): ChatCardRecord {
  const now = Date.now();
  const result = db
    .prepare(
      `INSERT INTO chat_card (name, other_info, avatar_path, long_term_goal, short_term_goal, persona_id, created_at, updated_at)
       VALUES (@name, @otherInfo, @avatarPath, @longTermGoal, @shortTermGoal, @personaId, @createdAt, @updatedAt)`,
    )
    .run({
      name: input.name,
      otherInfo: input.otherInfo ?? '',
      avatarPath: input.avatarPath ?? null,
      longTermGoal: input.longTermGoal ?? '',
      shortTermGoal: input.shortTermGoal ?? '',
      personaId: input.personaId ?? null,
      createdAt: now,
      updatedAt: now,
    });

  // Freshly inserted, so it's always found — the non-null assertion documents that invariant.
  return getChatCard(db, Number(result.lastInsertRowid))!;
}

export function getChatCard(db: Database.Database, id: number): ChatCardRecord | undefined {
  const row = db.prepare('SELECT * FROM chat_card WHERE id = ?').get(id) as ChatCardRow | undefined;
  return row ? toRecord(row) : undefined;
}

/**
 * Most recently edited first, so the home grid surfaces active conversations.
 * `id DESC` breaks ties from same-millisecond updated_at values (e.g. a
 * create immediately followed by another create) deterministically.
 */
export function listChatCards(db: Database.Database): ChatCardRecord[] {
  const rows = db.prepare('SELECT * FROM chat_card ORDER BY updated_at DESC, id DESC').all() as ChatCardRow[];
  return rows.map(toRecord);
}

const UPDATABLE_COLUMNS: Record<keyof UpdateChatCardInput, string> = {
  name: 'name',
  otherInfo: 'other_info',
  avatarPath: 'avatar_path',
  longTermGoal: 'long_term_goal',
  shortTermGoal: 'short_term_goal',
  personaId: 'persona_id',
  historySummary: 'history_summary',
  summarizedThroughMessageId: 'summarized_through_message_id',
};

/**
 * Writes only the fields present in `patch`, immediately — there's no
 * draft/save-later state, so every card edit (info, goals, persona link)
 * lands in SQLite as soon as it happens rather than being batched. When the
 * patch replaces `avatarPath`, the previous thumbnail file (if any) is
 * deleted so re-uploading a new avatar doesn't leak the old one on disk.
 */
export function updateChatCard(db: Database.Database, id: number, patch: UpdateChatCardInput): ChatCardRecord {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as Array<
    [keyof UpdateChatCardInput, string | number | null]
  >;

  if (entries.length > 0) {
    if ('avatarPath' in patch) {
      const previous = getChatCard(db, id);
      if (previous && previous.avatarPath !== patch.avatarPath) {
        deleteAvatarIfLocal(previous.avatarPath);
      }
    }

    const setClause = entries.map(([key]) => `${UPDATABLE_COLUMNS[key]} = @${key}`).join(', ');
    const params: Record<string, unknown> = { id, updatedAt: Date.now() };
    for (const [key, value] of entries) params[key] = value;
    db.prepare(`UPDATE chat_card SET ${setClause}, updated_at = @updatedAt WHERE id = @id`).run(params);
  }

  const updated = getChatCard(db, id);
  if (!updated) throw new Error(`chat_card ${id} not found`);
  return updated;
}

/** Cascades to that card's messages via the message table's ON DELETE CASCADE foreign key, and cleans up its avatar thumbnail. */
export function deleteChatCard(db: Database.Database, id: number): void {
  const existing = getChatCard(db, id);
  db.prepare('DELETE FROM chat_card WHERE id = ?').run(id);
  if (existing) deleteAvatarIfLocal(existing.avatarPath);
}
