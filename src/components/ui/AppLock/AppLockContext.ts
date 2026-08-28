import { createContext } from 'react';

export interface AppLockContextValue {
  locked: boolean;
  /** Immediately engages the lock — called by the title-bar lock icon (Issue #55). No password needed to lock, only to unlock. */
  engageLock: () => void;
  /** Verifies the password and, if correct, clears the lock. Resolves to whether it succeeded — the overlay decides what to show either way, this never throws for a wrong guess. */
  disengageLock: (password: string) => Promise<boolean>;
  /** The "forgot password" recovery path — wipes all local data (including the lock password itself) and clears both `locked` and `lockEnabled`. */
  resetAppData: () => Promise<void>;
  /** Whether a lock password is currently set — every screen's title-bar icon reads this to decide whether to render at all. */
  lockEnabled: boolean;
  /** SettingsScreen calls this right after a successful set/clear password IPC call, so every title-bar icon updates immediately instead of only after a remount. */
  setLockEnabled: (enabled: boolean) => void;
}

export const AppLockContext = createContext<AppLockContextValue | null>(null);
