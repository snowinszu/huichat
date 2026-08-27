import type Database from 'better-sqlite3';
import type { InsertMessageInput, MessageRecord, MessageRole } from '../../shared/ipc-types.js';

interface MessageRow {
  id: number;
  chat_card_id: number;
  role: MessageRole;
  content: string;
  translation: string | null;
  annotation_type: string | null;
  annotation_text: string | null;
  created_at: number;
}

function toRecord(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    chatCardId: row.chat_card_id,
    role: row.role,
    content: row.content,
    translation: row.translation,
    annotationType: row.annotation_type,
    annotationText: row.annotation_text,
    createdAt: row.created_at,
  };
}

/**
 * Persists a message that already happened (received, sent, or an
 * image/emoji annotation). Candidate replies the user hasn't sent yet never
 * reach this — `role` only accepts 'other' | 'self' | 'annotation', not a
 * draft/candidate state.
 */
export function insertMessage(db: Database.Database, input: InsertMessageInput): MessageRecord {
  const result = db
    .prepare(
      `INSERT INTO message (chat_card_id, role, content, translation, annotation_type, annotation_text, created_at)
       VALUES (@chatCardId, @role, @content, @translation, @annotationType, @annotationText, @createdAt)`,
    )
    .run({
      chatCardId: input.chatCardId,
      role: input.role,
      content: input.content ?? '',
      translation: input.translation ?? null,
      annotationType: input.annotationType ?? null,
      annotationText: input.annotationText ?? null,
      createdAt: Date.now(),
    });

  const row = db.prepare('SELECT * FROM message WHERE id = ?').get(result.lastInsertRowid) as MessageRow;
  return toRecord(row);
}

/** A chat card's messages oldest-first, matching how a conversation thread reads top to bottom. */
export function listMessagesByChatCard(db: Database.Database, chatCardId: number): MessageRecord[] {
  const rows = db
    .prepare('SELECT * FROM message WHERE chat_card_id = ? ORDER BY created_at ASC, id ASC')
    .all(chatCardId) as MessageRow[];
  return rows.map(toRecord);
}

/** Idempotent: deleting an id that's already gone (or never existed) is a no-op, not an error. */
export function deleteMessage(db: Database.Database, messageId: number): void {
  db.prepare('DELETE FROM message WHERE id = ?').run(messageId);
}
