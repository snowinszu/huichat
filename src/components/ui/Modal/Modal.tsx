import { useId, type ReactNode } from 'react';
import styles from './Modal.module.css';
import { Overlay } from '../Overlay/Overlay';
import { IconClose } from '../icons';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const titleId = useId();

  return (
    <Overlay open={open} onClose={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.header}>
          <span id={titleId} className={styles.title}>
            {title}
          </span>
          <button type="button" className={styles.close} aria-label="关闭" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </Overlay>
  );
}
