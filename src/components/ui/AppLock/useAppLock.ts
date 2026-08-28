import { useContext } from 'react';
import { AppLockContext } from './AppLockContext';

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within an AppLockProvider');
  return ctx;
}
