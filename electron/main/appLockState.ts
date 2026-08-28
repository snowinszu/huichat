// Whether the app is currently locked, for the current process lifetime
// only — deliberately not persisted (see PRD non-goals: no auto-lock at
// startup). Lives in the main process, not renderer state, so it survives a
// renderer reload triggered via a menu item that `before-input-event` didn't
// catch — the renderer re-queries this on mount and re-shows the overlay
// instead of silently landing on unlocked content.
let locked = false;

export function isAppLocked(): boolean {
  return locked;
}

export function setAppLocked(value: boolean): void {
  locked = value;
}
