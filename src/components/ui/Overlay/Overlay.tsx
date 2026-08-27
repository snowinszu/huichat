import { useEffect, type MouseEvent, type ReactNode } from 'react';
import styles from './Overlay.module.css';

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  closeOnBackdropClick?: boolean;
}

export function Overlay({ open, onClose, children, closeOnBackdropClick = true }: OverlayProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && event.target === event.currentTarget) onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.panel}>{children}</div>
    </div>
  );
}
