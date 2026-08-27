import { useId, type SelectHTMLAttributes } from 'react';
import styles from './Select.module.css';
import { IconAlertCircle } from '../icons';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  required?: boolean;
  error?: string;
}

export function Select({ label, hint, required, error, id, className, children, ...rest }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={selectId}>
          {label}
          {required && <span className={styles.required}>*</span>}
          {hint && <span className={styles.hint}>{hint}</span>}
        </label>
      )}
      <select
        id={selectId}
        className={[styles.control, error && styles.hasError, className].filter(Boolean).join(' ')}
        aria-invalid={Boolean(error)}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <span className={styles.errorLabel}>
          <IconAlertCircle size={12} />
          {error}
        </span>
      )}
    </div>
  );
}
