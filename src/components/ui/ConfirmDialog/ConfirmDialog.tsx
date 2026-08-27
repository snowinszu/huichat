import type { ReactNode } from 'react';
import styles from './ConfirmDialog.module.css';
import { Overlay } from '../Overlay/Overlay';
import { Button } from '../Button/Button';
import { IconAlertTriangle, IconTrash } from '../icons';

type ConfirmTone = 'danger' | 'warning';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  subtitle?: string;
  tone?: ConfirmTone;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmLoading?: boolean;
  children: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  subtitle,
  tone = 'danger',
  confirmLabel = '确认删除',
  cancelLabel = '取消',
  confirmLoading = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Overlay open={open} onClose={onClose}>
      <div className={styles.dialog} role="alertdialog" aria-modal="true">
        <div className={[styles.header, styles[tone]].join(' ')}>
          <div className={[styles.iconWrap, styles[tone]].join(' ')}>
            {tone === 'danger' ? <IconTrash size={18} /> : <IconAlertTriangle size={18} />}
          </div>
          <div>
            <div className={styles.title}>{title}</div>
            {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
          </div>
        </div>
        <div className={styles.body}>{children}</div>
        <div className={styles.footer}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant="danger" size="sm" loading={confirmLoading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
