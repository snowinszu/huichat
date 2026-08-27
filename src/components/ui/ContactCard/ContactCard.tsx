import type { ReactNode } from 'react';
import styles from './ContactCard.module.css';
import { IconButton } from '../IconButton/IconButton';
import { IconChart, IconEdit, IconTrash, IconPlus } from '../icons';

export interface ContactCardProps {
  name: string;
  avatarLabel: string;
  avatarGradient: string;
  avatarUrl?: string | null;
  preview: string;
  roleTag?: string;
  time: string;
  disabled?: boolean;
  onOpen?: () => void;
  onOpenStats?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ContactCard({
  name,
  avatarLabel,
  avatarGradient,
  avatarUrl,
  preview,
  roleTag,
  time,
  disabled = false,
  onOpen,
  onOpenStats,
  onEdit,
  onDelete,
}: ContactCardProps) {
  return (
    <div
      className={[styles.card, disabled && styles.disabled].filter(Boolean).join(' ')}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen && !disabled ? 0 : undefined}
      onClick={disabled ? undefined : onOpen}
      onKeyDown={(event) => {
        if (!onOpen || disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      {(onOpenStats || onEdit || onDelete) && (
        <div className={styles.actions}>
          {onOpenStats && (
            <IconButton
              size="sm"
              variant="surface"
              aria-label="统计"
              onClick={(event) => {
                event.stopPropagation();
                onOpenStats();
              }}
            >
              <IconChart size={14} />
            </IconButton>
          )}
          {onEdit && (
            <IconButton
              size="sm"
              variant="surface"
              aria-label="编辑"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
            >
              <IconEdit size={14} />
            </IconButton>
          )}
          {onDelete && (
            <IconButton
              size="sm"
              variant="surface"
              danger
              aria-label="删除"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              <IconTrash size={14} />
            </IconButton>
          )}
        </div>
      )}
      <div className={styles.avatar} style={avatarUrl ? undefined : { background: avatarGradient }}>
        {avatarUrl ? <img className={styles.avatarImage} src={avatarUrl} alt="" /> : avatarLabel}
      </div>
      <div className={styles.name}>{name}</div>
      <div className={styles.preview}>{preview}</div>
      <div className={styles.meta}>
        {roleTag && <span className={styles.roleTag}>{roleTag}</span>}
        <span className={styles.time}>{time}</span>
      </div>
    </div>
  );
}

export function ContactCardGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

export interface AddContactCardProps {
  label: string;
  onClick: () => void;
}

export function AddContactCard({ label, onClick }: AddContactCardProps) {
  return (
    <button type="button" className={styles.addCard} onClick={onClick}>
      <span className={styles.addIcon}>
        <IconPlus size={20} />
      </span>
      <span className={styles.addLabel}>{label}</span>
    </button>
  );
}
