import { IconButton } from '../IconButton/IconButton';
import { IconLock } from '../icons';
import { useAppLock } from './useAppLock';

/** Drop into any screen's header row — renders nothing unless a lock password is actually set. */
export function LockButton() {
  const { lockEnabled, engageLock } = useAppLock();
  if (!lockEnabled) return null;

  return (
    <IconButton aria-label="锁定应用" title="锁定应用" onClick={engageLock}>
      <IconLock size={20} />
    </IconButton>
  );
}
