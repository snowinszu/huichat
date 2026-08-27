import type { ButtonHTMLAttributes } from 'react';
import styles from './ToneChip.module.css';

export interface ToneChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function ToneChip({ active = false, className, children, ...rest }: ToneChipProps) {
  const classes = [styles.chip, active && styles.active, className].filter(Boolean).join(' ');

  return (
    <button type="button" className={classes} aria-pressed={active} {...rest}>
      {children}
    </button>
  );
}
