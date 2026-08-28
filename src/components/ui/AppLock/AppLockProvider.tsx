import { useEffect, useState, type ReactNode } from 'react';
import { AppLockContext } from './AppLockContext';
import { LockOverlay } from './LockOverlay';

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);

  // Main process is the source of truth (see electron/main/appLockState.ts) —
  // asking on mount recovers the locked state if a menu-triggered reload
  // (not caught by the before-input-event guard) reset this component.
  useEffect(() => {
    window.api?.appLock
      .isLocked()
      .then(setLocked)
      .catch(() => {
        // No Electron bridge in this context — stay unlocked.
      });
    window.api?.appLock
      .getStatus()
      .then((status) => setLockEnabled(status.enabled))
      .catch(() => {
        // No Electron bridge in this context — icon stays hidden.
      });
  }, []);

  function engageLock() {
    window.api?.appLock
      .engage()
      .then(() => setLocked(true))
      .catch(() => {
        // No password set yet (or no bridge) — nothing to lock into.
      });
  }

  async function disengageLock(password: string): Promise<boolean> {
    if (!window.api) return false;
    const correct = await window.api.appLock.unlock(password);
    if (correct) setLocked(false);
    return correct;
  }

  // Every mounted screen (Home's chat-card list, an open ChatScreen's
  // messages, …) is still holding data that just got wiped from the
  // database — patching `locked`/`lockEnabled` back to false would leave all
  // of that stale in memory. A renderer reload throws all of it away and
  // re-mounts fresh against the now-empty database; it does NOT restart the
  // Electron process (main process, and its db connection, keep running),
  // so this still satisfies "continue using the app without a process
  // restart" — it's a page navigation, not an app relaunch.
  async function resetAppData(): Promise<void> {
    if (!window.api) return;
    await window.api.appLock.resetData();
    window.location.reload();
  }

  return (
    <AppLockContext.Provider value={{ locked, engageLock, disengageLock, resetAppData, lockEnabled, setLockEnabled }}>
      {/* `inert` (not just visual covering) so the locked content can't be
          reached by keyboard focus or click while still mounted — its React
          state (open chat, draft text, scroll position) stays alive underneath. */}
      <div inert={locked}>{children}</div>
      {locked && <LockOverlay />}
    </AppLockContext.Provider>
  );
}
