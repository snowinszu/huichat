import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './IconButton.module.css';

type IconButtonSize = 'md' | 'sm';
type IconButtonVariant = 'ghost' | 'surface';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  danger?: boolean;
  'aria-label': string;
  children: ReactNode;
}

export function IconButton({
  size = 'md',
  variant = 'ghost',
  danger = false,
  className,
  children,
  ...rest
}: IconButtonProps) {
  const classes = [styles.btn, styles[size], styles[variant], danger && styles.dangerHover, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
