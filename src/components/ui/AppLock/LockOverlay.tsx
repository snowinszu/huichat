import { useRef, useState } from 'react';
import styles from './LockOverlay.module.css';
import { PasswordInput } from '../Input/Input';
import { Button } from '../Button/Button';
import { IconLock } from '../icons';
import { useAppLock } from './useAppLock';
import { ForgotPasswordDialog } from './ForgotPasswordDialog';

/** Renders whenever the app is locked (see AppLockProvider) — either a correct password or the "忘记密码" reset flow gets out of it. */
export function LockOverlay() {
  const { disengageLock } = useAppLock();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  // Toggled true then cleared via onAnimationEnd — the CSS class needs to
  // actually leave the DOM between guesses, or a second consecutive wrong
  // guess wouldn't retrigger the animation.
  const [shake, setShake] = useState(false);
  // PasswordInput doesn't forward refs (no other consumer in this codebase
  // needs to reach the underlying <input>), so refocusing after a wrong
  // guess queries the DOM through a wrapper ref instead of adding ref
  // support to a shared component for this one caller.
  const formRef = useRef<HTMLDivElement>(null);

  async function handleUnlock() {
    if (!password || submitting) return;
    setSubmitting(true);
    const correct = await disengageLock(password);
    setSubmitting(false);
    if (!correct) {
      setPassword('');
      setError('密码错误');
      setShake(true);
      formRef.current?.querySelector('input')?.focus();
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="应用已锁定">
      <div className={styles.badge}>
        <IconLock size={28} />
      </div>
      <span className={styles.appName}>会聊</span>
      <div
        ref={formRef}
        className={[styles.form, shake && styles.shake].filter(Boolean).join(' ')}
        onAnimationEnd={() => setShake(false)}
      >
        <PasswordInput
          placeholder="输入密码解锁"
          autoFocus
          value={password}
          error={error}
          onChange={(event) => {
            setPassword(event.target.value);
            setError(undefined);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleUnlock();
          }}
        />
        <Button loading={submitting} onClick={handleUnlock} className={styles.unlockButton}>
          解锁
        </Button>
        <button type="button" className={styles.forgotLink} onClick={() => setForgotOpen(true)}>
          忘记密码？
        </button>
      </div>
      <ForgotPasswordDialog open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
}
