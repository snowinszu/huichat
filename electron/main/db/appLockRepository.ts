import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

interface AppLockRow {
  lock_password_hash: string | null;
  lock_password_salt: string | null;
}

const SCRYPT_KEY_LENGTH = 64;

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex');
}

/** `enabled` means a password is currently set — the settings toggle and the title-bar lock icon both key off this. */
export function getAppLockStatus(db: Database.Database): { enabled: boolean } {
  const row = db.prepare('SELECT lock_password_hash, lock_password_salt FROM app_preference WHERE id = 1').get() as AppLockRow;
  return { enabled: row.lock_password_hash !== null };
}

/** Generates a fresh salt on every call — even "changing" the password from one value to itself gets a new hash, never reusing an old salt. */
export function setAppLockPassword(db: Database.Database, password: string): void {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  db.prepare('UPDATE app_preference SET lock_password_hash = @hash, lock_password_salt = @salt, updated_at = @updatedAt WHERE id = 1').run({
    hash,
    salt,
    updatedAt: Date.now(),
  });
}

/** `timingSafeEqual` (not `===`) so a wrong guess can't be narrowed down byte-by-byte via response-time differences. */
export function verifyAppLockPassword(db: Database.Database, password: string): boolean {
  const row = db.prepare('SELECT lock_password_hash, lock_password_salt FROM app_preference WHERE id = 1').get() as AppLockRow;
  if (!row.lock_password_hash || !row.lock_password_salt) return false;

  const candidate = hashPassword(password, row.lock_password_salt);
  const stored = Buffer.from(row.lock_password_hash, 'hex');
  const candidateBuffer = Buffer.from(candidate, 'hex');
  if (stored.length !== candidateBuffer.length) return false;
  return crypto.timingSafeEqual(stored, candidateBuffer);
}

export function clearAppLockPassword(db: Database.Database): void {
  db.prepare('UPDATE app_preference SET lock_password_hash = NULL, lock_password_salt = NULL, updated_at = @updatedAt WHERE id = 1').run({
    updatedAt: Date.now(),
  });
}
