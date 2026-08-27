import styles from './Toast.module.css';
import { IconCheck, IconAlertCircle } from '../icons';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastProps {
  message: string;
  type?: ToastType;
}

export function Toast({ message, type = 'info' }: ToastProps) {
  const classes = [styles.toast, type !== 'info' && styles[type]].filter(Boolean).join(' ');

  return (
    <div className={styles.viewport}>
      <div className={classes} role="status">
        {type === 'success' && <IconCheck size={16} strokeWidth={2.5} />}
        {type === 'error' && <IconAlertCircle size={16} strokeWidth={2.5} />}
        <span>{message}</span>
      </div>
    </div>
  );
}
