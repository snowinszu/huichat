import type Database from 'better-sqlite3';
import type { CreateGroupInput, GroupRecord, GroupWithUsage } from '../../shared/ipc-types.js';

interface GroupRow {
  id: number;
  name: string;
  created_at: number;
  updated_at: number;
}

function toRecord(row: GroupRow): GroupRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createGroup(db: Database.Database, input: CreateGroupInput): GroupRecord {
  const now = Date.now();
  const result = db
    .prepare('INSERT INTO chat_group (name, created_at, updated_at) VALUES (@name, @createdAt, @updatedAt)')
    .run({ name: input.name, createdAt: now, updatedAt: now });

  // Freshly inserted, so it's always found — the non-null assertion documents that invariant.
  return getGroup(db, Number(result.lastInsertRowid))!;
}

export function getGroup(db: Database.Database, id: number): GroupRecord | undefined {
  const row = db.prepare('SELECT * FROM chat_group WHERE id = ?').get(id) as GroupRow | undefined;
  return row ? toRecord(row) : undefined;
}

/**
 * Every group plus how many chat cards currently reference it, so the home
 * screen's delete confirmation can warn "N 个聊天对象将变为未分组" without a
 * second round trip. Creation order (oldest first) — the home screen renders
 * group sections in this same order (FR-9), so callers don't need to re-sort.
 */
export function listGroupsWithUsage(db: Database.Database): GroupWithUsage[] {
  const rows = db
    .prepare(
      `SELECT chat_group.*, COUNT(chat_card.id) AS usage_count
       FROM chat_group
       LEFT JOIN chat_card ON chat_card.group_id = chat_group.id
       GROUP BY chat_group.id
       ORDER BY chat_group.created_at ASC, chat_group.id ASC`,
    )
    .all() as Array<GroupRow & { usage_count: number }>;

  return rows.map((row) => ({ ...toRecord(row), usageCount: row.usage_count }));
}

export function renameGroup(db: Database.Database, id: number, name: string): GroupRecord {
  db.prepare('UPDATE chat_group SET name = @name, updated_at = @updatedAt WHERE id = @id').run({
    id,
    name,
    updatedAt: Date.now(),
  });

  const updated = getGroup(db, id);
  if (!updated) throw new Error(`chat_group ${id} not found`);
  return updated;
}

/**
 * Deleting a group that's still referenced by chat cards is allowed — the
 * `chat_card.group_id` foreign key is `ON DELETE SET NULL`, so those cards
 * simply fall back to the "未分组" bucket instead of the delete being
 * blocked or cascading. The confirmation UI (which already knows the usage
 * count from listGroupsWithUsage) is what warns the user before calling this.
 */
export function deleteGroup(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM chat_group WHERE id = ?').run(id);
}
